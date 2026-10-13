// Estúdio de Bolso — gravação em faixas no celular.
import { peaksOf, pitchTempo, cancelLoopback, extract, simplify, toInt16, fromInt16, median, onsetOffsets } from './dsp.js';
import * as db from './db.js';
import * as media from './media.js';

const VERSAO = '1.0.2';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const app = $('#app');
const COLORS = ['#f2b33d', '#5cc8c2', '#ef7d6b', '#a99cf0', '#9fc96a', '#e98fc0'];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const hexA = (h, a) => { const n = parseInt(h.slice(1), 16); return `rgba(${n >> 16},${n >> 8 & 255},${n & 255},${a})`; };
const fmtN = (t, d) => { t = Math.max(0, t); const m = Math.floor(t / 60), s = t - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(d); };
const fmt = t => fmtN(t, 1), fmt2 = t => fmtN(t, 2), fmt3 = t => fmtN(t, 3);
const fmt0 = t => { t = Math.max(0, Math.round(t)); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };
const num = (v, d = 1) => v.toFixed(d).replace('.', ',');
function parseTime(s) { s = String(s).trim().replace(',', '.'); if (!s) return null; let t; if (s.includes(':')) { const [m, x] = s.split(':'); t = (+m) * 60 + (+x); } else t = +s; return isFinite(t) && t >= 0 ? t : null; }
const hoje = () => { const d = new Date(); return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0'); };

const I = {
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.2v13.6L19 12z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6.5" y="5" width="4" height="14" rx="1"/><rect x="13.5" y="5" width="4" height="14" rx="1"/></svg>',
  stop: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6.5" y="6.5" width="11" height="11" rx="2"/></svg>',
  start: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="5" width="2.6" height="14" rx="1"/><path d="M19 5.5v13L9 12z"/></svg>',
  loop: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 2l3 3-3 3"/><path d="M4 11V9a4 4 0 0 1 4-4h12"/><path d="M7 22l-3-3 3-3"/><path d="M20 13v2a4 4 0 0 1-4 4H4"/></svg>',
  undo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>',
  cut: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4L8.1 15.9M14.5 14.5L20 20M8.1 8.1L12 12"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
  magnet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M5 4h5v7a2 2 0 0 0 4 0V4h5v7a7 7 0 0 1-14 0z"/><path d="M5 8h5M14 8h5"/></svg>',
  cam: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="2.5" y="6" width="13.5" height="12" rx="2.5"/><path d="M16 10.5l5.5-3.2v9.4L16 13.5z"/></svg>',
  usb: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v14"/><path d="M9 6l3-3 3 3"/><path d="M7 9v3l5 3"/><path d="M17 8v4l-5 3"/><circle cx="12" cy="19.5" r="2"/></svg>',
  metro: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"><path d="M9 3h6l4.5 18h-15z"/><path d="M12 16l5-9"/><path d="M7 15h10"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  music: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/></svg>',
  guitar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3l6 6"/><path d="M18 6l-7.2 7.2"/><path d="M10.6 9.4c-1.8-1.2-4.4-.6-5.6 1.3-.9 1.4-.2 2.6-2 3.7 2.2.2 2.7 3 5 4.5 2.3 1.5 5.3.2 5.9-2.2.4-1.6-.4-2.7.8-3.7"/><circle cx="9" cy="15" r="1"/></svg>',
  more: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13 7l4 4"/></svg>',
  dotrec: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="6" fill="#ff5147"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>'
};

/* ---------------- ajustes do aparelho ---------------- */
const CFG_KEY = 'estudio.cfg';
const cfg = Object.assign({ inputId: '', inputLabel: '', lat: null, vsync: 0, cam: 'back', q: '1080', clean: true }, (() => { try { return JSON.parse(localStorage.getItem(CFG_KEY)) || {}; } catch (e) { return {}; } })());
if (cfg.audioMode !== 2) { if (cfg.lat != null) cfg.recal = true; cfg.lat = null; cfg.audioMode = 2; if (cfg.camLat == null) cfg.camLat = 90; try { localStorage.setItem(CFG_KEY, JSON.stringify(cfg)); } catch (e) { /* ok */ } }
const saveCfg = () => { try { localStorage.setItem(CFG_KEY, JSON.stringify(cfg)); } catch (e) { /* sem espaço */ } };

/* ---------------- modelo ---------------- */
let uid = Date.now();
const nid = () => ++uid;
const FX = { none: { low: 0, mid: 0, high: 0, comp: false, rev: 0, dly: 0 }, limpa: { low: -2, mid: 0, high: 2, comp: true, rev: 25, dly: 0 }, base: { low: -3, mid: 2, high: 1, comp: true, rev: 12, dly: 0 }, solo: { low: -4, mid: 3, high: 2, comp: true, rev: 30, dly: 28 } };
const fxp = n => Object.assign({ preset: n }, FX[n]);
function makeTrack(o) { return Object.assign({ id: nid(), name: 'Faixa', type: 'audio', color: COLORS[0], vol: .8, pan: 0, mute: false, solo: false, arm: false, semis: 0, fx: fxp('none'), takes: [], clips: [] }, o); }
function attachData(take, chans) { take.chans = chans; take.len = chans[0].length; take.dur = take.len / take.sr; take.pk = peaksOf(chans, take.sr); take.proc = new Map(); }
function makeTake(chans, sr, recStart, name) { const k = { id: nid(), name, sr, ch: chans.length, recStart, bytes: Math.round(chans.length * chans[0].length * 2 / 1e5) / 10 }; attachData(k, chans); return k; }
const clipOf = (take, start, dur) => ({ id: nid(), start, offset: 0, dur: dur ?? take.dur, take: take.id });

const S = { projects: [], cur: null, screen: 'projects', pos: 0, sel: null, range: null, punch: true, preroll: 1, loop: false, snap: true, PX: 48, tlLen: 30, sheet: null, recording: null, counting: null, taps: [], level: 0, inputs: [], hear: null };
const P = { playing: false, t0: 0, from: 0, end: 0, speed: 1, metro: false, nextBeat: 0, mode: 'studio' };
const contentEnd = (p = S.cur) => p.tracks.reduce((m, t) => t.clips.reduce((n, c) => Math.max(n, c.start + c.dur), m), 0);
const trackById = id => S.cur.tracks.find(t => t.id === id);
const takeOf = (tr, id) => tr.takes.find(k => k.id === id);
const anySolo = () => S.cur.tracks.some(t => t.solo);
const audible = tr => !tr.mute && (!anySolo() || tr.solo);
const vids = () => S.cur.tracks.filter(t => t.type === 'video');
function takeBytes(k) { return (k.bytes || 0) + (k.video ? k.video.bytes || 0 : 0); }
function projSize(p) { return Math.max(0, Math.round(p.tracks.reduce((a, t) => a + t.takes.reduce((b, k) => b + takeBytes(k), 0), 0))); }
function projLen(p) { return p.tracks.reduce((m, t) => t.clips.reduce((n, c) => Math.max(n, c.start + c.dur), m), 0); }
function selClip() { if (!S.sel) return null; const tr = trackById(S.sel.t); const c = tr && tr.clips.find(c => c.id === S.sel.clip); return c ? { tr, c } : null; }
function loopRange() { if (S.range) return [S.range.a, S.range.b]; const s = selClip(); return s ? [s.c.start, s.c.start + s.c.dur] : [0, contentEnd()]; }
function pushUndo() { const u = S.cur.undo; u.push(S.cur.tracks.map(t => ({ id: t.id, clips: t.clips.map(c => ({ ...c })) }))); if (u.length > 40) u.shift(); }

/* ---------------- gravar no celular ---------------- */
const SKIP = new Set(['_n', 'chans', 'proc', 'pk', 'vurl', 'undo', 'loaded', 'len']);
const projJSON = p => JSON.parse(JSON.stringify(p, (k, v) => SKIP.has(k) ? undefined : v));
let saveT = 0;
function dirty() { if (!S.cur) return; clearTimeout(saveT); const p = S.cur; p.updated = Date.now(); saveT = setTimeout(() => saveProject(p), 500); }
async function saveProject(p) { try { await db.put('proj', p.id, projJSON(p)); } catch (e) { toast('Não deu para salvar o projeto. O celular pode estar sem espaço.'); } }
async function saveTakeAudio(k) { await db.put('pcm', k.id, { sr: k.sr, chans: toInt16(k.chans) }); }
async function deleteTakeData(k) { try { await db.del('pcm', k.id); if (k.video) await db.del('vid', k.id); } catch (e) { /* já apagado */ } if (k.vurl) URL.revokeObjectURL(k.vurl); }
async function loadProjectData(p) {
  for (const tr of p.tracks) for (const k of tr.takes) {
    if (!k.chans) {
      const rec = await db.get('pcm', k.id);
      if (rec) attachData(k, fromInt16(rec.chans)); else attachData(k, [new Float32Array(Math.max(1, Math.round((k.dur || 1) * k.sr)))]);
    }
    if (k.video && !k.vurl) { const b = await db.get('vid', k.id); if (b) k.vurl = URL.createObjectURL(b); }
  }
  p.undo = p.undo || []; p.loaded = true;
}
function unloadProject(p) { if (!p) return; p.tracks.forEach(tr => tr.takes.forEach(k => { if (k.vurl) URL.revokeObjectURL(k.vurl); delete k.vurl; delete k.chans; delete k.proc; delete k.pk; })); p.loaded = false; }

/* ---------------- áudio ---------------- */
let ctx = null; const bus = {}; let live = [];
function ensureCtx() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'playback' });
    bus.master = ctx.createGain(); bus.master.gain.value = .85;
    const lim = ctx.createDynamicsCompressor(); lim.threshold.value = -4; lim.ratio.value = 20; lim.attack.value = .003; lim.release.value = .15;
    bus.out = ctx.createGain(); bus.master.connect(lim); lim.connect(bus.out); bus.out.connect(ctx.destination);
    const rev = ctx.createConvolver(); const L = Math.round(2.2 * ctx.sampleRate), ir = ctx.createBuffer(2, L, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < L; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / L, 2.5); }
    rev.buffer = ir; bus.revIn = ctx.createGain(); bus.revIn.connect(rev); rev.connect(bus.master);
    bus.dly = ctx.createDelay(2); bus.dlyIn = ctx.createGain(); const fb = ctx.createGain(); fb.gain.value = .32; const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3000;
    bus.dlyIn.connect(bus.dly); bus.dly.connect(lp); lp.connect(fb); fb.connect(bus.dly); lp.connect(bus.master);
  }
  if (ctx.state === 'suspended') ctx.resume();
}
function setDelay(sp) { if (ctx && S.cur) bus.dly.delayTime.value = Math.min(1.9, 60 / (S.cur.bpm * sp) * .75); }
function mkChain(tr) {
  const n = { lo: ctx.createBiquadFilter(), mid: ctx.createBiquadFilter(), hi: ctx.createBiquadFilter(), comp: ctx.createDynamicsCompressor(), g: ctx.createGain(), pan: ctx.createStereoPanner(), rs: ctx.createGain(), ds: ctx.createGain() };
  n.lo.type = 'lowshelf'; n.lo.frequency.value = 200; n.mid.type = 'peaking'; n.mid.frequency.value = 900; n.mid.Q.value = .9; n.hi.type = 'highshelf'; n.hi.frequency.value = 3500;
  n.lo.connect(n.mid); n.mid.connect(n.hi); n.hi.connect(n.comp); n.comp.connect(n.g); n.g.connect(n.pan); n.pan.connect(bus.master); n.pan.connect(n.rs); n.rs.connect(bus.revIn); n.pan.connect(n.ds); n.ds.connect(bus.dlyIn);
  tr._n = n; applyTr(tr, true); return n;
}
function applyTr(tr, now) {
  const n = tr._n; if (!n || !ctx) return; const f = tr.fx, T = ctx.currentTime;
  const set = (p, v) => now ? p.setValueAtTime(v, T) : p.setTargetAtTime(v, T, .03);
  set(n.lo.gain, f.low); set(n.mid.gain, f.mid); set(n.hi.gain, f.high);
  n.comp.threshold.value = f.comp ? -18 : 0; n.comp.ratio.value = f.comp ? 3 : 1; n.comp.knee.value = f.comp ? 6 : 0;
  set(n.g.gain, audible(tr) ? tr.vol : 0); set(n.pan.pan, tr.pan); set(n.rs.gain, f.rev / 100 * .7); set(n.ds.gain, f.dly / 100 * .45);
}
const applyAll = () => S.cur.tracks.forEach(t => applyTr(t));
const pkey = (s, sp) => s + '|' + sp;
function getAB(take, semis, sp) {
  if (!take || !take.chans) return null;
  const k = pkey(semis, sp); let e = take.proc.get(k);
  if (!e) { if (semis === 0 && sp === 1) { e = { chans: take.chans }; take.proc.set(k, e); } else return null; }
  if (!e.ab) { e.ab = ctx.createBuffer(e.chans.length, e.chans[0].length, take.sr); e.chans.forEach((c, i) => e.ab.copyToChannel(c, i)); }
  return e.ab;
}
let worker = null, wid = 0; const wjobs = new Map();
let workerBroken = false;
function runJob(msg, fallback) {
  if (workerBroken) return Promise.resolve().then(fallback);
  try {
    if (!worker) {
      worker = new Worker(new URL('./dsp-worker.js', import.meta.url), { type: 'module' });
      worker.onmessage = e => { const j = wjobs.get(e.data.id); if (!j) return; wjobs.delete(e.data.id); if (e.data.error) j.rej(new Error(e.data.error)); else j.res(e.data.out); };
      worker.onerror = () => { workerBroken = true; wjobs.forEach(j => j.rej(new Error('worker'))); wjobs.clear(); };
    }
    return new Promise((res, rej) => { const id = ++wid; wjobs.set(id, { res, rej }); worker.postMessage({ id, ...msg }); }).catch(() => fallback());
  } catch (e) { workerBroken = true; return Promise.resolve().then(fallback); }
}
const runPitch = (chans, semis, speed) => runJob({ kind: 'pitch', chans, semis, speed }, () => pitchTempo(chans, semis, speed));
const runClean = (inp, ref, M, sr) => runJob({ kind: 'clean', inp, ref, M, sr }, () => { const r = cancelLoopback(inp, ref, M, sr); return r && { chans: r.out, db: r.db, lag: r.lag }; });
async function ensureProcessed(sp, only) {
  const need = [];
  (only ? [only] : S.cur.tracks).forEach(tr => {
    const used = new Set(tr.clips.map(c => c.take));
    tr.takes.forEach(k => { if (k.chans && (only || used.has(k.id)) && !(tr.semis === 0 && sp === 1) && !k.proc.has(pkey(tr.semis, sp))) need.push([k, tr.semis]); });
  });
  if (!need.length) return;
  toast('Ajustando tom e velocidade…', 0);
  for (const [k, s] of need) {
    const out = await runPitch(k.chans, s, sp);
    k.proc.set(pkey(s, sp), { chans: out });
    if (k.proc.size > 3) k.proc.delete(k.proc.keys().next().value);
  }
  hideToast();
}
function click(time, acc) {
  const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = acc ? 1760 : 1100;
  g.gain.setValueAtTime(.0001, time); g.gain.exponentialRampToValueAtTime(acc ? .5 : .3, time + .002); g.gain.exponentialRampToValueAtTime(.0001, time + .05);
  o.connect(g); g.connect(bus.out); o.start(time); o.stop(time + .06); live.push(o);
}
function stopSources() {
  live.forEach(s => { try { s.stop(); } catch (e) { /* parado */ } }); live = [];
  if (S.cur) S.cur.tracks.forEach(tr => { if (tr._n) { try { tr._n.pan.disconnect(); } catch (e) { /* ok */ } tr._n = null; } });
}
function curPos() { return P.playing ? Math.max(P.from, P.from + (ctx.currentTime - P.t0) * P.speed) : S.pos; }
function startAt(from, o = {}) {
  ensureCtx(); stopSources(); const p = S.cur; const sp = o.speed ?? p.speed; const t0 = o.when ?? ctx.currentTime + .06;
  Object.assign(P, { playing: true, t0, from, speed: sp, end: o.end ?? contentEnd(), metro: !o.noMetro && p.metro === 'all', nextBeat: Math.ceil(from / (60 / p.bpm) - 1e-6), mode: o.mode || 'studio' });
  setDelay(sp);
  p.tracks.forEach(tr => {
    const n = mkChain(tr);
    tr.clips.forEach(c => {
      const end = c.start + c.dur; if (end <= from + .001) return; if (o.end != null && c.start >= o.end) return;
      const ab = getAB(takeOf(tr, c.take), tr.semis, sp); if (!ab) return;
      const a = Math.max(c.start, from); let dur = (end - a) / sp; if (o.end != null) dur = Math.min(dur, (o.end - a) / sp); if (dur <= 0) return;
      const src = ctx.createBufferSource(); src.buffer = ab; src.connect(n.lo); src.start(t0 + (a - from) / sp, (c.offset + (a - c.start)) / sp, dur); live.push(src);
    });
  });
  S.pos = from; wake(true); refreshTransport();
}
function stopPlay() { if (!P.playing) return; S.pos = curPos(); P.playing = false; stopSources(); wake(false); refreshTransport(); }
let restarting = false, restartAgain = false, restartAt = 0;
async function restartIfPlaying() {
  if (restarting) { restartAgain = true; return; }
  if (!(P.playing && P.mode === 'studio' && !S.recording)) return;
  restarting = true; restartAt = curPos(); stopPlay();
  try { do { restartAgain = false; await ensureProcessed(S.cur.speed); } while (restartAgain); }
  finally { restarting = false; }
  if (S.screen === 'studio' && !S.recording) startAt(restartAt);
}

