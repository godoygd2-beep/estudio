// Processamento de áudio sem DOM: picos para desenhar a onda e mudança de tom/velocidade (WSOLA).
// Usado pela página e pelo worker.

export function peaksOf(chans, sr) {
  const b = Math.max(1, Math.round(sr / 100));
  const len = chans[0].length, n = Math.ceil(len / b);
  const mn = new Float32Array(n), mx = new Float32Array(n);
  let pk = 0;
  for (let k = 0; k < n; k++) {
    let a = 1, z = -1;
    const e = Math.min(len, (k + 1) * b);
    for (const d of chans) {
      for (let i = k * b; i < e; i++) { const v = d[i]; if (v < a) a = v; if (v > z) z = v; }
    }
    if (a > z) { a = 0; z = 0; }
    mn[k] = a; mx[k] = z;
    if (-a > pk) pk = -a; if (z > pk) pk = z;
  }
  return { mn, mx, rate: sr / b, pk: pk || 1 };
}

const N = 1024, HS = 512, TOL = 256;
const HANN = (() => { const w = new Float32Array(N); for (let i = 0; i < N; i++) w[i] = .5 - .5 * Math.cos(2 * Math.PI * i / N); return w; })();

// Estica o tempo (f > 1 = mais longo) sem mudar o tom. Os canais usam as mesmas posições.
export function stretch(chans, f) {
  const len = chans[0].length;
  const outLen = Math.ceil(len * f);
  if (len < N + 2 * TOL + HS) return chans.map(c => c.slice());
  let x = chans[0];
  if (chans.length > 1) { x = new Float32Array(len); for (const c of chans) for (let i = 0; i < len; i++) x[i] += c[i] / chans.length; }
  const pos = [];
  let prev = -1;
  for (let o = 0; ; o += HS) {
    const ideal = Math.round(o / f);
    if (ideal + N + TOL >= len || o + N > outLen + N) break;
    let p0 = ideal;
    if (prev >= 0) {
      const nat = prev + HS; let best = -Infinity, bd = 0;
      for (let d = -TOL; d <= TOL; d += 4) {
        const p = ideal + d; if (p < 0) continue;
        let c = 0; for (let i = 0; i < HS; i += 4) c += x[p + i] * x[nat + i];
        if (c > best) { best = c; bd = d; }
      }
      p0 = Math.max(0, ideal + bd);
    }
    pos.push(p0); prev = p0;
  }
  return chans.map(c => {
    const out = new Float32Array(outLen + N);
    pos.forEach((p, k) => { const o = k * HS; for (let i = 0; i < N; i++) out[o + i] += c[p + i] * HANN[i]; });
    return out.subarray(0, outLen);
  });
}

// Muda o tom em semitons e a velocidade (1 = normal). Devolve novos canais.
export function pitchTempo(chans, semis, speed) {
  const r = Math.pow(2, semis / 12), f = r / speed;
  const y = Math.abs(f - 1) < 1e-6 ? chans : stretch(chans, f);
  if (semis === 0) return y;
  return y.map(c => {
    const L = Math.floor(c.length / r), out = new Float32Array(L);
    for (let i = 0; i < L; i++) { const p = i * r, j = p | 0, fr = p - j; out[i] = c[j] * (1 - fr) + (j + 1 < c.length ? c[j + 1] : 0) * fr; }
    return out;
  });
}

// Recorta [f0, f1) dos pedaços gravados (cada um com o quadro inicial f e canais c). Buracos ficam em silêncio.
export function extract(chunks, f0, f1) {
  if (!chunks.length || f1 <= f0) return null;
  const n = f1 - f0, nc = chunks[0].c.length;
  const out = Array.from({ length: nc }, () => new Float32Array(n));
  for (const ch of chunks) {
    const len = ch.c[0].length;
    const a = Math.max(f0, ch.f), b = Math.min(f1, ch.f + len);
    if (b <= a) continue;
    for (let k = 0; k < nc; k++) out[k].set(ch.c[k].subarray(a - ch.f, b - ch.f), a - f0);
  }
  return out;
}

