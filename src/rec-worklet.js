// Captura a entrada (Cuvave) quadro a quadro e mede o nível.
const SIZE = 8192;
class Rec extends AudioWorkletProcessor {
  constructor() {
    super();
    this.on = false; this.n = 0; this.start = 0; this.blocks = 0; this.pk = 0;
    this.alloc();
    this.port.onmessage = e => {
      if (e.data === 'start') { this.on = true; this.n = 0; }
      else if (e.data === 'stop') { this.flush(); this.on = false; this.port.postMessage({ done: true }); }
    };
  }
  alloc() { this.buf = [new Float32Array(SIZE), new Float32Array(SIZE)]; this.n = 0; }
  flush() {
    if (this.n > 0) {
      const c = [this.buf[0].slice(0, this.n), this.buf[1].slice(0, this.n)];
      this.port.postMessage({ f: this.start, c }, [c[0].buffer, c[1].buffer]);
    }
    this.n = 0;
  }
  process(inputs) {
    const inp = inputs[0];
    const L = inp && inp[0];
    if (L) {
      const R = inp[1] || L;
      for (let i = 0; i < L.length; i++) { const a = Math.abs(L[i]), b = Math.abs(R[i]); const m = a > b ? a : b; if (m > this.pk) this.pk = m; }
      if (this.on) {
        if (this.n + L.length > SIZE) {
          this.port.postMessage({ f: this.start, c: this.buf }, [this.buf[0].buffer, this.buf[1].buffer]);
          this.alloc();
        }
        if (this.n === 0) this.start = currentFrame;
        this.buf[0].set(L, this.n); this.buf[1].set(R, this.n); this.n += L.length;
      }
    }
    if (++this.blocks >= 12) { this.port.postMessage({ lv: this.pk }); this.pk = 0; this.blocks = 0; }
    return true;
  }
}
registerProcessor('rec', Rec);