let wl = null;
async function wake(on) { try { if (on && !wl && navigator.wakeLock) { wl = await navigator.wakeLock.request('screen'); wl.addEventListener('release', () => { wl = null; }); } else if (!on && wl && !S.recording) { await wl.release(); wl = null; } } catch (e) { wl = null; } }

/* ---------------- entrada e câmera ---------------- */
let mic = null, cam = null, recChunks = [], recDone = null, refNode = null, refChunks = [], refDone = null;
function onRecMsg(e) { const m = e.data; if (m.lv != null) S.level = Math.max(m.lv, S.level * .8); else if (m.f != null) recChunks.push(m); else if (m.done && recDone) { recDone(); recDone = null; } }
async function refreshInputs() { try { S.inputs = await media.listInputs(); } catch (e) { S.inputs = []; } }
async function ensureMic() {
  ensureCtx();
  if (mic && mic.track.readyState === 'live') return mic;
  try {
    if (!cfg.inputId) { await refreshInputs(); const u = media.guessUsb(S.inputs); if (u) { cfg.inputId = u.deviceId; cfg.inputLabel = u.label; } }
    mic = await media.openMic(ctx, cfg.inputId);
    mic.node.port.onmessage = onRecMsg;
    if (!refNode) {
      refNode = new AudioWorkletNode(ctx, 'rec', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1], channelCount: 2, channelCountMode: 'explicit', channelInterpretation: 'speakers' });
      const z = ctx.createGain(); z.gain.value = 0; bus.out.connect(refNode); refNode.connect(z); z.connect(ctx.destination);
      refNode.port.onmessage = e => { const m = e.data; if (m.f != null) refChunks.push(m); else if (m.done && refDone) { refDone(); refDone = null; } };
    }
    mic.track.addEventListener('ended', () => { mic = null; toast('A entrada de áudio desligou. Confira o cabo do Cuvave.'); if (S.screen === 'studio') renderStudio(); });
    await refreshInputs();
    const cur = S.inputs.find(d => d.deviceId === (mic.settings.deviceId || cfg.inputId));
    cfg.inputLabel = (cur && cur.label) || mic.label || ''; if (mic.settings.deviceId) cfg.inputId = mic.settings.deviceId; saveCfg();
    if (S.screen === 'studio') renderStudio();
    return mic;
  } catch (e) {
    mic = null;
    toast(e.name === 'NotAllowedError' ? 'O app precisa de permissão para usar a entrada de áudio. Libere nas permissões do site.' : 'Não consegui abrir a entrada de áudio. Confira o Cuvave na USB.', 5000);
    throw e;
  }
}
function closeMicNow() { media.closeMic(mic); mic = null; S.level = 0; }
async function ensureCam() {
  if (cam && cam.getVideoTracks()[0] && cam.getVideoTracks()[0].readyState === 'live') return cam;
  try { cam = await media.openCam(cfg.cam, cfg.q); return cam; }
  catch (e) { cam = null; toast(e.name === 'NotAllowedError' ? 'O app precisa de permissão para usar a câmera.' : 'Não consegui abrir a câmera.', 4500); throw e; }
}
function closeCamNow() { media.closeCam(cam); cam = null; const mv = $('#mv'); if (mv) mv.srcObject = null; }
function camInfo() { const t = cam && cam.getVideoTracks()[0]; if (!t) return ''; const s = t.getSettings(); return s.width ? `${s.width} × ${s.height}, ${Math.round(s.frameRate || 30)} quadros/s` : ''; }
function estLat() { const out = ctx ? ((ctx.outputLatency || 0) + (ctx.baseLatency || 0)) : .03; const inp = mic && mic.settings.latency ? mic.settings.latency : .01; return Math.round((out + inp) * 1000); }
const latMs = () => cfg.lat != null ? cfg.lat : estLat();
async function syncArmed() {
  const arm = S.cur && S.cur.tracks.find(t => t.arm);
  if (arm) { try { await ensureMic(); } catch (e) { return; } if (arm.type === 'video') { try { await ensureCam(); } catch (e) { /* aviso já dado */ } } else closeCamNow(); }
  else closeCamNow();
}

/* ---------------- telas ---------------- */
function render() { if (S.screen === 'projects') renderProjects(); else renderStudio(); renderSheet(); }

function renderProjects() {
  const list = [...S.projects].sort((a, b) => (b.updated || 0) - (a.updated || 0));
  const total = list.reduce((a, p) => a + projSize(p), 0);
  app.innerHTML = `<header class="bar"><div class="brand"><i></i>Estúdio de Bolso</div>${instEvt ? '<button class="btn-acc" data-act="install">Instalar app</button>' : ''}</header>
  <main class="plist">
    ${list.length ? `<div class="sec">Projetos neste celular</div>
    ${list.map(p => { const v = p.tracks.filter(t => t.type === 'video').length; return `<div class="pc" data-act="open" data-p="${p.id}" role="button" tabindex="0"><span class="pthumb" style="background:${hexA(COLORS[p.tracks.length % COLORS.length], .15)}">${v ? I.cam : I.guitar}</span><div class="pinfo"><b>${esc(p.name)}</b><small>${p.tracks.length} faixa${p.tracks.length === 1 ? '' : 's'}${v ? ` · ${v} com vídeo` : ''} · ${fmt0(projLen(p))}</small><small class="psize">${p.date || ''} · ${projSize(p)} MB</small></div><button class="ib" data-act="projMenu" data-p="${p.id}" aria-label="Opções do projeto">${I.more}</button></div>`; }).join('')}
    <div class="store"><span>Ocupado pelos projetos</span><b>${total} MB</b></div>
    <p class="note">Os projetos ficam só neste celular. Depois de postar, apague o projeto para liberar espaço.</p>`
    : `<div class="empty-home"><b>Nenhum projeto ainda</b><p class="note">Crie um projeto, ligue o Cuvave na USB e grave a primeira faixa.</p></div>`}
  </main>
  <div class="foot"><button class="btn-acc big" data-act="newProj">+ Novo projeto</button></div>`;
}

