// `npm run vrm:optimize -- <dir>`: shrinks VRoid Studio exports to docs/vrm-spec.md §3 before upload.
// VRoid 2.x cannot export a 1024 atlas and stores every face morph target densely (most vertices zero), so:
// textures > 1024 px are resized to 1024, and morph targets become glTF sparse accessors (lossless, checked
// below). Everything else in the GLB (VRMC_* extensions, materials, bones) is copied unchanged.
// Output goes to <dir>/optimized/. Run once per export; the files are not part of the repo.
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import sharp from "sharp";

const IDS = ["ratna", "hendra", "nadia", "yosef", "sri", "dimas"];
const EXPRESSIONS = ["aa", "ih", "ou", "ee", "oh", "blink", "blinkLeft", "blinkRight", "happy", "angry", "sad", "relaxed", "surprised"];
const MAX_TEXTURE = 1024;
const MAX_BYTES = 8 * 1024 * 1024;
const FLOAT = 5126;

function readGlb(buf) {
  if (buf.readUInt32LE(0) !== 0x46546c67 || buf.readUInt32LE(4) !== 2) throw new Error("not a glTF 2.0 binary");
  const jsonLen = buf.readUInt32LE(12);
  const gltf = JSON.parse(buf.subarray(20, 20 + jsonLen).toString("utf8"));
  const binLen = buf.readUInt32LE(20 + jsonLen);
  return { gltf, bin: buf.subarray(28 + jsonLen, 28 + jsonLen + binLen) };
}

function writeGlb(gltf, bin) {
  const json = Buffer.from(JSON.stringify(gltf), "utf8");
  const jsonPad = Buffer.concat([json, Buffer.alloc((4 - (json.length % 4)) % 4, 0x20)]);
  const binPad = Buffer.concat([bin, Buffer.alloc((4 - (bin.length % 4)) % 4)]);
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + jsonPad.length + 8 + binPad.length, 8);
  const chunk = (len, type) => {
    const h = Buffer.alloc(8);
    h.writeUInt32LE(len, 0);
    h.writeUInt32LE(type, 4);
    return h;
  };
  return Buffer.concat([header, chunk(jsonPad.length, 0x4e4f534a), jsonPad, chunk(binPad.length, 0x004e4942), binPad]);
}

const viewBytes = (gltf, bin, index) => {
  const v = gltf.bufferViews[index];
  return bin.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength);
};

/** Dense float VEC3 values of an accessor, sparse or not (zeros when it has no bufferView). */
function denseVec3(gltf, bin, acc) {
  const out = new Float32Array(acc.count * 3);
  if (acc.bufferView != null) {
    const b = viewBytes(gltf, bin, acc.bufferView);
    for (let i = 0; i < out.length; i++) out[i] = b.readFloatLE((acc.byteOffset ?? 0) + i * 4);
  }
  if (acc.sparse) {
    const ib = viewBytes(gltf, bin, acc.sparse.indices.bufferView);
    const vb = viewBytes(gltf, bin, acc.sparse.values.bufferView);
    const wide = acc.sparse.indices.componentType === 5125;
    for (let i = 0; i < acc.sparse.count; i++) {
      const at = wide ? ib.readUInt32LE(i * 4) : ib.readUInt16LE(i * 2);
      for (let c = 0; c < 3; c++) out[at * 3 + c] = vb.readFloatLE((i * 3 + c) * 4);
    }
  }
  return out;
}

