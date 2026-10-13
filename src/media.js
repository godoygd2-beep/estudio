// Entrada de áudio (Cuvave pela USB), câmera e gravação de vídeo.
let workletReady = null;

export async function listInputs() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return [];
  const d = await navigator.mediaDevices.enumerateDevices();
  return d.filter(x => x.kind === 'audioinput' && x.deviceId);
}

export function guessUsb(list) {
  return list.find(d => /usb|cuvave|interface|audio device|codec/i.test(d.label) && !/default|padr/i.test(d.deviceId + d.label)) || null;
}

export async function openMic(ctx, deviceId) {
  const base = { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: { ideal: 2 }, latency: { ideal: 0 } };
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: deviceId ? { ...base, deviceId: { exact: deviceId } } : base });
  } catch (e) {
    if (!deviceId || e.name === 'NotAllowedError') throw e;
    stream = await navigator.mediaDevices.getUserMedia({ audio: base });
  }
  if (!workletReady) workletReady = ctx.audioWorklet.addModule(new URL('./rec-worklet.js', import.meta.url));
  await workletReady;
  const src = ctx.createMediaStreamSource(stream);
  const node = new AudioWorkletNode(ctx, 'rec', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1], channelCount: 2, channelCountMode: 'explicit', channelInterpretation: 'speakers' });
  const sink = ctx.createGain(); sink.gain.value = 0;
  src.connect(node); node.connect(sink); sink.connect(ctx.destination);
  const track = stream.getAudioTracks()[0];
  return { stream, src, node, sink, track, settings: track.getSettings ? track.getSettings() : {}, label: track.label };
}

export function closeMic(m) {
  if (!m) return;
  try { m.src.disconnect(); m.node.disconnect(); m.sink.disconnect(); } catch (e) { /* já desligado */ }
  m.stream.getTracks().forEach(t => t.stop());
}

export async function openCam(facing, q) {
  const long = q === '720' ? 1280 : 1920, short = q === '720' ? 720 : 1080;
  return navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { facingMode: facing === 'front' ? 'user' : 'environment', width: { ideal: long }, height: { ideal: short }, frameRate: { ideal: 30 } }
  });
}

export function closeCam(s) { if (s) s.getTracks().forEach(t => t.stop()); }

export function pickVideoMime() {
  if (!window.MediaRecorder) return '';
  const c = ['video/mp4;codecs=avc1.640028', 'video/mp4;codecs=avc1.42E01F', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  return c.find(m => MediaRecorder.isTypeSupported(m)) || '';
}