function headerInner(tr) {
  const pan = tr.pan === 0 ? 'C' : (tr.pan < 0 ? 'E' : 'D') + Math.round(Math.abs(tr.pan) * 100);
  return `<div class="tn"><i class="dot" style="background:${tr.color}"></i><span>${esc(tr.name)}</span>${tr.type === 'video' ? I.cam : tr.type === 'import' ? I.music : ''}</div>
  <div class="tsub">${Math.round(tr.vol * 100)}% · ${pan}${tr.semis ? ` · ${tr.semis > 0 ? '+' : ''}${tr.semis}st` : ''}</div>
  <div class="tb">${tr.type === 'import' ? '' : `<button class="tg r${tr.arm ? ' on' : ''}" data-act="arm" data-t="${tr.id}" aria-label="Gravar nesta faixa">R</button>`}<button class="tg m${tr.mute ? ' on' : ''}" data-act="mute" data-t="${tr.id}" aria-label="Mudo">M</button><button class="tg s${tr.solo ? ' on' : ''}" data-act="solo" data-t="${tr.id}" aria-label="Solo">S</button></div>`;
}
function metroLabel() { const p = S.cur; return p.metro === 'off' ? 'sem metrônomo' : p.metro === 'count' ? 'contagem' : 'metrônomo'; }
function inputLabel() { if (!mic) return cfg.inputLabel ? cfg.inputLabel.slice(0, 22) : 'Entrada de áudio'; return (cfg.inputLabel || mic.label || 'Entrada').slice(0, 22); }

function renderStudio() {
  const p = S.cur; const old = $('#tl'); const sl = old ? old.scrollLeft : 0, st = old ? old.scrollTop : 0;
  S.tlLen = Math.max(30, contentEnd() + 12, S.recording ? curPos() + 20 : 0); const W = Math.round(S.tlLen * S.PX);
  const sc = selClip(); if (!sc) S.sel = null;
  app.innerHTML = `<header class="bar"><button class="ib" data-act="home" aria-label="Projetos">${I.back}</button>
    <div class="ttl"><b>${esc(p.name)}</b><small>${p.tracks.length} faixa${p.tracks.length === 1 ? '' : 's'} · ${fmt0(contentEnd())}</small></div>
    <button class="ib" data-act="undo" id="undoBtn" aria-label="Desfazer"${p.undo.length ? '' : ' disabled'}>${I.undo}</button>
    <button class="btn-acc" data-act="toExport">Exportar</button></header>
  <section class="monitor"><div class="mleft"><button class="time" data-act="goto" aria-label="Ir para um tempo exato"><span id="tTime">0:00.00</span>${I.edit}</button><div class="beatl" id="tBeat"></div>
    <div class="chips"><button class="chip" data-act="tempo">${I.metro}♩ ${p.bpm} · ${metroLabel()}${p.speed < 1 ? ` · ${Math.round(p.speed * 100)}%` : ''}</button><button class="chip" data-act="settings">${I.usb}${esc(inputLabel())}</button></div>
    <div class="lvl" id="lvlWrap"${mic ? '' : ' hidden'}><i id="lvl"></i></div></div>
    <div class="mright"><div class="mv${S.big ? ' big' : ''}" data-act="bigView" role="button" tabindex="0" aria-label="Aumentar o vídeo"><video id="mv" muted playsinline></video><span class="mvhint">Toque para diminuir</span><span class="mvnone" id="mvNone">sem vídeo</span><span class="mvtag" id="mvTag" hidden></span></div><div class="mlab" id="monLab"></div></div></section>
  <div class="tlwrap"><div class="tl" id="tl"><div class="tlin" style="width:calc(var(--thw) + ${W}px)">
    <div class="row ruler"><div class="th"><button class="zb" data-act="zoom" data-v="-1" aria-label="Afastar">−</button><button class="zb" data-act="zoom" data-v="1" aria-label="Aproximar">+</button></div><canvas class="lane grab" id="ruler"></canvas></div>
    ${p.tracks.map(tr => `<div class="row" id="row-${tr.id}"><div class="th" data-act="trackSheet" data-t="${tr.id}" role="button" tabindex="0" id="th-${tr.id}">${headerInner(tr)}</div><canvas class="lane${S.sel && S.sel.t === tr.id ? ' grab' : ''}" data-t="${tr.id}"></canvas></div>`).join('')}
    <div class="row addrow"><div class="th"><button class="addbtn" data-act="addTrack">+ Faixa</button></div></div>
    <div class="ph" id="ph"></div><div class="recbox" id="recbox" hidden></div><div class="rangebox" id="rangebox" hidden></div>
  </div></div>
  ${p.tracks.length ? '' : `<div class="empty"><p>Comece por uma faixa.</p>${addOptions()}</div>`}
  <div class="count" id="count" hidden></div></div>
  ${sc ? `<div class="ct"><span class="hint">${esc(sc.tr.name)} · ${fmt(sc.c.start)} a ${fmt(sc.c.start + sc.c.dur)} · arraste para mover, puxe as bordas para cortar</span><div class="tools">
    <button class="tool" data-act="split">${I.cut}Dividir no cursor</button><button class="tool${S.snap ? ' on' : ''}" data-act="snap">${I.magnet}Ímã</button><button class="tool del" data-act="delClip">${I.trash}Apagar</button><button class="tool" data-act="desel">${I.check}Pronto</button></div></div>`
    : S.range ? `<div class="ct"><button class="hint" data-act="rangeSheet">Trecho ${fmt3(S.range.a)} → ${fmt3(S.range.b)} · ${num(S.range.b - S.range.a, 2)} s</button><div class="tools">
    <button class="tool" data-act="rangeSheet">${I.edit}Ajustar</button><button class="tool${S.punch ? ' on' : ''}" data-act="punch">${I.dotrec}Gravar só aqui</button><button class="tool" data-act="clearRange">${I.close}Limpar</button></div></div>` : ''}
  <nav class="transport"><button class="tbtn" data-act="toStart" aria-label="Voltar ao início">${I.start}</button><button class="tbtn play" data-act="play" id="playBtn" aria-label="Tocar">${I.play}</button><button class="tbtn rec" data-act="rec" id="recBtn" aria-label="Gravar"><i></i></button><button class="tbtn${S.loop ? ' on' : ''}" data-act="loop" aria-label="Repetir">${I.loop}</button></nav>`;
  const tl = $('#tl');
  const ru = $('#ruler'); drawRuler(ru, W); let rs = null; const rT = e => Math.max(0, (e.clientX - ru.getBoundingClientRect().left) / S.PX);
  ru.onpointerdown = e => { if (S.recording || S.counting) return; rs = { x: e.clientX, T0: rT(e), moving: false }; ru.setPointerCapture(e.pointerId); };
  ru.onpointermove = e => { if (!rs) return; if (!rs.moving && Math.abs(e.clientX - rs.x) < 6) return; rs.moving = true; const T = rT(e); S.range = { a: Math.min(rs.T0, T), b: Math.max(rs.T0, T) }; drawRuler(ru, W); updRangeBox(); };
  ru.onpointerup = () => { if (!rs) return; const r = rs; rs = null; if (!r.moving) { seek(r.T0); return; } if (S.range && S.range.b - S.range.a < .03) S.range = null; S.sel = null; renderStudio(); if (S.range) toast('Trecho marcado. Toque em Ajustar para acertar no detalhe.'); };
  ru.onpointercancel = () => { rs = null; }; updRangeBox();
  $$('canvas.lane[data-t]').forEach(cv => { const tr = trackById(+cv.dataset.t); drawLane(cv, tr); cv.onpointerdown = e => laneDown(e, cv, tr); cv.onpointermove = e => laneMove(e, cv, tr); cv.onpointerup = e => laneUp(e, cv, tr); cv.onpointercancel = () => { tap = null; drag = null; }; });
  tl.scrollLeft = sl; tl.scrollTop = st;
  const mv = $('#mv'); mv.addEventListener('loadedmetadata', () => { if (mv.duration === Infinity) { mv.currentTime = 1e7; mv.addEventListener('timeupdate', function f() { mv.removeEventListener('timeupdate', f); mv.currentTime = 0; }); } });
  refreshTransport(); frameStudio(true); dirty();
}
let tap = null, drag = null;
function updRangeBox() { const rb = $('#rangebox'); if (!rb) return; if (!S.range) { rb.hidden = true; return; } rb.hidden = false; rb.style.left = `calc(var(--thw) + ${S.range.a * S.PX}px)`; rb.style.width = Math.max(1, (S.range.b - S.range.a) * S.PX) + 'px'; }
function showPos() { frameStudio(true); const tl = $('#tl'); if (!tl) return; const x = S.pos * S.PX, vw = tl.clientWidth - 104; if (x < tl.scrollLeft || x > tl.scrollLeft + vw - 20) tl.scrollLeft = x - vw / 2; }
function fixRange(k) { const R = S.range; if (R.b - R.a < .01) { if (k === 'a') R.a = R.b - .01; else R.b = R.a + .01; } R.a = Math.max(0, +R.a.toFixed(3)); R.b = +R.b.toFixed(3); }
const recNow = p => !!(S.recording && !S.counting && p >= S.recording.start && (S.recording.end == null || p <= S.recording.end));