// Estéreo igual nos dois lados (ou um lado mudo) vira mono, para ocupar metade do espaço.
export function simplify(chans) {
  if (chans.length < 2) return chans;
  const [L, R] = chans; let eL = 0, eR = 0, eD = 0;
  for (let i = 0; i < L.length; i++) { const a = L[i], b = R[i]; eL += a * a; eR += b * b; const d = a - b; eD += d * d; }
  if (eD <= 1e-4 * (eL + eR) + 1e-9) return [L];
  if (eR < .01 * eL) return [L];
  if (eL < .01 * eR) return [R];
  return chans;
}

// Guarda em 16 bits (metade do espaço de 32 bits).
export function toInt16(chans) {
  return chans.map(c => { const a = new Int16Array(c.length); for (let i = 0; i < c.length; i++) { const v = c[i] * 32767; a[i] = v > 32767 ? 32767 : v < -32768 ? -32768 : v; } return a.buffer; });
}
export function fromInt16(bufs) {
  return bufs.map(b => { const a = new Int16Array(b), f = new Float32Array(a.length); for (let i = 0; i < a.length; i++) f[i] = a[i] / 32768; return f; });
}

// Mediana de uma lista de números.
export function median(a) { const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }

// Acha o começo de cada nota tocada junto com os cliques (calibração do atraso).
export function onsetOffsets(chans, sr, f0, clickTimes) {
  const x = chans[0], y = chans[1] || chans[0];
  const offs = [];
  for (const t of clickTimes) {
    const a = Math.max(0, Math.round((t - .15) * sr) - f0), b = Math.min(x.length, Math.round((t + .45) * sr) - f0);
    if (b - a < 10) continue;
    let pk = 0; for (let i = a; i < b; i++) { const v = Math.max(Math.abs(x[i]), Math.abs(y[i])); if (v > pk) pk = v; }
    if (pk < .02) continue;
    const thr = pk * .35;
    for (let i = a; i < b; i++) { if (Math.max(Math.abs(x[i]), Math.abs(y[i])) >= thr) { offs.push((i + f0) / sr - t); break; } }
  }
  return offs;
}

/* ---------- tirar da gravação o som que volta pela USB (retorno) ---------- */
function fft(re, im, inv) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = 2 * Math.PI / len * (inv ? 1 : -1), wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = a + len / 2;
        const xr = re[b] * cr - im[b] * ci, xi = re[b] * ci + im[b] * cr;
        re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi;
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
      }
    }
  }
  if (inv) for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
}

// Atraso do retorno (em amostras): a entrada y[i] contém ref[i + M - lag]. Procura lag em [0, M-80].
export function findLag(y, ref, M, s, W) {
  const Lmax = M - 80;
  let N = 1; while (N < W + Lmax) N <<= 1;
  const xr = new Float64Array(N), xi = new Float64Array(N), yr = new Float64Array(N), yi = new Float64Array(N);
  for (let i = 0; i < W; i++) xr[i] = y[s + i];
  for (let j = 0; j < W + Lmax; j++) { const k = s + M - Lmax + j; yr[j] = k >= 0 && k < ref.length ? ref[k] : 0; }
  fft(xr, xi, false); fft(yr, yi, false);
  for (let i = 0; i < N; i++) { // X * conj(Y), com peso PHAT
    const a = xr[i] * yr[i] + xi[i] * yi[i], b = xi[i] * yr[i] - xr[i] * yi[i];
    const m = Math.hypot(a, b) + 1e-12; xr[i] = a / m; xi[i] = b / m;
  }
  fft(xr, xi, true);
  let best = 0, bk = 0, sum = 0, cnt = 0;
  for (let k = 0; k <= Lmax; k++) { const m = k - Lmax, idx = m < 0 ? N + m : m; const v = Math.abs(xr[idx]); sum += v; cnt++; if (v > best) { best = v; bk = k; } }
  return { lag: bk, sharp: best / (sum / cnt + 1e-12) };
}

function cholSolve(A, b, n) {
  const L = new Float64Array(n * n);
  for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) {
    let s = A[i * n + j]; for (let k = 0; k < j; k++) s -= L[i * n + k] * L[j * n + k];
    if (i === j) { if (s <= 0) return null; L[i * n + i] = Math.sqrt(s); } else L[i * n + j] = s / L[j * n + j];
  }
  const z = new Float64Array(n); for (let i = 0; i < n; i++) { let s = b[i]; for (let k = 0; k < i; k++) s -= L[i * n + k] * z[k]; z[i] = s / L[i * n + i]; }
  const x = new Float64Array(n); for (let i = n - 1; i >= 0; i--) { let s = z[i]; for (let k = i + 1; k < n; k++) s -= L[k * n + i] * x[k]; x[i] = s / L[i * n + i]; }
  return x;
}

