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
