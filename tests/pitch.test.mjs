import assert from 'node:assert/strict';
import { pitchTempo } from '../src/dsp.js';
const sr = 48000, n = sr * 5;
const L = new Float32Array(n).map((_, i) => Math.sin(2 * Math.PI * 196 * i / sr) * (1 + .3 * Math.sin(i / sr * 5)));
const R = new Float32Array(n).map((_, i) => Math.sin(2 * Math.PI * 247 * i / sr));
for (const s of [-7, -3, -1, 1, 2, 5, 7]) for (const sp of [1, .75, .5]) {
  const out = pitchTempo([L, R], s, sp);
  assert.equal(out.length, 2);
  const want = n / sp, got = out[0].length;
  assert.ok(Math.abs(got - want) / want < .01, `tom ${s} vel ${sp}: ${got} vs ${want}`);
  assert.equal(out[0].length, out[1].length);
  let bad = 0, pk = 0; for (const c of out) for (const v of c) { if (!Number.isFinite(v)) bad++; pk = Math.max(pk, Math.abs(v)); }
  assert.equal(bad, 0); assert.ok(pk < 2.5, `pico ${pk}`);
}
console.log('tom ok');
