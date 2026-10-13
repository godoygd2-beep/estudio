import { pitchTempo } from './dsp.js';

self.onmessage = e => {
  const { id, chans, semis, speed } = e.data;
  try {
    const out = pitchTempo(chans, semis, speed).map(c => (c.byteOffset === 0 && c.length * 4 === c.buffer.byteLength) ? c : c.slice());
    self.postMessage({ id, out }, out.map(c => c.buffer));
  } catch (err) {
    self.postMessage({ id, error: String(err) });
  }
};