function laneDpr(W) { return Math.max(.25, Math.min(window.devicePixelRatio || 1, 2, 15000 / Math.max(1, W))); }
function drawRuler(cv, W) {
  const H = 28, d = laneDpr(W); cv.width = Math.round(W * d); cv.height = H * d; cv.style.width = W + 'px'; cv.style.height = H + 'px'; const g = cv.getContext('2d'); g.setTransform(d, 0, 0, d, 0, 0);
  const spb = 60 / S.cur.bpm * S.PX;
  if (S.range) { const a = S.range.a, b = S.range.b; g.fillStyle = 'rgba(242,179,61,.18)'; g.fillRect(a * S.PX, 0, (b - a) * S.PX, H); g.fillStyle = '#f2b33d'; g.fillRect(a * S.PX, H - 3, (b - a) * S.PX, 3); }
  g.font = '500 10.5px "IBM Plex Mono",monospace'; g.textBaseline = 'middle';
  for (let i = 0; i * spb < W; i++) { const x = Math.round(i * spb) + .5; if (i % 4 === 0) { g.fillStyle = '#8f96a3'; g.fillRect(x - .5, 10, 1, 18); g.fillText(String(i / 4 + 1), x + 4, 13); } else if (spb > 9) { g.fillStyle = '#3a404b'; g.fillRect(x - .5, 20, 1, 8); } }
}
function drawLane(cv, tr) {
  const W = Math.round(S.tlLen * S.PX), H = 63, d = laneDpr(W); cv.width = Math.round(W * d); cv.height = Math.round(H * d); cv.style.width = W + 'px'; cv.style.height = H + 'px'; const g = cv.getContext('2d'); g.setTransform(d, 0, 0, d, 0, 0);
  const spb = 60 / S.cur.bpm * S.PX;
  for (let i = 0; i * spb < W; i++) { if (i % 4 && spb < 10) continue; g.fillStyle = i % 4 ? 'rgba(255,255,255,.025)' : 'rgba(255,255,255,.07)'; g.fillRect(Math.round(i * spb), 0, 1, H); }
  g.globalAlpha = audible(tr) ? 1 : .35;
  tr.clips.forEach(c => {
    const take = takeOf(tr, c.take); if (!take || !take.pk) return; const x0 = c.start * S.PX, w = c.dur * S.PX; const sel = S.sel && S.sel.clip === c.id;
    g.fillStyle = hexA(tr.color, sel ? .3 : .17); g.beginPath(); g.roundRect(x0 + .5, 3.5, Math.max(1, w - 1), H - 7, 6); g.fill(); g.strokeStyle = hexA(tr.color, sel ? 1 : .6); g.lineWidth = sel ? 2 : 1; g.stroke();
    const pk = take.pk, mid = H / 2 + 2, amp = (H - 22) / 2 * (.9 / pk.pk); g.fillStyle = hexA(tr.color, .95);
    const a = Math.max(0, Math.ceil(x0 + 2)), b = Math.min(W, Math.floor(x0 + w - 2));
    for (let px = a; px < b; px++) {
      const u = c.offset + (px / S.PX - c.start); const i0 = Math.floor(u * pk.rate), i1 = Math.max(i0 + 1, Math.floor((u + 1 / S.PX) * pk.rate)); let mn = 0, mx = 0;
      for (let i = Math.max(0, i0); i < i1 && i < pk.mn.length; i++) { if (pk.mn[i] < mn) mn = pk.mn[i]; if (pk.mx[i] > mx) mx = pk.mx[i]; }
      const y1 = mid - mx * amp, y2 = mid - mn * amp; g.fillRect(px, y1, 1, Math.max(1, y2 - y1));
    }
    if (w > 46) { g.fillStyle = 'rgba(236,232,223,.8)'; g.font = '500 10px "IBM Plex Mono",monospace'; g.textBaseline = 'top'; g.fillText(take.name, x0 + 6, 7); }
    if (take.video) { g.fillStyle = hexA(tr.color, .5); for (let px = x0 + 6; px < x0 + w - 8; px += 9) g.fillRect(px, H - 10, 4, 3); }
    if (sel) { g.fillStyle = tr.color; g.beginPath(); g.roundRect(x0 + 3, H / 2 - 12, 4, 24, 2); g.fill(); g.beginPath(); g.roundRect(x0 + w - 7, H / 2 - 12, 4, 24, 2); g.fill(); }
  });
  g.globalAlpha = 1;
}
function clipAt(tr, T) { for (let i = tr.clips.length - 1; i >= 0; i--) { const c = tr.clips[i]; if (T >= c.start && T <= c.start + c.dur) return c; } return null; }
const snapT = t => { if (!S.snap) return t; const g = 60 / S.cur.bpm / 2; return Math.round(t / g) * g; };
function laneDown(e, cv, tr) {
  const x = e.clientX - cv.getBoundingClientRect().left, T = x / S.PX; const c = clipAt(tr, T);
  if (c && S.sel && S.sel.clip === c.id) {
    const l = x - c.start * S.PX, r = (c.start + c.dur) * S.PX - x; const mode = (l < 18 && c.dur * S.PX > 44) ? 'l' : (r < 18 && c.dur * S.PX > 44) ? 'r' : 'm';
    drag = { c, tr, cv, mode, x0: e.clientX, start: c.start, offset: c.offset, dur: c.dur, moved: false, pushed: false, T }; cv.setPointerCapture(e.pointerId); e.preventDefault();
  } else tap = { x: e.clientX, y: e.clientY, c, T };
}
function laneMove(e, cv, tr) {
  if (!drag) return; const px = e.clientX - drag.x0; if (!drag.moved && Math.abs(px) < 4) return; if (!drag.pushed) { pushUndo(); drag.pushed = true; } drag.moved = true;
  const dx = px / S.PX, c = drag.c, take = takeOf(tr, c.take);
  if (drag.mode === 'm') c.start = Math.max(0, snapT(Math.max(0, drag.start + dx)));
  else if (drag.mode === 'l') { let d = snapT(drag.start + dx) - drag.start; d = clamp(d, -drag.offset, drag.dur - .1); c.start = drag.start + d; c.offset = drag.offset + d; c.dur = drag.dur - d; }
  else { const nd = snapT(drag.start + drag.dur + dx) - drag.start; c.dur = clamp(nd, .1, take.dur - drag.offset); }
  drawLane(cv, tr);
}
function laneUp(e, cv, tr) {
  if (drag) { const d = drag; drag = null; if (d.moved) { tr.clips.sort((a, b) => a.start - b.start); renderStudio(); } else seek(d.T); return; }
  if (tap && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) < 10) { if (tap.c) { S.sel = { t: tr.id, clip: tap.c.id }; renderStudio(); } else { if (S.sel) { S.sel = null; renderStudio(); } seek(tap.T); } }
  tap = null;
}
function seek(T) { T = clamp(T, 0, S.tlLen); if (S.recording || S.counting) return; if (P.playing && P.mode === 'studio') startAt(T); else S.pos = T; frameStudio(true); }

/* monitor: câmera ao vivo ou o vídeo gravado, sincronizado com a música */
function monTrack() { const v = vids(); if (!v.length) return null; const pos = curPos(); return v.find(t => t.arm) || (S.sel && v.find(t => t.id === S.sel.t)) || v.find(t => t.clips.some(c => pos >= c.start && pos < c.start + c.dur)) || v[0]; }
const outLat = () => ctx ? (ctx.outputLatency || ctx.baseLatency || 0) : 0;
function videoTimeAt(take, c, t) { const u = c.offset + (t - c.start); return take.recStart + u - take.video.t0 - (take.video.sync || 0) / 1000; }
function syncMonitor(p) {
  const mv = $('#mv'); if (!mv) return;
  const tr = monTrack(); const none = $('#mvNone'), tag = $('#mvTag'), lab = $('#monLab');
  const recThis = !!(S.recording && tr && tr.id === S.recording.t);
  const s = tr ? (recThis && recNow(p) ? 'Gravando: ' : '') + tr.name : 'Sem faixa de vídeo'; if (lab.textContent !== s) lab.textContent = s;
  const liveCam = !!(tr && tr.arm && cam && (!P.playing || recThis));
  if (liveCam) {
    if (mv.srcObject !== cam) { mv.removeAttribute('src'); delete mv.dataset.u; mv.srcObject = cam; mv.play().catch(() => { }); }
    none.hidden = true; tag.hidden = false; const rec = recThis && recNow(p); tag.textContent = rec ? 'REC' : 'CÂMERA'; tag.classList.toggle('rec', rec); return;
  }
  tag.hidden = true;
  if (mv.srcObject) mv.srcObject = null;
  const c = tr && tr.clips.find(c => p >= c.start && p < c.start + c.dur); const take = c && takeOf(tr, c.take);
  if (!take || !take.video || !take.vurl) { none.textContent = tr ? 'sem imagem' : 'sem vídeo'; none.hidden = false; if (!mv.paused) mv.pause(); mv.style.visibility = 'hidden'; return; }
  const vt = videoTimeAt(take, c, p);
  if (vt < 0 || vt > take.video.dur + .3) { none.textContent = 'sem imagem'; none.hidden = false; mv.style.visibility = 'hidden'; if (!mv.paused) mv.pause(); return; }
  none.hidden = true; mv.style.visibility = 'visible';
  if (mv.dataset.u !== take.vurl) { mv.src = take.vurl; mv.dataset.u = take.vurl; }
  if (mv.readyState < 1) return;
  if (P.playing) {
    if (mv.paused) { if (!mv.seeking) mv.currentTime = vt; mv.playbackRate = P.speed; mv.play().catch(() => { }); return; }
    if (mv.seeking) return;
    const diff = mv.currentTime - vt;
    if (Math.abs(diff) > .6) { mv.currentTime = vt; mv.playbackRate = P.speed; }
    else if (Math.abs(diff) > .03) mv.playbackRate = P.speed * clamp(1 - diff * 1.5, .75, 1.25);
    else if (mv.playbackRate !== P.speed) mv.playbackRate = P.speed;
  }
  else { if (!mv.paused) mv.pause(); if (Math.abs(mv.currentTime - vt) > .04 && !mv.seeking) mv.currentTime = vt; }
}
function frameStudio() {
  const t = $('#tTime'); if (!t) return; const p = curPos(); t.textContent = fmt2(p); t.parentNode.classList.toggle('rec', recNow(p));
  const spb = 60 / S.cur.bpm, b = Math.floor(p / spb + 1e-6); $('#tBeat').textContent = `Compasso ${Math.floor(b / 4) + 1} · tempo ${b % 4 + 1}`;
  const x = p * S.PX; $('#ph').style.left = `calc(var(--thw) + ${x}px)`;
  const tl = $('#tl'); if (P.playing && P.mode === 'studio') { const vw = tl.clientWidth - 104; if (x > tl.scrollLeft + vw - 30 || x < tl.scrollLeft) tl.scrollLeft = x - 40; }
  const rb = $('#recbox');
  if (S.recording && !S.counting && p >= S.recording.start) { const row = $('#row-' + S.recording.t); rb.hidden = false; rb.style.left = `calc(var(--thw) + ${S.recording.start * S.PX}px)`; rb.style.width = Math.max(2, (Math.min(p, S.recording.end ?? p) - S.recording.start) * S.PX) + 'px'; rb.style.top = (row.offsetTop + 4) + 'px'; if (p > S.tlLen - 4) renderStudio(); }
  else rb.hidden = true;
  const cn = $('#count');
  if (S.counting) { const k = Math.floor((ctx.currentTime - S.counting.when) / S.counting.spb); if (ctx.currentTime >= S.counting.until) { S.counting = null; cn.hidden = true; refreshTransport(); } else { cn.hidden = k < 0; cn.textContent = String(k % 4 + 1); } }
  else cn.hidden = true;
  const lw = $('#lvlWrap'); if (lw) { lw.hidden = !mic; if (mic) { const l = $('#lvl'); l.style.width = Math.min(100, S.level * 100) + '%'; l.classList.toggle('hot', S.level > .97); } }
  const l2 = $('#lvl2'); if (l2) { l2.style.width = Math.min(100, S.level * 100) + '%'; l2.classList.toggle('hot', S.level > .97); }
  syncMonitor(P.playing ? Math.max(P.from, p - outLat() * P.speed) : p);
}
function refreshTransport() {
  const pb = $('#playBtn'); if (pb) { const busy = (P.playing && P.mode === 'studio') || S.recording || S.counting; pb.innerHTML = S.recording || S.counting ? I.stop : busy ? I.pause : I.play; pb.setAttribute('aria-label', busy ? 'Parar' : 'Tocar'); }
  const rb = $('#recBtn'); if (rb) rb.classList.toggle('on', !!(S.recording || S.counting));
}

