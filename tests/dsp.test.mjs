import assert from 'node:assert/strict';
import { extract, simplify, pitchTempo, toInt16, fromInt16, median, onsetOffsets, peaksOf } from '../src/dsp.js';
const sr = 48000;
// pedaços com buraco: [0..8192) e [8192+128 .. )
const mk = (f, n, v) => ({ f, c: [new Float32Array(n).fill(v), new Float32Array(n).fill(v)] });
const ch = [mk(1000, 8192, .1), mk(1000 + 8192 + 128, 4096, .2)];
let out = extract(ch, 2000, 2000 + 10000);
assert.equal(out[0].length, 10000);
assert.equal(out[0][0], Math.fround(.1));
assert.equal(out[0][8192 - 1000 + 10], 0); // buraco fica em silêncio
assert.equal(out[0][8192 + 128 - 1000 + 5], Math.fround(.2));
assert.equal(extract([], 0, 10), null);
// início antes do primeiro pedaço: zeros
out = extract(ch, 500, 1500); assert.equal(out[0][0], 0); assert.equal(out[0][600], Math.fround(.1));
// mono / estéreo
const L = new Float32Array(1000).map((_, i) => Math.sin(i / 10)), R = L.slice();
assert.equal(simplify([L, R]).length, 1);
assert.equal(simplify([L, new Float32Array(1000)]).length, 1);
assert.equal(simplify([new Float32Array(1000), L])[0], L);
const R2 = new Float32Array(1000).map((_, i) => Math.cos(i / 7));
assert.equal(simplify([L, R2]).length, 2);
// 16 bits
const back = fromInt16(toInt16([L]))[0]; assert.ok(Math.abs(back[123] - L[123]) < 1e-4);
// tom e velocidade preservam duração esperada
const x = new Float32Array(sr * 3).map((_, i) => Math.sin(2 * Math.PI * 220 * i / sr));
assert.equal(pitchTempo([x], 2, 1)[0].length, Math.floor(Math.ceil(x.length * Math.pow(2, 2 / 12)) / Math.pow(2, 2 / 12)));
const slow = pitchTempo([x, x], 0, .5); assert.equal(slow.length, 2); assert.equal(slow[0].length, x.length * 2);
// frequência do tom +12: conta cruzamentos por zero
const up = pitchTempo([x], 12, 1)[0]; let z1 = 0, z2 = 0;
for (let i = sr; i < sr * 2; i++) { if (x[i - 1] < 0 && x[i] >= 0) z1++; if (up[i - 1] < 0 && up[i] >= 0) z2++; }
assert.ok(Math.abs(z2 / z1 - 2) < .05, `oitava: ${z2 / z1}`);
// calibração: notas 60 ms depois de cada clique
const clicks = [1, 1.6, 2.2, 2.8, 3.4, 4, 4.6, 5.2]; const f0 = Math.round(.5 * sr); const rec = new Float32Array(sr * 6);
for (const t of clicks) { const s = Math.round((t + .06) * sr) - f0; for (let i = 0; i < 2000; i++) rec[s + i] = .5 * Math.exp(-i / 800) * Math.sin(i / 3); }
const offs = onsetOffsets([rec], sr, f0, clicks); assert.equal(offs.length, 8);
assert.ok(Math.abs(median(offs) - .06) < .003, `atraso ${median(offs)}`);
// picos
const pk = peaksOf([L], 1000); assert.ok(pk.pk > .9);
console.log('dsp ok');
