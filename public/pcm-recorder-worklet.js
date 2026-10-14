// AudioWorklet: mic Float32 → Int16 PCM chunks of ~100 ms at the context's sample rate (16 kHz).
class PcmRecorder extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = new Int16Array(1600);
    this.length = 0;
  }
  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (channel) {
      for (let i = 0; i < channel.length; i++) {
        const s = Math.max(-1, Math.min(1, channel[i]));
        this.buffer[this.length++] = s < 0 ? s * 0x8000 : s * 0x7fff;
        if (this.length === this.buffer.length) {
          this.port.postMessage(this.buffer.buffer.slice(0));
          this.length = 0;
        }
      }
    }
    return true;
  }
}
registerProcessor("pcm-recorder", PcmRecorder);
