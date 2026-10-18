import { afterEach, describe, expect, it, vi } from "vitest";
import { startMic } from "./audio";

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