/* ---------------- gravação ---------------- */
async function recStart() {
  const p = S.cur; const arm = p.tracks.find(t => t.arm);
  if (!arm) { toast('Escolha a faixa que vai gravar: toque no R dela.'); return; }
  if (p.speed < 1) { toast('Para gravar, volte a velocidade para 100% (toque no ♩).'); return; }
  ensureCtx(); if (P.playing) stopPlay(); S.sel = null;
  try { await ensureMic(); if (arm.type === 'video') await ensureCam(); } catch (e) { return; }
  await ensureProcessed(1);
  const spb = 60 / p.bpm; const punch = !!(S.range && S.punch); const pre = punch ? S.preroll * 4 * spb : 0;
  const from = punch ? Math.max(0, S.range.a - pre) : S.pos;
  const beats = (p.metro === 'off' || (punch && pre > 0)) ? 0 : p.countBars * 4;
  const when = ctx.currentTime + .15; for (let k = 0; k < beats; k++) click(when + k * spb, k % 4 === 0);
  const t0 = when + beats * spb;
  recChunks = []; refChunks = []; mic.node.port.postMessage('start'); refNode.port.postMessage('start');
  let video = null;
  if (arm.type === 'video' && cam) {
    const mime = media.pickVideoMime();
    try {
      const mr = new MediaRecorder(cam, { mimeType: mime || undefined, videoBitsPerSecond: cfg.q === '720' ? 5e6 : 10e6 });
      video = { mr, mime: mr.mimeType || mime, chunks: [], startCtx: null };
      mr.ondataavailable = e => { if (e.data && e.data.size) video.chunks.push(e.data); };
      mr.onstart = () => { video.startCtx = ctx.currentTime; };
      mr.start(1000);
    } catch (e) { video = null; toast('Não consegui gravar o vídeo. Vou gravar só o som.'); }
  }
  S.recording = { t: arm.id, start: punch ? S.range.a : from, end: punch ? S.range.b : null, punch, from, t0, video, lat: latMs() / 1000 };
  S.counting = beats ? { when, until: t0, spb } : null;
  renderStudio(); startAt(from, { when: t0, speed: 1 }); wake(true);
  if (punch) toast(`Grava só de ${fmt2(S.range.a)} a ${fmt2(S.range.b)}.`);
}
let stopping = false;
async function stopRecord() {
  const r = S.recording; if (!r || stopping) return; stopping = true;
  const counting = !!S.counting; let endTl = curPos(); const endCtx = ctx.currentTime;
  stopPlay(); S.counting = null;
  const done = new Promise(res => { recDone = res; }); if (mic) mic.node.port.postMessage('stop');
  const rdone = new Promise(res => { refDone = res; }); if (refNode) refNode.port.postMessage('stop');
  let vblob = null;
  if (r.video) { const v = r.video; const stopped = new Promise(res => { v.mr.onstop = res; }); try { v.mr.stop(); await Promise.race([stopped, sleep(3000)]); } catch (e) { /* já parado */ } if (v.chunks.length) vblob = new Blob(v.chunks, { type: v.mime || 'video/webm' }); }
  await Promise.race([Promise.all([done, rdone]), sleep(1500)]);
  S.recording = null; stopping = false; wake(false);
  if (r.end != null) endTl = Math.min(endTl, r.end);
  const tr = trackById(r.t);
  if (counting || endTl - r.start < (r.punch ? .03 : .3) || !tr) { recChunks = []; S.pos = r.start; renderStudio(); if (!counting) toast(r.punch ? 'Parou antes do trecho. Nada foi gravado.' : 'Gravação muito curta.'); return; }
  const sr = ctx.sampleRate;
  const f0 = Math.ceil((r.start - r.from + r.t0 + r.lat) * sr), f1 = Math.floor((endTl - r.from + r.t0 + r.lat) * sr);
  let raw = extract(recChunks, f0, f1); recChunks = [];
  if (!raw) { refChunks = []; toast('Não chegou som da entrada. Confira o Cuvave.'); renderStudio(); return; }
  let cleaned = null;
  if (cfg.clean && refChunks.length) {
    const M = Math.round(.4 * sr); const ref = extract(refChunks, f0 - M, f1); refChunks = [];
    if (ref) { toast('Limpando a gravação…', 0); try { cleaned = await runClean(raw, ref, M, sr); } catch (e) { cleaned = null; } hideToast(); }
    if (cleaned) raw = cleaned.chans;
  }
  refChunks = [];
  const chans = simplify(raw);
  const take = makeTake(chans, sr, r.from + (f0 / sr - r.t0 - r.lat), `Tomada ${tr.takes.length + 1}`);
  if (vblob && r.video.startCtx != null) take.video = { v: 2, mime: vblob.type, t0: r.from + (r.video.startCtx - r.t0 - r.lat) - (cfg.camLat || 0) / 1000 + cfg.vsync / 1000, sync: 0, dur: endCtx - r.video.startCtx, bytes: Math.round(vblob.size / 1e5) / 10 };
  try {
    await saveTakeAudio(take);
    if (take.video) { await db.put('vid', take.id, vblob); take.vurl = URL.createObjectURL(vblob); }
  } catch (e) { toast('Sem espaço no celular para guardar a gravação. Libere espaço e grave de novo.', 6000); renderStudio(); return; }
  tr.takes.push(take); pushUndo();
  const a = take.recStart, b = a + take.dur, out = [];
  tr.clips.forEach(c => { const ce = c.start + c.dur; if (ce <= a || c.start >= b) { out.push(c); return; } if (c.start < a) out.push({ ...c, id: nid(), dur: a - c.start }); if (ce > b) out.push({ ...c, id: nid(), start: b, offset: c.offset + (b - c.start), dur: ce - b }); });
  out.push(clipOf(take, a)); tr.clips = out.sort((x, y) => x.start - y.start);
  S.pos = endTl; S.cur.updated = Date.now(); renderStudio(); saveProject(S.cur);
  let peak = 0; for (const c of chans) for (let i = 0; i < c.length; i += 4) { const v = Math.abs(c[i]); if (v > peak) peak = v; }
  if (peak < .003) toast('A tomada ficou em silêncio. Confira o volume do Cuvave e a entrada em Ajustes.', 6000);
  else toast((r.punch ? `Trecho regravado (${take.name}). Use ↶ para desfazer.` : `${take.name} gravada${take.video ? ' com vídeo' : ''}.`) + (cleaned ? ' Tirei dela o som das outras faixas que voltou pela USB.' : ''), cleaned ? 5000 : 2800);
}

/* calibração: tocar junto com 8 cliques */
async function calibrate(btn) {
  try { await ensureMic(); } catch (e) { return; }
  stopPlay(); const sr = ctx.sampleRate, n = 8, iv = .6, start = ctx.currentTime + 1.2; const times = [];
  recChunks = []; refChunks = []; mic.node.port.postMessage('start'); refNode.port.postMessage('start');
  for (let k = 0; k < n; k++) { const t = start + k * iv; click(t, k % 4 === 0); times.push(t); }
  btn.disabled = true;
  for (let k = 0; k < n; k++) { await sleep(Math.max(0, (times[k] - ctx.currentTime) * 1000)); btn.textContent = `Toque junto: ${k + 1} de ${n}`; }
  await sleep(700);
  const done = new Promise(res => { recDone = res; }), rdone = new Promise(res => { refDone = res; });
  mic.node.port.postMessage('stop'); refNode.port.postMessage('stop'); await Promise.race([Promise.all([done, rdone]), sleep(1000)]);
  const f0 = Math.floor((start - .4) * sr), f1 = Math.ceil((start + n * iv + .5) * sr);
  let ch = extract(recChunks, f0, f1); recChunks = [];
  const M = Math.round(.4 * sr), ref = extract(refChunks, f0 - M, f1); refChunks = [];
  if (ch && ref) { try { const c = await runClean(ch, ref, M, sr); if (c) ch = c.chans; } catch (e) { /* usa a gravação como veio */ } }
  const offs = ch ? onsetOffsets(ch, sr, f0, times) : [];
  if (offs.length < 5) { toast('Não ouvi as notas. Toque uma nota abafada junto com cada clique e tente de novo.', 5000); renderSheet(); return; }
  const med = median(offs); const mad = median(offs.map(o => Math.abs(o - med)));
  if (mad > .05) { toast('As batidas ficaram irregulares. Tente de novo, bem junto do clique.', 5000); renderSheet(); return; }
  cfg.lat = Math.round(med * 1000); saveCfg(); renderSheet(); toast(`Atraso medido: ${cfg.lat} ms. As próximas gravações já saem no tempo.`, 4500);
}

