// Browser audio helpers for the interview stage. Client-only.

export function bytesToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export function base64ToInt16(b64: string): Int16Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Int16Array(bytes.buffer, 0, bytes.length >> 1);
}

/** RMS of an analyser's current window, 0..1 — drives the character's "mouth"/ring. */
export function analyserLevel(analyser: AnalyserNode, scratch: Float32Array<ArrayBuffer>): number {
  analyser.getFloatTimeDomainData(scratch);
  let sum = 0;
  for (const v of scratch) sum += v * v;
  return Math.min(1, Math.sqrt(sum / scratch.length) * 4);
}

export type Mic = { stop: () => void; setMuted: (m: boolean) => void; level: () => number };

/** 16 kHz mono PCM chunks (~100 ms) via AudioWorklet. Throws if permission is denied. */
export async function startMic(onChunk: (pcm: ArrayBuffer) => void): Promise<Mic> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  });
  const ctx = new AudioContext({ sampleRate: 16000 });
  await ctx.audioWorklet.addModule("/pcm-recorder-worklet.js");
  const source = ctx.createMediaStreamSource(stream);
  const node = new AudioWorkletNode(ctx, "pcm-recorder");
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 512;
  const scratch = new Float32Array(analyser.fftSize);
  let muted = false;
  node.port.onmessage = (e: MessageEvent<ArrayBuffer>) => {
    if (!muted) onChunk(e.data);
  };
  source.connect(analyser);
  source.connect(node);
  return {
    stop: () => {
      stream.getTracks().forEach((t) => t.stop());
      void ctx.close();
    },
    setMuted: (m) => {
      muted = m;
      stream.getAudioTracks().forEach((t) => (t.enabled = !m));
    },
    level: () => (muted ? 0 : analyserLevel(analyser, scratch)),
  };
}

/** Gapless queue for 24 kHz PCM16 chunks from Gemini Live, with a level meter and barge-in stop. */
export class PcmPlayer {
  private ctx = new AudioContext({ sampleRate: 24000 });
  private analyser = this.ctx.createAnalyser();
  private scratch = new Float32Array(512);
  private nextAt = 0;
  private sources = new Set<AudioBufferSourceNode>();

  constructor() {
    this.analyser.fftSize = 512;
    this.analyser.connect(this.ctx.destination);
  }

  resume() {
    return this.ctx.resume();
  }

  play(b64: string) {
    const pcm = base64ToInt16(b64);
    const buf = this.ctx.createBuffer(1, pcm.length, 24000);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < pcm.length; i++) ch[i] = (pcm[i] ?? 0) / 0x8000;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.analyser);
    this.nextAt = Math.max(this.nextAt, this.ctx.currentTime + 0.05);
    src.start(this.nextAt);
    this.nextAt += buf.duration;
    this.sources.add(src);
    src.onended = () => this.sources.delete(src);
  }

  /** Learner interrupted: drop everything queued. */
  stop() {
    for (const s of this.sources) s.stop();
    this.sources.clear();
    this.nextAt = 0;
  }

  get playing() {
    return this.sources.size > 0;
  }

  level() {
    return this.playing ? analyserLevel(this.analyser, this.scratch) : 0;
  }

  close() {
    this.stop();
    void this.ctx.close();
  }
}
