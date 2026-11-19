// Batch mono PCM into 100 ms messages; flush the final partial frame on stop.
class MicFrames extends AudioWorkletProcessor {
  constructor() {
    super();
    this.frame = new Float32Array(Math.round(sampleRate / 10));
    this.used = 0;
    this.active = true;
    this.port.onmessage = () => {
      this.active = false;
      if (this.used) this.port.postMessage(this.frame.slice(0, this.used));
      this.port.postMessage(null);
    };
  }

  process(inputs) {
    if (!this.active) return false;
    const input = inputs[0]?.[0];
    if (!input) return true;
    for (const sample of input) {
      this.frame[this.used++] = sample;
      if (this.used === this.frame.length) {
        this.port.postMessage(this.frame, [this.frame.buffer]);
        this.frame = new Float32Array(Math.round(sampleRate / 10));
        this.used = 0;
      }
    }
    return true;
  }
}
registerProcessor('mic-frames', MicFrames);
