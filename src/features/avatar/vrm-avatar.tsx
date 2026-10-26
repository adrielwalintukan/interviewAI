"use client";

// three + three-vrm live only in this module, which avatar.tsx loads with next/dynamic (engineering-standard §7).
import { VRMLoaderPlugin, VRMUtils, type VRM, type VRMHumanBoneName } from "@pixiv/three-vrm";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { Vector3 } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VOWELS, ease, mouthShape, type Vowel } from "./lip-sync";

const FOV = 26;

export type Voice = () => { level: number; centroid: number };
export type Pose = "idle" | "listening" | "thinking" | "speaking";

export type VrmAvatarProps = {
  url: string;
  voice?: Voice;
  pose?: Pose;
  /** design-system §4: reduced motion keeps only blink and lip-sync. */
  still?: boolean;
  onReady: () => void;
  onError: () => void;
};

export default function VrmAvatar(props: VrmAvatarProps) {
  // architecture §5: pixel ratio capped at 1.5 on touch devices.
  const dprMax = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches ? 1.5 : 2;
  return (
    // flat: R3F's default ACES tone mapping washes out MToon (toon) colors. One light at π, as in three-vrm's examples.
    <Canvas flat dpr={[1, dprMax]} camera={{ fov: FOV, near: 0.1, far: 20 }} gl={{ alpha: true, antialias: true }} aria-hidden>
      <directionalLight position={[1, 1, 1]} intensity={Math.PI} />
      <Model {...props} />
    </Canvas>
  );
}

export type AvatarFrameState = {
  mouth: Record<Vowel, number>;
  blink: { next: number; t: number };
  nod: { x: number; y: number; z: number; chest: number };
};

export function stepAvatarFrame({
  vrm,
  dt,
  t,
  voice,
  pose = "idle",
  still = false,
  state,
}: {
  vrm: {
    expressionManager?: { setValue: (name: string, value: number) => void } | null;
    humanoid: { getNormalizedBoneNode: (name: VRMHumanBoneName) => { rotation: { set: (x: number, y: number, z: number) => void } } | null };
    update: (dt: number) => void;
  };
  dt: number;
  t: number;
  voice?: Voice;
  pose?: Pose;
  still?: boolean;
  state: AvatarFrameState;
}) {
  const em = vrm.expressionManager;

  const { level, centroid } = voice?.() ?? { level: 0, centroid: 0 };
  const target = mouthShape(level, centroid);
  for (const v of VOWELS) {
    state.mouth[v] = ease(state.mouth[v], target[v], dt);
    em?.setValue(v, state.mouth[v]);
  }

  // Random blink every 2–6 s, ~150 ms closed-and-open (architecture §5).
  const b = state.blink;
  if (b.t < 0 && t >= b.next) b.t = 0;
  if (b.t >= 0) {
    b.t += dt;
    em?.setValue("blink", Math.max(0, 1 - Math.abs(b.t - 0.075) / 0.075));
    if (b.t > 0.15) {
      b.t = -1;
      b.next = t + 2 + Math.random() * 4;
      em?.setValue("blink", 0);
    }
  }

  if (!still) {
    // Breathing, a slow idle sway, and a light gesture per state.
    const n = state.nod;
    const goal = {
      x: pose === "listening" ? 0.05 + Math.sin(t * 2.4) * 0.035 : pose === "thinking" ? -0.06 : pose === "speaking" ? level * 0.06 : 0,
      y: Math.sin(t * 0.45) * 0.04,
      z: pose === "thinking" ? 0.09 : Math.sin(t * 0.3) * 0.015,
      chest: Math.sin(t * 1.7) * 0.012,
    };
    for (const k of ["x", "y", "z", "chest"] as const) n[k] = ease(n[k], goal[k], dt, 0.35);
    const head = vrm.humanoid.getNormalizedBoneNode("head");
    head?.rotation.set(n.x, n.y, n.z);
    vrm.humanoid.getNormalizedBoneNode("chest")?.rotation.set(n.chest, 0, 0);
  }
  vrm.update(dt);
}

function Model({ url, voice, pose = "idle", still = false, onReady, onError }: VrmAvatarProps) {
  const [vrm, setVrm] = useState<VRM | null>(null);
  const camera = useThree((s) => s.camera);
  const ready = useEffectEvent(onReady);
  const failed = useEffectEvent(onError);

  useEffect(() => {
    let cancelled = false;
    let loaded: VRM | undefined;
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));
    loader
      .loadAsync(url)
      .then((gltf) => {
        const v = gltf.userData.vrm as VRM | undefined;
        if (!v) throw new Error("not a VRM");
        VRMUtils.removeUnnecessaryVertices(gltf.scene);
        VRMUtils.combineSkeletons(gltf.scene);
        if (cancelled) return VRMUtils.deepDispose(v.scene);
        loaded = v;
        relaxArms(v);
        // Half-body framing (vrm-spec §2): head to waist, whatever the character's height.
        v.scene.updateMatrixWorld(true);
        const y = (bone: VRMHumanBoneName) => v.humanoid.getRawBoneNode(bone)?.getWorldPosition(new Vector3()).y;
        const top = (y("head") ?? 1.4) + 0.22; // the head bone sits at the base of the skull
        const bottom = y("hips") ?? top - 0.75;
        const center = (top + bottom) / 2;
        const distance = (((top - bottom) / 2) * 1.08) / Math.tan((FOV / 2) * (Math.PI / 180));
        camera.position.set(0, center + 0.05, distance);
        camera.lookAt(0, center, 0);
        if (v.lookAt) v.lookAt.target = camera;
        setVrm(v);
        ready();
      })
      .catch(() => {
        if (!cancelled) failed();
      });
    return () => {
      cancelled = true;
      if (loaded) VRMUtils.deepDispose(loaded.scene);
    };
  }, [url, camera]);

  const mouth = useRef<Record<Vowel, number>>({ aa: 0, ih: 0, ou: 0, ee: 0, oh: 0 });
  const blink = useRef({ next: 3, t: -1 });
  const nod = useRef({ x: 0, y: 0, z: 0, chest: 0 });

  useFrame((state, dt) => {
    if (!vrm) return;
    stepAvatarFrame({
      vrm,
      dt,
      t: state.clock.elapsedTime,
      voice,
      pose,
      still,
      state: { mouth: mouth.current, blink: blink.current, nod: nod.current },
    });
  });

  return vrm ? <primitive object={vrm.scene} /> : null;
}

/** VRoid exports a T-pose; bring the arms down to the sides. */
function relaxArms(vrm: VRM) {
  const set = (bone: VRMHumanBoneName, z: number) => vrm.humanoid.getNormalizedBoneNode(bone)?.rotation.set(0, 0, z);
  set("leftUpperArm", -1.2);
  set("rightUpperArm", 1.2);
  set("leftLowerArm", -0.1);
  set("rightLowerArm", 0.1);
}
