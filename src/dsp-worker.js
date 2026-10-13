import { pitchTempo, cancelLoopback } from './dsp.js';

const own = c => (c.byteOffset === 0 && c.length * 4 === c.buffer.byteLength) ? c : c.slice();

self.onmessage = e => {
  const { id, kind } = e.data;
  try {
    if (kind === 'clean') {
      const { inp, ref, M, sr } = e.data;
      const r = cancelLoopback(inp, ref, M, sr);
      if (!r) { self.postMessage({ id, out: null }); return; }
      const out = r.out.map(own);
      self.postMessage({ id, out: { chans: out, db: r.db, lag: r.lag } }, out.map(c => c.buffer));
      return;
    }
    const { chans, semis, speed } = e.data;
    const out = pitchTempo(chans, semis, speed).map(own);
    self.postMessage({ id, out }, out.map(c => c.buffer));
  } catch (err) {
    self.postMessage({ id, error: String(err) });
  }
};