/* ---------------- gavetas ---------------- */
function openSheet(kind, data = {}) { const was = !!S.sheet; S.sheet = Object.assign({ kind }, data); if (!was) history.pushState({ s: 1 }, ''); renderSheet(); if (kind === 'settings') ensureMic().then(() => renderSheet()).catch(() => { }); }
function closeSheet() { if (!S.sheet) return; if (history.state && history.state.s) history.back(); else { S.sheet = null; renderSheet(); } }
function renderSheet() {
  const root = $('#sheetRoot'); if (!S.sheet) { root.innerHTML = ''; return; } const d = SHEETS[S.sheet.kind](); if (!d) { S.sheet = null; root.innerHTML = ''; return; }
  const prev = root.querySelector('.sh-b'), keep = prev && root.dataset.k === S.sheet.kind + (S.sheet.tab || '') ? prev.scrollTop : 0;
  root.innerHTML = `<div class="ov" data-act="ovClose"><div class="sheet" role="dialog" aria-label="${esc(d.title)}"><div class="sh-h"><b>${esc(d.title)}</b><button class="ib" data-act="closeSheet" aria-label="Fechar">${I.close}</button></div>${d.tabs || ''}<div class="sh-b">${d.body}</div></div></div>`;
  root.dataset.k = S.sheet.kind + (S.sheet.tab || ''); root.querySelector('.sh-b').scrollTop = keep;
}
const tabs = (list, cur) => `<div class="tabs">${list.map(([k, l]) => `<button class="tab${k === cur ? ' on' : ''}" data-act="tab" data-v="${k}">${l}</button>`).join('')}</div>`;
const rng2 = (id, inp, label, val, min, max, step, show) => `<div class="ctl"><div class="ctlh"><span>${label}</span><b id="v-${inp}">${show}</b></div><input type="range" id="${id}" data-inp="${inp}" min="${min}" max="${max}" step="${step}" value="${val}"></div>`;
const panLong = v => v === 0 ? 'Centro' : (v < 0 ? 'Esquerda ' : 'Direita ') + Math.round(Math.abs(v) * 100);
const dbs = v => (v > 0 ? '+' : '') + v + ' dB';
const nud = (k, v, l) => `<button data-act="nudge" data-k="${k}" data-v="${v}">${l}</button>`;
function addOptions() {
  return `<button class="opt" data-act="newTrack" data-v="audio"><span class="oi">${I.guitar}</span><span><b>Guitarra</b><small>Só o som, pelo Cuvave</small></span></button>
  <button class="opt" data-act="newTrack" data-v="video"><span class="oi">${I.cam}</span><span><b>Guitarra + vídeo</b><small>Grava a câmera junto com a guitarra</small></span></button>
  <label class="opt"><input type="file" accept="audio/*,.mp3,.m4a,.wav,.ogg" id="fileIn" aria-label="Importar música"><span class="oi">${I.music}</span><span><b>Importar música</b><small>MP3 ou outro áudio do celular</small></span></label>`;
}
const SHEETS = {
  goto() {
    const p = S.pos, spb = 60 / S.cur.bpm, b = Math.floor(p / spb + 1e-6);
    return { title: 'Ir para', body: `<div><input class="txt tin" id="gotoIn" data-ch="gotoIn" value="${fmt3(p)}" inputmode="decimal" aria-label="Tempo">
    <p class="note" style="text-align:center;margin-top:6px">Compasso ${Math.floor(b / 4) + 1} · tempo ${b % 4 + 1} · digite como 1:05.250</p></div>
    <div class="nudge">${nud('pos', '-bar', '−1 comp.')}${nud('pos', '-beat', '−1 tempo')}${nud('pos', 'beat', '+1 tempo')}${nud('pos', 'bar', '+1 comp.')}</div>
    <div class="nudge">${nud('pos', '-0.1', '−0,1 s')}${nud('pos', '-0.01', '−0,01 s')}${nud('pos', '0.01', '+0,01 s')}${nud('pos', '0.1', '+0,1 s')}</div>
    <div class="row2"><button class="ghost" data-act="markA">Início do trecho aqui</button><button class="ghost" data-act="markB">Fim do trecho aqui</button></div>
    <button class="btn-acc big" data-act="gotoPlay">${I.play}Tocar daqui</button>` };
  },
  range() {
    const R = S.range; if (!R) return null;
    const blk = (k, label) => `<div><span class="lab">${label}</span><input class="txt tin" id="rg${k}" data-ch="r${k}" value="${fmt3(R[k])}" inputmode="decimal" aria-label="${label}">
    <div class="nudge" style="margin-top:8px">${nud(k, '-0.1', '−0,1 s')}${nud(k, '-0.01', '−0,01 s')}${nud(k, '0.01', '+0,01 s')}${nud(k, '0.1', '+0,1 s')}</div>
    <button class="ghost" style="margin-top:8px" data-act="rCur" data-k="${k}">Usar a posição do cursor (${fmt2(S.pos)})</button></div>`;
    return { title: 'Trecho', body: `<p class="note">Duração: ${num(R.b - R.a, 3)} s. Digite como 1:05.250 ou use as setas.</p>${blk('a', 'Início')}${blk('b', 'Fim')}
    <div class="sw"><span>Gravar só neste trecho<small>Para consertar um pedaço do solo sem regravar tudo</small></span><button class="tgl${S.punch ? ' on' : ''}" data-act="punch" aria-label="Gravar só neste trecho"></button></div>
    ${S.punch ? `<div><span class="lab">Antes de gravar, tocar</span><div class="seg">${[[0, 'Nada'], [1, '1 compasso'], [2, '2 compassos']].map(([v, l]) => `<button class="${S.preroll === v ? 'on' : ''}" data-act="preroll" data-v="${v}">${l}</button>`).join('')}</div>
    <p class="note" style="margin-top:8px">Você ouve o que vem antes para entrar no tempo. A gravação liga e desliga sozinha nas bordas do trecho.</p></div>` : ''}
    <button class="btn-acc big" data-act="rangePlay">${I.play}Ouvir o trecho</button>` };
  },
  track() {
    const tr = trackById(S.sheet.t); if (!tr) return null; const tab = S.sheet.tab || 'mix';
    const list = [['mix', 'Volume e lado'], ['fx', 'Efeitos'], ['tom', 'Tom'], tr.type === 'import' ? ['ia', 'Sem guitarra'] : ['takes', 'Tomadas']]; let body = '';
    if (tab === 'mix') body = `<div><span class="lab">Nome</span><input class="txt" id="trName" data-ch="trName" value="${esc(tr.name)}" maxlength="28"></div>
      ${rng2('rVol', 'vol', 'Volume', Math.round(tr.vol * 100), 0, 125, 1, Math.round(tr.vol * 100) + '%')}
      ${rng2('rPan', 'pan', 'Lado (pan)', Math.round(tr.pan * 100), -100, 100, 5, panLong(tr.pan))}
      <div class="seg"><button data-act="panTo" data-v="-60">Esquerda</button><button data-act="panTo" data-v="0">Centro</button><button data-act="panTo" data-v="60">Direita</button></div>
      <p class="note">Duas bases: uma na esquerda e outra na direita. Solo e voz no centro.</p>
      <button class="danger" data-act="delTrack">Apagar faixa</button>`;
    else if (tab === 'fx') body = `<div class="presets">${[['none', 'Nenhum'], ['limpa', 'Limpa'], ['base', 'Base'], ['solo', 'Solo']].map(([k, l]) => `<button class="pre${tr.fx.preset === k ? ' on' : ''}" data-act="preset" data-v="${k}">${l}</button>`).join('')}</div>
      ${rng2('rLow', 'low', 'Grave', tr.fx.low, -12, 12, 1, dbs(tr.fx.low))}${rng2('rMid', 'mid', 'Médio', tr.fx.mid, -12, 12, 1, dbs(tr.fx.mid))}${rng2('rHigh', 'high', 'Agudo', tr.fx.high, -12, 12, 1, dbs(tr.fx.high))}
      <div class="sw"><span>Compressor<small>Deixa o volume mais parelho</small></span><button class="tgl${tr.fx.comp ? ' on' : ''}" data-act="comp" aria-label="Compressor"></button></div>
      ${rng2('rRev', 'rev', 'Reverb', tr.fx.rev, 0, 100, 1, tr.fx.rev + '%')}${rng2('rDly', 'dly', 'Eco (delay)', tr.fx.dly, 0, 100, 1, tr.fx.dly + '%')}
      <p class="note">O eco repete as notas no ritmo do BPM do projeto (♩ ${S.cur.bpm}). Se esse BPM não for o da música, o eco sai fora do tempo. Acerte em ♩ → Toque aqui no ritmo da música.</p>`;
    else if (tab === 'tom') body = `<div class="pitch"><button class="pbtn" data-act="semi" data-v="-1" aria-label="Meio tom abaixo">−</button><div class="pval"><b>${tr.semis > 0 ? '+' : ''}${tr.semis}</b><span>semitons</span></div><button class="pbtn" data-act="semi" data-v="1" aria-label="Meio tom acima">+</button></div>
      <p class="note">Muda só esta faixa, sem mudar a velocidade. Ideal para tocar junto com um MP3 em outro tom.</p>${tr.semis ? '<button class="ghost" data-act="semi0">Voltar ao tom original</button>' : ''}`;
    else if (tab === 'takes') {
      const used = new Set(tr.clips.map(c => c.take));
      body = tr.takes.length ? tr.takes.map(k => `<div class="take"><div class="tinfo"><b>${esc(k.name)}</b><small>${fmt(k.dur)} · a partir de ${fmt(k.recStart)}${k.video ? ' · com vídeo' : ''}</small></div>
        <button class="ib" data-act="hearTake" data-v="${k.id}" aria-label="Ouvir">${S.hear === k.id ? I.pause : I.play}</button><button class="use${used.has(k.id) ? ' on' : ''}" data-act="useTake" data-v="${k.id}">${used.has(k.id) ? 'Em uso' : 'Usar'}</button></div>
        ${k.video && used.has(k.id) ? `<div class="ctl"><div class="ctlh"><span>Sincronia do vídeo</span><b>${(k.video.sync || 0) > 0 ? '+' : ''}${k.video.sync || 0} ms</b></div><div class="nudge">${['-50', '-10', '10', '50'].map(v => `<button data-act="vsync" data-k="${k.id}" data-v="${v}">${+v > 0 ? '+' : '−'}${Math.abs(v)} ms</button>`).join('')}</div>
        <p class="note" style="margin-top:6px">Toque no vídeo para aumentar e confira. Se a mão aparece antes do som, toque em +. Se aparece depois, em −. O valor fica guardado para as próximas gravações.</p></div>` : ''}`).join('')
        + `<p class="note">Gravar de novo nesta faixa cria outra tomada. As anteriores ficam aqui para você escolher a melhor.</p>${tr.takes.some(k => !used.has(k.id)) ? '<button class="ghost" data-act="purge">Apagar tomadas que não estão em uso</button>' : ''}`
        : '<p class="note">Ainda não há tomadas. Toque no R desta faixa e depois em ● para gravar.</p>';
    }
    else body = `<span class="badge" style="align-self:flex-start">Próxima fase</span><p class="note" style="color:var(--fg);font-size:14.5px">Tira só a guitarra desta música com IA, no próprio celular, e deixa o resto para você tocar junto.</p>
      <p class="note">No Redmi Note 10S deve levar alguns minutos por música. Vamos testar no seu celular antes de liberar.</p>`;
    return { title: tr.name, tabs: tabs(list, tab), body };
  },
  tempo() {
    const p = S.cur;
    return { title: 'Tempo e metrônomo', body: `<div class="pitch"><button class="pbtn" data-act="bpm" data-v="-1" aria-label="Menos BPM">−</button><div class="pval"><b id="bpmV">${p.bpm}</b><span>BPM</span></div><button class="pbtn" data-act="bpm" data-v="1" aria-label="Mais BPM">+</button></div>
    <button class="ghost" data-act="tap">Toque aqui no ritmo da música</button>
    <div><span class="lab">Metrônomo</span><div class="seg">${[['off', 'Desligado'], ['count', 'Só contagem'], ['all', 'Música toda']].map(([k, l]) => `<button class="${p.metro === k ? 'on' : ''}" data-act="metro" data-v="${k}">${l}</button>`).join('')}</div>
    <p class="note" style="margin-top:8px">${p.metro === 'off' ? 'A gravação começa na hora.' : p.metro === 'count' ? 'Conta antes de gravar e depois fica quieto.' : 'Conta antes de gravar e continua durante a música.'} O clique toca só no fone e não vai para o vídeo.</p></div>
    ${p.metro !== 'off' ? `<div><span class="lab">Contagem antes de gravar</span><div class="seg"><button class="${p.countBars === 1 ? 'on' : ''}" data-act="countBars" data-v="1">1 compasso</button><button class="${p.countBars === 2 ? 'on' : ''}" data-act="countBars" data-v="2">2 compassos</button></div></div>` : ''}
    ${rng2('rSpd', 'speed', 'Velocidade para treinar', Math.round(p.speed * 100), 50, 100, 5, Math.round(p.speed * 100) + '%')}
    <p class="note">Abaixo de 100% dá para treinar tocando junto. Para gravar, volte para 100%.</p>` };
  },
  settings() {
    const list = S.inputs, curId = (mic && mic.settings.deviceId) || cfg.inputId;
    const info = mic ? `Saída ${ctx.sampleRate} Hz, entrada ${mic.settings.sampleRate || '?'} Hz, ${mic.settings.channelCount || '?'} canal(is), atraso de saída ${Math.round(outLat() * 1000)} ms` : 'Entrada fechada';
    return { title: 'Ajustes', body: `<div><span class="lab">Entrada da guitarra</span>
      ${list.length ? `<select class="sel" id="inSel" data-ch="inSel">${list.map(d => `<option value="${esc(d.deviceId)}"${d.deviceId === curId ? ' selected' : ''}>${esc(d.label || 'Entrada sem nome')}</option>`).join('')}</select>` : '<p class="note">Ligue o Cuvave na USB e permita o uso do áudio.</p>'}
      <div class="lvl" style="height:10px"><i id="lvl2"></i></div><p class="note" style="margin-top:6px">Toque a guitarra: a barra deve mexer. Se ficar vermelha, baixe o volume no Cuvave. ${info}.</p></div>
      <div class="sw"><span>Tirar o som das outras faixas<small>Alguns aparelhos USB devolvem para a gravação o que o celular está tocando. O app tira esse som e deixa só a guitarra.</small></span><button class="tgl${cfg.clean ? ' on' : ''}" data-act="cleanTog" aria-label="Tirar o som das outras faixas"></button></div>
      <div><span class="lab">Atraso da gravação</span><div class="stepper"><button data-act="lat" data-v="-5" aria-label="Menos 5 ms">−5</button><b>${latMs()} ms${cfg.lat == null ? ' (estimado)' : ''}</b><button data-act="lat" data-v="5" aria-label="Mais 5 ms">+5</button></div>
      ${cfg.lat == null ? '<p class="note" style="margin-top:8px;color:var(--accent)">Ainda não calibrado nesta versão. Calibre para a guitarra cair no tempo certo.</p>' : ''}
      <button class="btn-acc big" style="margin-top:10px" data-act="calib">Calibrar: tocar junto com 8 cliques</button>
      <p class="note" style="margin-top:8px">Com o fone no Cuvave, toque uma nota abafada junto com cada clique. O app mede o atraso e corrige as gravações.</p></div>
      <div><span class="lab">Câmera</span><div class="seg"><button class="${cfg.cam === 'back' ? 'on' : ''}" data-act="cfg" data-k="cam" data-v="back">Traseira</button><button class="${cfg.cam === 'front' ? 'on' : ''}" data-act="cfg" data-k="cam" data-v="front">Frontal</button></div></div>
      <div><span class="lab">Qualidade do vídeo</span><div class="seg"><button class="${cfg.q === '1080' ? 'on' : ''}" data-act="cfg" data-k="q" data-v="1080">1080p</button><button class="${cfg.q === '720' ? 'on' : ''}" data-act="cfg" data-k="q" data-v="720">720p</button></div>
      <p class="note" style="margin-top:8px">${cfg.q === '1080' ? '1080p ocupa cerca de 75 MB por minuto.' : '720p ocupa cerca de metade do espaço.'}${camInfo() ? ' Câmera agora: ' + camInfo() + '.' : ''} Formato: ${esc((media.pickVideoMime() || 'sem gravação de vídeo').split(';')[0])}.</p></div>
      <div><span class="lab">Sincronia do vídeo nas próximas gravações</span><div class="stepper"><button data-act="vsdef" data-v="-10">−10</button><b>${cfg.vsync > 0 ? '+' : ''}${cfg.vsync} ms</b><button data-act="vsdef" data-v="10">+10</button></div></div>
      <p class="note">Versão ${VERSAO}</p>` };
  },
  add() { return { title: 'Nova faixa', body: addOptions() }; },
  soon() { return { title: 'Exportar', body: `<p class="note" style="color:var(--fg);font-size:15px">A exportação do vídeo para o Instagram entra na próxima versão, com trecho, fade, título e escolha das faixas.</p><p class="note">Agora teste a gravação pelo Cuvave, a câmera e a sincronia. Me conte como foi.</p>` }; },
  newProj() {
    return { title: 'Novo projeto', body: `<div><span class="lab">Nome</span><input class="txt" id="npName" value="Projeto ${S.projects.length + 1}" maxlength="32"></div>
    <div><span class="lab">BPM</span><input class="txt" id="npBpm" type="number" inputmode="numeric" min="40" max="220" value="90"></div>
    <button class="btn-acc big" data-act="createProj">Criar</button>` };
  },
  projMenu() {
    const p = S.projects.find(q => q.id === S.sheet.p); if (!p) return null;
    return { title: p.name, body: `<div><span class="lab">Nome</span><input class="txt" id="pmName" value="${esc(p.name)}" maxlength="32"></div>
    <button class="btn-acc big" data-act="renameProj">Salvar nome</button><p class="note">Ocupa ${projSize(p)} MB neste celular.</p><button class="danger" data-act="delProj">Apagar projeto</button>` };
  }
};

