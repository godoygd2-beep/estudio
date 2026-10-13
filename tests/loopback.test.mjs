import assert from 'node:assert/strict';
import { cancelLoopback } from '../src/dsp.js';
const sr = 48000, n = sr * 8, M = Math.round(.4 * sr), lag = 3517;
let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 - .5; };
// "música" que o celular toca (estéreo diferente nos dois lados)
const refL = new Float32Array(n + M), refR = new Float32Array(n + M);
for (let i = 0; i < n + M; i++) { const t = i / sr; refL[i] = .3 * Math.sin(2 * Math.PI * 110 * t) * (1 + Math.sin(t * 3)) + .1 * rnd(); refR[i] = .3 * Math.sin(2 * Math.PI * 165 * t + 1) + .1 * rnd(); }
// guitarra que entra pela USB
const gtr = new Float32Array(n); for (let i = 0; i < n; i++) { const t = i / sr; gtr[i] = .25 * Math.sin(2 * Math.PI * 330 * t) * Math.exp(-((t % 1) * 3)); }
// entrada = guitarra + retorno (mistura L/R, atrasada, um pouco filtrada)
const y = new Float32Array(n); let lp = 0;
for (let i = 0; i < n; i++) { const j = i + M - lag; const v = .45 * refL[j] + .35 * refR[j]; lp += (v - lp) * .6; y[i] = gtr[i] + lp; }
const r = cancelLoopback([y], [refL, refR], M, sr);
assert.ok(r, 'devia achar o retorno');
let e = 0, g = 0; for (let i = sr; i < n - sr; i++) { const d = r.out[0][i] - gtr[i]; e += d * d; g += gtr[i] * gtr[i]; }
const snr = 10 * Math.log10(g / e);
console.log('atraso', r.lag, 'redução', r.db.toFixed(1), 'dB, guitarra limpa SNR', snr.toFixed(1), 'dB');
assert.ok(Math.abs(r.lag - lag) < 30); assert.ok(snr > 25, 'sobrou retorno demais');
// sem retorno: não mexe
const r2 = cancelLoopback([gtr], [refL, refR], M, sr); assert.equal(r2, null);
console.log('retorno ok');
