import { afterEach, describe, expect, it, vi } from "vitest";
import { analyserCentroid, startMic } from "./audio";

class FakeWorkletNode {
  static last: FakeWorkletNode;
  port: { onmessage: ((e: { data: ArrayBuffer }) => void) | null } = { onmessage: null };
  constructor() {
    FakeWorkletNode.last = this;
  }
}

class FakeAudioContext {
  audioWorklet = { addModule: async () => {} };
  createMediaStreamSource = () => ({ connect: () => {} });
  createAnalyser = () => ({ fftSize: 0, getFloatTimeDomainData: () => {} });
  close = async () => {};
}

afterEach(() => vi.unstubAllGlobals());

describe("startMic", () => {
  it("keeps streaming (silence from the disabled track) while muted, so Live can close the learner's turn", async () => {
    const track = { enabled: true, stop: vi.fn() };
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: async () => ({ getTracks: () => [track], getAudioTracks: () => [track] }) } });
    vi.stubGlobal("AudioContext", FakeAudioContext);
    vi.stubGlobal("AudioWorkletNode", FakeWorkletNode);
    const onChunk = vi.fn();
    const mic = await startMic(onChunk);

    mic.setMuted(true);
    const chunk = new ArrayBuffer(3200);
    FakeWorkletNode.last.port.onmessage!({ data: chunk });

    expect(track.enabled).toBe(false);
    expect(onChunk).toHaveBeenCalledWith(chunk);
    expect(mic.level()).toBe(0);
  });
});

describe("analyserCentroid", () => {
  // 256 bins over 0..12 kHz (24 kHz playback): 46.875 Hz per bin.
  const analyserWith = (db: (bin: number) => number) =>
    ({ getFloatFrequencyData: (out: Float32Array) => out.forEach((_, i) => (out[i] = db(i))) }) as unknown as AnalyserNode;

  it("lands on a single loud bin and ignores energy above 4 kHz", () => {
    const at1kHz = Math.round(1000 / 46.875);
    const c = analyserWith((i) => (i === at1kHz || i === 200 ? 0 : -Infinity));
    expect(analyserCentroid(c, new Float32Array(256), 24000)).toBeCloseTo(at1kHz * 46.875);
  });

  it("is 0 for silence", () => {
    expect(analyserCentroid(analyserWith(() => -Infinity), new Float32Array(256), 24000)).toBe(0);
  });
});