async function optimize(buf) {
  const { gltf, bin } = readGlb(buf);
  const pieces = [];
  let length = 0;
  const addView = (bytes) => {
    const pad = (4 - (length % 4)) % 4;
    if (pad) pieces.push(Buffer.alloc(pad));
    length += pad;
    gltf.bufferViews.push({ buffer: 0, byteOffset: length, byteLength: bytes.length });
    pieces.push(bytes);
    length += bytes.length;
    return gltf.bufferViews.length - 1;
  };
  const oldViews = gltf.bufferViews;
  gltf.bufferViews = [];
  const copied = new Map();
  const copyView = (old) => {
    if (!copied.has(old)) {
      const { byteOffset = 0, byteLength, ...rest } = oldViews[old];
      const index = addView(bin.subarray(byteOffset, byteOffset + byteLength));
      Object.assign(gltf.bufferViews[index], rest, { byteOffset: gltf.bufferViews[index].byteOffset, byteLength });
      copied.set(old, index);
    }
    return copied.get(old);
  };
  const oldGltf = { bufferViews: oldViews };

  const targets = new Set();
  for (const mesh of gltf.meshes ?? []) for (const p of mesh.primitives) for (const t of p.targets ?? []) for (const a of Object.values(t)) targets.add(a);

  const originals = new Map();
  for (const [index, acc] of gltf.accessors.entries()) {
    if (!targets.has(index) || acc.sparse || acc.bufferView == null) continue;
    if (acc.componentType !== FLOAT || acc.type !== "VEC3") throw new Error(`morph accessor ${index} is not float VEC3`);
    const dense = denseVec3(oldGltf, bin, acc);
    originals.set(index, dense);
    const moved = [];
    for (let i = 0; i < acc.count; i++) if (dense[i * 3] || dense[i * 3 + 1] || dense[i * 3 + 2]) moved.push(i);
    delete acc.bufferView;
    delete acc.byteOffset;
    if (moved.length === 0) continue; // an accessor without bufferView is all zeros (glTF 2.0 §3.6.2.3)
    const wide = acc.count > 65535;
    const indices = Buffer.alloc(moved.length * (wide ? 4 : 2));
    const values = Buffer.alloc(moved.length * 12);
    moved.forEach((v, i) => {
      if (wide) indices.writeUInt32LE(v, i * 4);
      else indices.writeUInt16LE(v, i * 2);
      for (let c = 0; c < 3; c++) values.writeFloatLE(dense[v * 3 + c], (i * 3 + c) * 4);
    });
    acc.sparse = {
      count: moved.length,
      indices: { bufferView: addView(indices), componentType: wide ? 5125 : 5123 },
      values: { bufferView: addView(values) },
    };
  }
  for (const acc of gltf.accessors) if (acc.bufferView != null) acc.bufferView = copyView(acc.bufferView);
  for (const image of gltf.images ?? []) {
    if (image.bufferView == null) continue;
    const old = viewBytes(oldGltf, bin, image.bufferView);
    const meta = await sharp(old).metadata();
    if (Math.max(meta.width, meta.height) <= MAX_TEXTURE) {
      image.bufferView = copyView(image.bufferView);
      continue;
    }
    const resized = await sharp(old).resize(MAX_TEXTURE, MAX_TEXTURE, { fit: "inside" }).png({ compressionLevel: 9 }).toBuffer();
    image.bufferView = addView(resized);
    image.mimeType = "image/png";
  }
  const out = Buffer.concat(pieces);
  gltf.buffers = [{ byteLength: out.length }];

  // Self-check: every morph target must decode to the original values (=== on purpose: -0 comes back as 0).
  for (const [index, dense] of originals) {
    const again = denseVec3(gltf, out, gltf.accessors[index]);
    if (!again.every((v, i) => v === dense[i])) throw new Error(`morph accessor ${index} changed`);
  }
  return writeGlb(gltf, out);
}

async function check(name, buf) {
  const { gltf, bin } = readGlb(buf);
  const vrm = gltf.extensions?.VRMC_vrm;
  const preset = vrm?.expressions?.preset ?? {};
  let maxTexture = 0;
  for (const image of gltf.images ?? []) {
    const meta = await sharp(viewBytes(gltf, bin, image.bufferView)).metadata();
    maxTexture = Math.max(maxTexture, meta.width, meta.height);
  }
  let triangles = 0;
  for (const mesh of gltf.meshes ?? []) for (const p of mesh.primitives) {
    if ((p.mode ?? 4) === 4) triangles += (p.indices != null ? gltf.accessors[p.indices].count : gltf.accessors[p.attributes.POSITION].count) / 3;
  }
  const failed = [
    [IDS.includes(basename(name, ".vrm")), "file name is not a character id"],
    [buf.length <= MAX_BYTES, `${(buf.length / 1048576).toFixed(2)} MB > 8 MB`],
    [vrm?.specVersion?.startsWith("1."), "not VRM 1.0"],
    [EXPRESSIONS.every((e) => preset[e]?.morphTargetBinds?.length), "missing expressions"],
    [maxTexture <= MAX_TEXTURE, `texture ${maxTexture} px`],
    [triangles < 40000, `${triangles} triangles`],
    [vrm?.meta?.commercialUsage === "corporation", `commercialUsage ${vrm?.meta?.commercialUsage}`],
  ].filter(([ok]) => !ok).map(([, why]) => why);
  return { mb: (buf.length / 1048576).toFixed(2), maxTexture, triangles, failed };
}

const dir = process.argv[2];
if (!dir) throw new Error("usage: npm run vrm:optimize -- <folder with .vrm files>");
const outDir = join(dir, "optimized");
mkdirSync(outDir, { recursive: true });
let bad = 0;
for (const name of readdirSync(dir).filter((f) => f.endsWith(".vrm"))) {
  const input = readFileSync(join(dir, name));
  const output = await optimize(input);
  writeFileSync(join(outDir, name), output);
  const result = await check(name, output);
  if (result.failed.length) bad++;
  console.log(`${name}: ${(input.length / 1048576).toFixed(2)} MB -> ${result.mb} MB, texture ${result.maxTexture}, ${result.triangles} triangles ${result.failed.length ? "FAIL " + result.failed.join("; ") : "OK"}`);
}
process.exitCode = bad ? 1 : 0;