// inp: canais gravados (n amostras). ref: [L, R] do que o celular tocou, começando M amostras antes.
// Devolve { out, db, lag } ou null quando não há retorno para tirar.
export function cancelLoopback(inp, ref, M, sr) {
  const n = inp[0].length, T = 64, PRE = 24, P = 2 * T;
  const refL = ref[0], refR = ref[1] || ref[0];
  const mono = new Float32Array(refL.length); for (let i = 0; i < mono.length; i++) mono[i] = .5 * (refL[i] + refR[i]);
  // trecho onde o celular tocou mais alto
  const W = Math.min(n, 1 << 17); if (W < sr * .5) return null;
  let s = 0, bestE = -1; const step = Math.max(1, Math.floor(sr / 4));
  for (let a = 0; a + W <= n; a += step) { let e = 0; for (let i = a; i < a + W; i += 16) { const v = mono[i + M]; e += v * v; } if (e > bestE) { bestE = e; s = a; } }
  if (bestE / (W / 16) < 1e-7) return null;
  const mix = new Float32Array(n); for (const c of inp) for (let i = 0; i < n; i++) mix[i] += c[i] / inp.length;
  const { lag, sharp } = findLag(mix, mono, M, s, W);
  if (sharp < 6) return null;
  const D = lag - PRE;
  const X = [refL, refR];
  const at = (c, j) => (j >= 0 && j < X[c].length ? X[c][j] : 0);
  // correlações (Toeplitz) no trecho escolhido
  const j0 = s + M - D - (T - 1), j1 = s + W + M - D;
  const phi = (c1, c2, tau) => { let acc = 0; for (let j = j0; j < j1; j++) acc += at(c1, j) * at(c2, j + tau); return acc; };
  const pLL = new Float64Array(2 * T - 1), pRR = new Float64Array(2 * T - 1), pLR = new Float64Array(2 * T - 1);
  for (let tau = -(T - 1); tau <= T - 1; tau++) { pLL[tau + T - 1] = phi(0, 0, tau); pRR[tau + T - 1] = phi(1, 1, tau); pLR[tau + T - 1] = phi(0, 1, tau); }
  const A = new Float64Array(P * P);
  for (let c1 = 0; c1 < 2; c1++) for (let t1 = 0; t1 < T; t1++) for (let c2 = 0; c2 < 2; c2++) for (let t2 = 0; t2 < T; t2++) {
    const tau = t1 - t2; let v; // R = Σ X_c1[j] X_c2[j + tau], j = i+M-D-t1
    if (c1 === c2) v = (c1 === 0 ? pLL : pRR)[tau + T - 1]; else if (c1 === 0) v = pLR[tau + T - 1]; else v = pLR[-tau + T - 1];
    A[(c1 * T + t1) * P + (c2 * T + t2)] = v;
  }
  let tr = 0; for (let i = 0; i < P; i++) tr += A[i * P + i];
  const lam = tr / P * 1e-3 + 1e-9; for (let i = 0; i < P; i++) A[i * P + i] += lam;
  const out = [], dbs = [];
  for (const y of inp) {
    const b = new Float64Array(P);
    for (let c = 0; c < 2; c++) for (let t = 0; t < T; t++) { let acc = 0; for (let i = s; i < s + W; i++) acc += y[i] * at(c, i + M - D - t); b[c * T + t] = acc; }
    const w = cholSolve(A, b, P); if (!w) return null;
    const o = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      let est = 0; const base = i + M - D;
      for (let t = 0; t < T; t++) { const j = base - t; if (j >= 0 && j < refL.length) est += w[t] * refL[j] + w[T + t] * refR[j]; }
      o[i] = y[i] - est;
    }
    let ey = 0, eo = 0; for (let i = s; i < s + W; i++) { ey += y[i] * y[i]; eo += o[i] * o[i]; }
    dbs.push(10 * Math.log10((ey + 1e-12) / (eo + 1e-12))); out.push(o);
  }
  const db = Math.max(...dbs);
  if (db < 1) return null;
  return { out, db, lag };
}