/* ---------------- ações ---------------- */
function confirm2(b, label) { if (b.dataset.sure) return true; b.dataset.sure = '1'; const t = b.textContent; b.textContent = label; setTimeout(() => { if (b.isConnected) { delete b.dataset.sure; b.textContent = t; } }, 3000); return false; }
let hearSrc = null;
function stopHear() { if (hearSrc) { try { hearSrc.stop(); } catch (e) { /* ok */ } hearSrc = null; } S.hear = null; }
async function goHome() {
  if (S.recording || S.counting) await stopRecord();
  stopPlay(); stopHear(); closeCamNow(); closeMicNow();
  if (S.cur) { clearTimeout(saveT); await saveProject(S.cur); unloadProject(S.cur); }
  S.cur = null; S.screen = 'projects'; S.sel = null; S.range = null; render();
}
async function openProject(p) {
  toast('Abrindo projeto…', 0);
  try { await loadProjectData(p); } catch (e) { hideToast(); toast('Não deu para abrir este projeto.'); return; }
  hideToast();
  p.tracks.forEach(t => { t.arm = false; });
  S.cur = p; S.screen = 'studio'; S.pos = 0; S.sel = null; S.range = null; S.tlLen = 30; history.pushState({ st: 1 }, ''); render();
}
const ACT = {
  bigView(b) { S.big = !S.big; b.classList.toggle('big', S.big); b.setAttribute('aria-label', S.big ? 'Diminuir o vídeo' : 'Aumentar o vídeo'); },
  install() { if (!instEvt) return; instEvt.prompt(); instEvt.userChoice.finally(() => { instEvt = null; if (S.screen === 'projects') renderProjects(); }); },
  goto() { if (S.recording || S.counting) return; stopPlay(); frameStudio(true); openSheet('goto'); },
  nudge(b) {
    const k = b.dataset.k, v = b.dataset.v, spb = 60 / S.cur.bpm, sg = v[0] === '-' ? -1 : 1, a = v.replace('-', ''); const d = sg * (a === 'bar' ? 4 * spb : a === 'beat' ? spb : +a);
    if (k === 'pos') { if (S.recording || S.counting) return; stopPlay(); S.pos = clamp(+(S.pos + d).toFixed(3), 0, S.tlLen); showPos(); }
    else { S.range[k] = clamp(+(S.range[k] + d).toFixed(3), 0, S.tlLen); fixRange(k); renderStudio(); }
    renderSheet();
  },
  markA() { const bar = 4 * 60 / S.cur.bpm, a = S.pos; S.range = { a, b: S.range && S.range.b > a + .01 ? S.range.b : a + bar }; fixRange('a'); S.sel = null; renderStudio(); renderSheet(); toast('Início do trecho marcado.'); },
  markB() { const bar = 4 * 60 / S.cur.bpm, b = S.pos; if (b < .02) { toast('Ande o cursor para depois do início.'); return; } S.range = { a: S.range && S.range.a < b - .01 ? S.range.a : Math.max(0, b - bar), b }; fixRange('b'); S.sel = null; renderStudio(); renderSheet(); toast('Fim do trecho marcado.'); },
  gotoPlay() { closeSheet(); ACT.play(); },
  rangeSheet() { openSheet('range'); },
  punch() { S.punch = !S.punch; if (S.sheet && S.sheet.kind === 'range') renderSheet(); renderStudio(); toast(S.punch ? 'O ● grava só dentro do trecho.' : 'O ● grava a partir do cursor, sem limite.'); },
  clearRange() { S.range = null; renderStudio(); },
  rCur(b) { const k = b.dataset.k; S.range[k] = S.pos; fixRange(k); renderSheet(); renderStudio(); },
  preroll(b) { S.preroll = +b.dataset.v; renderSheet(); },
  async rangePlay() { closeSheet(); ensureCtx(); stopPlay(); await ensureProcessed(S.cur.speed); startAt(S.range.a, { end: S.range.b }); },
  ovClose(b, e) { if (e.target === b) { stopHear(); closeSheet(); } },
  closeSheet() { stopHear(); closeSheet(); },
  tab(b) { stopHear(); S.sheet.tab = b.dataset.v; renderSheet(); },
  open(b) { const p = S.projects.find(q => q.id === +b.dataset.p); if (p) openProject(p); },
  projMenu(b) { openSheet('projMenu', { p: +b.dataset.p }); },
  renameProj() { const p = S.projects.find(q => q.id === S.sheet.p); const v = $('#pmName').value.trim(); if (v) { p.name = v; saveProject(p); } closeSheet(); render(); },
  async delProj(b) {
    if (!confirm2(b, 'Toque de novo para apagar')) return;
    const p = S.projects.find(q => q.id === S.sheet.p);
    for (const tr of p.tracks) for (const k of tr.takes) await deleteTakeData(k);
    await db.del('proj', p.id); S.projects = S.projects.filter(q => q !== p); closeSheet(); render(); toast('Projeto apagado. Espaço liberado.');
  },
  newProj() { openSheet('newProj'); },
  async createProj() {
    const name = $('#npName').value.trim() || 'Projeto'; const bpm = clamp(parseInt($('#npBpm').value) || 90, 40, 220);
    const p = { id: nid(), name, date: hoje(), updated: Date.now(), bpm, metro: 'count', countBars: 1, speed: 1, tracks: [], undo: [], loaded: true };
    S.projects.push(p); await saveProject(p);
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* opcional */ }
    S.sheet = null; renderSheet(); if (history.state && history.state.s) history.replaceState({ st: 1 }, ''); else history.pushState({ st: 1 }, '');
    S.cur = p; S.screen = 'studio'; S.pos = 0; S.sel = null; S.range = null; render();
  },
  home() { if (history.state && history.state.st) history.back(); else goHome(); },
  async play() {
    ensureCtx(); if (S.recording || S.counting) { stopRecord(); return; } if (P.playing) { stopPlay(); frameStudio(true); return; }
    await ensureProcessed(S.cur.speed); let from = S.pos; const end = contentEnd(); if (end < .1) { toast('Ainda não há nada para tocar. Adicione uma faixa.'); return; }
    if (from >= end - .05) from = 0; if (S.loop) { const [a, b] = loopRange(); if (from < a || from >= b) from = a; } startAt(from);
  },
  rec() { if (S.recording || S.counting) { stopRecord(); return; } recStart(); },
  toStart() { if (S.recording || S.counting) return; if (P.playing) startAt(0); else S.pos = 0; $('#tl').scrollLeft = 0; frameStudio(true); },
  loop(b) { S.loop = !S.loop; b.classList.toggle('on', S.loop); toast(S.loop ? (S.range || S.sel ? 'Repetindo o trecho.' : 'Repetindo a música toda. Arraste o dedo na régua para repetir só um trecho.') : 'Repetir desligado.'); },
  zoom(b) { const tl = $('#tl'); const vw = tl.clientWidth - 104; const c = (tl.scrollLeft + vw / 2) / S.PX; S.PX = clamp(S.PX * (+b.dataset.v > 0 ? 1.5 : 1 / 1.5), 16, Math.min(640, 40000 / S.tlLen)); renderStudio(); $('#tl').scrollLeft = c * S.PX - vw / 2; },
  async arm(b) { const tr = trackById(+b.dataset.t); if (S.recording || S.counting) return; const on = !tr.arm; S.cur.tracks.forEach(t => { t.arm = false; }); tr.arm = on; renderStudio(); await syncArmed(); renderStudio(); if (on && mic) toast(`${tr.name} pronta. Toque em ● para gravar.`); },
  mute(b) { const tr = trackById(+b.dataset.t); tr.mute = !tr.mute; applyAll(); renderStudio(); },
  solo(b) { const tr = trackById(+b.dataset.t); tr.solo = !tr.solo; applyAll(); renderStudio(); },
  trackSheet(b) { openSheet('track', { t: +b.dataset.t, tab: 'mix' }); },
  addTrack() { openSheet('add'); },
  async newTrack(b) {
    const v = b.dataset.v, p = S.cur; const n = p.tracks.filter(t => t.type !== 'import').length + 1;
    const tr = makeTrack({ name: v === 'video' ? `Guitarra ${n} + vídeo` : `Guitarra ${n}`, type: v, color: COLORS[p.tracks.length % COLORS.length], fx: fxp('none') });
    p.tracks.forEach(t => { t.arm = false; }); tr.arm = true; p.tracks.push(tr); closeSheet();
    renderStudio(); await syncArmed(); renderStudio(); if (mic) toast('Faixa pronta para gravar. Toque em ● quando quiser.');
  },
  split() { const s = selClip(); if (!s) return; const { tr, c } = s, t = S.pos; if (!(t > c.start + .05 && t < c.start + c.dur - .05)) { toast('Toque dentro do trecho para pôr o cursor onde quer dividir.'); return; } pushUndo(); tr.clips.push({ id: nid(), start: t, offset: c.offset + (t - c.start), dur: c.start + c.dur - t, take: c.take }); c.dur = t - c.start; tr.clips.sort((a, b) => a.start - b.start); renderStudio(); toast('Trecho dividido.'); },
  snap(b) { S.snap = !S.snap; b.classList.toggle('on', S.snap); toast(S.snap ? 'Ímã ligado: encaixa no ritmo.' : 'Ímã desligado: movimento livre.'); },
  delClip() { const s = selClip(); if (!s) return; pushUndo(); s.tr.clips = s.tr.clips.filter(c => c !== s.c); S.sel = null; renderStudio(); toast('Trecho apagado. Use ↶ para desfazer.'); },
  desel() { S.sel = null; renderStudio(); },
  undo() { const u = S.cur.undo.pop(); if (!u) return; u.forEach(s => { const t = trackById(s.id); if (t) t.clips = s.clips; }); S.sel = null; renderStudio(); restartIfPlaying(); toast('Desfeito.'); },
  settings() { openSheet('settings'); },
  tempo() { openSheet('tempo'); },
  toExport() { openSheet('soon'); },
  panTo(b) { const tr = trackById(S.sheet.t); tr.pan = +b.dataset.v / 100; applyTr(tr); renderSheet(); updHeader(tr); dirty(); },
  preset(b) { const tr = trackById(S.sheet.t); tr.fx = fxp(b.dataset.v); applyTr(tr); renderSheet(); dirty(); },
  comp(b) { const tr = trackById(S.sheet.t); tr.fx.comp = !tr.fx.comp; tr.fx.preset = 'custom'; b.classList.toggle('on', tr.fx.comp); applyTr(tr); $$('.pre').forEach(x => x.classList.remove('on')); dirty(); },
  async semi(b) { const tr = trackById(S.sheet.t); tr.semis = clamp(tr.semis + (+b.dataset.v), -7, 7); renderSheet(); updHeader(tr); dirty(); await restartIfPlaying(); },
  async semi0() { const tr = trackById(S.sheet.t); tr.semis = 0; renderSheet(); updHeader(tr); dirty(); await restartIfPlaying(); },
  async hearTake(b) {
    const tr = trackById(S.sheet.t); const id = +b.dataset.v; const was = S.hear; stopHear(); if (was === id) { renderSheet(); return; }
    ensureCtx(); stopPlay(); const k = takeOf(tr, id); await ensureProcessed(1, { ...tr, clips: [], takes: [k] }); const ab = getAB(k, tr.semis, 1); if (!ab) return;
    const src = ctx.createBufferSource(); src.buffer = ab; src.connect(bus.master); src.start();
    src.onended = () => { if (hearSrc === src) { hearSrc = null; S.hear = null; if (S.sheet && S.sheet.tab === 'takes') renderSheet(); } }; hearSrc = src; S.hear = id; renderSheet();
  },
  useTake(b) {
    const tr = trackById(S.sheet.t), nt = takeOf(tr, +b.dataset.v); pushUndo();
    if (!tr.clips.length) tr.clips = [clipOf(nt, nt.recStart)];
    else tr.clips.forEach(c => { const o = takeOf(tr, c.take); c.offset = clamp(c.offset + o.recStart - nt.recStart, 0, Math.max(0, nt.dur - .1)); c.dur = Math.max(.1, Math.min(c.dur, nt.dur - c.offset)); c.take = nt.id; });
    renderSheet(); renderStudio(); restartIfPlaying(); toast(`${nt.name} em uso.`);
  },
  vsync(b) { const tr = trackById(S.sheet.t), k = takeOf(tr, +b.dataset.k); k.video.sync = (k.video.sync || 0) + (+b.dataset.v); cfg.vsync = k.video.sync; saveCfg(); renderSheet(); frameStudio(true); dirty(); },
  vsdef(b) { cfg.vsync += +b.dataset.v; saveCfg(); renderSheet(); },
  async purge() {
    const tr = trackById(S.sheet.t); const used = new Set(tr.clips.map(c => c.take)); const gone = tr.takes.filter(k => !used.has(k.id));
    const mb = Math.round(gone.reduce((a, k) => a + takeBytes(k), 0)); for (const k of gone) await deleteTakeData(k);
    tr.takes = tr.takes.filter(k => used.has(k.id)); renderSheet(); dirty(); toast(`Liberado cerca de ${Math.max(1, mb)} MB.`);
  },
  async delTrack(b) {
    if (!confirm2(b, 'Toque de novo para apagar a faixa')) return; stopPlay(); const tr = trackById(S.sheet.t);
    for (const k of tr.takes) await deleteTakeData(k);
    S.cur.tracks = S.cur.tracks.filter(t => t !== tr); S.cur.undo = []; S.sel = null; closeSheet(); renderStudio(); syncArmed();
  },
  bpm(b) { const p = S.cur; p.bpm = clamp(p.bpm + (+b.dataset.v), 40, 220); $('#bpmV').textContent = p.bpm; setDelay(p.speed); clearTimeout(bpmT); bpmT = setTimeout(renderStudio, 250); },
  tap() { const now = performance.now(); S.taps = S.taps.filter(t => now - t < 2500); S.taps.push(now); if (S.taps.length >= 3) { const d = (S.taps[S.taps.length - 1] - S.taps[0]) / (S.taps.length - 1); S.cur.bpm = clamp(Math.round(60000 / d), 40, 220); $('#bpmV').textContent = S.cur.bpm; clearTimeout(bpmT); bpmT = setTimeout(renderStudio, 400); } if (S.taps.length > 6) S.taps.shift(); },
  metro(b) { S.cur.metro = b.dataset.v; if (P.playing && P.mode === 'studio' && !S.recording) P.metro = S.cur.metro === 'all'; renderSheet(); renderStudio(); },
  countBars(b) { S.cur.countBars = +b.dataset.v; renderSheet(); dirty(); },
  async cfg(b) {
    cfg[b.dataset.k] = b.dataset.v; saveCfg();
    if (b.dataset.k !== 'input' && cam) { closeCamNow(); await syncArmed(); }
    renderSheet(); if (S.screen === 'studio') renderStudio();
  },
  cleanTog(b) { cfg.clean = !cfg.clean; saveCfg(); b.classList.toggle('on', cfg.clean); },
  lat(b) { cfg.lat = latMs() + (+b.dataset.v); saveCfg(); renderSheet(); },
  calib(b) { calibrate(b); }
};
let bpmT = 0;
function updHeader(tr) { const th = $('#th-' + tr.id); if (th) th.innerHTML = headerInner(tr); }
function fxSet(k, el, f) { const tr = trackById(S.sheet.t); tr.fx[k] = +el.value; tr.fx.preset = 'custom'; $('#v-' + k).textContent = f(+el.value); applyTr(tr); $$('.pre').forEach(x => x.classList.remove('on')); dirty(); }
const INP = {
  vol(el) { const tr = trackById(S.sheet.t); tr.vol = +el.value / 100; $('#v-vol').textContent = el.value + '%'; applyTr(tr); updHeader(tr); dirty(); },
  pan(el) { const tr = trackById(S.sheet.t); tr.pan = +el.value / 100; $('#v-pan').textContent = panLong(tr.pan); applyTr(tr); updHeader(tr); dirty(); },
  low: el => fxSet('low', el, dbs), mid: el => fxSet('mid', el, dbs), high: el => fxSet('high', el, dbs), rev: el => fxSet('rev', el, v => v + '%'), dly: el => fxSet('dly', el, v => v + '%'),
  speed(el) { $('#v-speed').textContent = el.value + '%'; }
};
function rangeIn(k, el) { const v = parseTime(el.value); if (v == null) { toast('Não entendi o tempo. Use 1:05.250'); renderSheet(); return; } S.range[k] = clamp(v, 0, S.tlLen); fixRange(k); renderSheet(); renderStudio(); }
const CH = {
  gotoIn(el) { const v = parseTime(el.value); if (v == null) { toast('Não entendi o tempo. Use 1:05.250'); renderSheet(); return; } stopPlay(); S.pos = clamp(v, 0, S.tlLen); showPos(); renderSheet(); },
  ra: el => rangeIn('a', el), rb: el => rangeIn('b', el),
  trName(el) { const tr = trackById(S.sheet.t); const v = el.value.trim(); if (v) { tr.name = v; $('.sh-h b').textContent = v; updHeader(tr); dirty(); } },
  async speed(el) { S.cur.speed = +el.value / 100; renderStudio(); await restartIfPlaying(); },
  async inSel(el) { const d = S.inputs.find(x => x.deviceId === el.value); cfg.inputId = el.value; cfg.inputLabel = d ? d.label : ''; saveCfg(); closeMicNow(); try { await ensureMic(); } catch (e) { /* aviso já dado */ } renderSheet(); }
};
async function importFile(f) {
  if (!f) return; ensureCtx(); closeSheet();
  toast('Abrindo a música…', 0);
  try {
    const buf = await f.arrayBuffer(); const ab = await new Promise((res, rej) => ctx.decodeAudioData(buf, res, rej));
    const chans = []; for (let c = 0; c < Math.min(2, ab.numberOfChannels); c++) chans.push(ab.getChannelData(c).slice());
    const p = S.cur; const tr = makeTrack({ name: f.name.replace(/\.[^.]+$/, '').slice(0, 28) || 'Música', type: 'import', color: COLORS[1], vol: .8 });
    const k = makeTake(simplify(chans), ab.sampleRate, 0, 'Arquivo'); await saveTakeAudio(k);
    tr.takes = [k]; tr.clips = [clipOf(k, 0)]; p.tracks.unshift(tr); hideToast(); renderStudio(); saveProject(p);
    toast('Música importada. Toque no nome da faixa para mudar o tom.');
  } catch (e) { hideToast(); toast(e && e.name === 'QuotaExceededError' ? 'Sem espaço no celular para esta música.' : 'Não deu para abrir este arquivo. Tente um MP3.'); }
}

