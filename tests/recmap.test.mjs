// Confere a conta que põe a gravação no lugar certo da linha do tempo.
import assert from 'node:assert/strict';
import { extract } from '../src/dsp.js';
const sr = 48000;
// Simula: tocar a partir de from=10 s no tempo t0=5 s do áudio; atraso total 80 ms.
const from = 10, t0 = 5, lat = .08;
// O guitarrista toca uma nota no tempo 12,000 s da música. Ouve o som com atraso de saída e a entrada demora mais:
// a nota chega ao app em t0 + (12 - from) + lat.
const noteCtx = t0 + (12 - from) + lat;
const buf = new Float32Array(sr * 8); buf[Math.round(noteCtx * sr) - Math.round(4 * sr)] = 1;
const chunks = [{ f: Math.round(4 * sr), c: [buf, buf] }];
const start = 11, end = 13;
const f0 = Math.ceil((start - from + t0 + lat) * sr), f1 = Math.floor((end - from + t0 + lat) * sr);
const take = extract(chunks, f0, f1);
const recStart = from + (f0 / sr - t0 - lat);
const idx = take[0].indexOf(1);
const tl = recStart + idx / sr;
assert.ok(Math.abs(tl - 12) < 1 / sr * 2, `nota em ${tl}`);
console.log('posição ok', tl.toFixed(5));