/* laço de quadros */
function tick() {
  requestAnimationFrame(tick); if (!S.cur || S.screen !== 'studio') return;
  if (P.playing) {
    const p = curPos();
    if (P.metro) { const spb = 60 / S.cur.bpm; for (; ;) { const bt = P.nextBeat * spb; if (bt > p + .35 * P.speed) break; if (bt >= P.from - 1e-6) click(P.t0 + (bt - P.from) / P.speed, P.nextBeat % 4 === 0); P.nextBeat++; } }
    if (S.recording && S.recording.end != null && !S.counting && p >= S.recording.end + .2) { stopRecord(); return; }
    if (P.mode === 'studio' && !S.recording) { if (S.loop) { const [a, b] = loopRange(); if (b - a > .2 && p >= b) { startAt(a); return; } } if (p >= P.end) { stopPlay(); S.pos = P.end; } }
  }
  frameStudio();
}

/* ---------------- avisos e eventos ---------------- */
let toastT = 0;
function toast(msg, ms = 2800) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); if (ms) toastT = setTimeout(() => { t.hidden = true; }, ms); }
function hideToast() { $('#toast').hidden = true; }

document.addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (!b || b.disabled) return; const f = ACT[b.dataset.act]; if (f) f(b, e); });
document.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[role=button][data-act]')) { e.preventDefault(); e.target.click(); } });
document.addEventListener('input', e => { const k = e.target.dataset && e.target.dataset.inp; if (k && INP[k]) INP[k](e.target); });
document.addEventListener('change', e => { if (e.target.id === 'fileIn') importFile(e.target.files[0]); else if (e.target.dataset.ch) CH[e.target.dataset.ch](e.target); else if (e.target.dataset.inp === 'speed') CH.speed(e.target); });
window.addEventListener('popstate', () => {
  if (S.sheet) { stopHear(); S.sheet = null; renderSheet(); return; }
  if (S.screen === 'studio') goHome();
});
document.addEventListener('visibilitychange', () => { if (document.hidden) { if (S.recording || S.counting) stopRecord(); else stopPlay(); if (S.cur) saveProject(S.cur); } });
if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) navigator.mediaDevices.addEventListener('devicechange', async () => { await refreshInputs(); if (S.sheet && S.sheet.kind === 'settings') renderSheet(); });
let rz = 0; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { if (S.screen === 'studio') renderStudio(); }, 200); });

/* instalar como app */
let instEvt = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); instEvt = e; if (S.screen === 'projects') renderProjects(); });
window.addEventListener('appinstalled', () => { instEvt = null; if (S.screen === 'projects') renderProjects(); toast('App instalado. Ele fica na tela inicial com o ícone vermelho e amarelo.', 4000); });

/* versão nova do app */
function showUpdate(reg) {
  if ($('.upd')) return; const d = document.createElement('div'); d.className = 'upd';
  d.innerHTML = '<span>Tem uma versão nova do app.</span><button class="btn-acc" id="updBtn">Atualizar</button>'; document.body.appendChild(d);
  $('#updBtn').onclick = () => { if (reg.waiting) reg.waiting.postMessage('skip'); else location.reload(); };
}
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').then(reg => {
    if (reg.waiting && navigator.serviceWorker.controller) showUpdate(reg);
    reg.addEventListener('updatefound', () => { const w = reg.installing; w && w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) showUpdate(reg); }); });
    setInterval(() => reg.update().catch(() => { }), 30 * 60 * 1000);
  }).catch(() => { });
  let reloaded = false; navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloaded) { reloaded = true; location.reload(); } });
}

(async function boot() {
  try { S.projects = (await db.all('proj')) || []; } catch (e) { S.projects = []; toast('Este navegador não deixa guardar projetos. Abra no Chrome.', 6000); }
  S.projects.forEach(p => { p.tracks.forEach(t => t.takes.forEach(k => { if (k.video && !k.video.v) { k.video.t0 -= (cfg.camLat || 90) / 1000; k.video.v = 2; saveProject(p); } })); });
  S.projects.forEach(p => { p.loaded = false; p.undo = []; p.tracks.forEach(t => t.takes.forEach(k => { if (k.id > uid) uid = k.id; })); if (p.id > uid) uid = p.id; p.tracks.forEach(t => { if (t.id > uid) uid = t.id; t.clips.forEach(c => { if (c.id > uid) uid = c.id; }); }); });
  history.replaceState({ base: 1 }, '');
  render(); requestAnimationFrame(tick);
  if (cfg.recal) { delete cfg.recal; saveCfg(); setTimeout(() => toast('O app mudou o jeito de tocar o som para não falhar. Calibre o atraso de novo em Ajustes antes de gravar.', 7000), 600); }
})();
