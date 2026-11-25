// Ses sistemi. Bütün sesler Web Audio API ile kodla üretilir, ses dosyası yok.
//
// Tarayıcılar kullanıcı dokunmadan ses çalmaya izin vermez. Bu yüzden
// init() ilk dokunuşta (pointerdown içinde) çağrılır.
//
// Her ses için ayrı bir fonksiyon olacak (playStep, playThud ...). Şimdilik
// iskelet: başlatma, ana ses seviyesi, sessize alma ve bir arayüz tık sesi.

let ctx = null;
let master = null;
let muted = false;

const MUTE_KEY = 'gromm.muted';
try {
  muted = localStorage.getItem(MUTE_KEY) === '1';
} catch {
  /* gizli sekmede localStorage olmayabilir */
}

/** Ses sistemini başlatır. Kullanıcı jesti içinde çağrılmalı. */
export function init() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 1;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return true;
}

export function isReady() {
  return !!ctx && ctx.state === 'running';
}

export function isMuted() {
  return muted;
}

export function setMuted(m) {
  muted = m;
  try {
    localStorage.setItem(MUTE_KEY, m ? '1' : '0');
  } catch {
    /* önemli değil */
  }
  if (master) master.gain.setTargetAtTime(m ? 0 : 1, ctx.currentTime, 0.02);
}

export function toggleMute() {
  setMuted(!muted);
  return muted;
}

// Sekme gizlenince sesi duraklat, geri gelince devam et.
document.addEventListener('visibilitychange', () => {
  if (!ctx) return;
  if (document.hidden) ctx.suspend();
  else ctx.resume();
});

/** Kısa, yumuşak bir arayüz tık sesi. */
export function playUiTap() {
  if (!ctx) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(520, t);
  osc.frequency.exponentialRampToValueAtTime(260, t + 0.06);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.15, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
  osc.connect(g).connect(master);
  osc.start(t);
  osc.stop(t + 0.1);
}

/** Başlangıç ekranından oyuna geçerken derin, boğuk bir gümbürtü. */
export function playStartRumble() {
  if (!ctx) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const lp = ctx.createBiquadFilter();
  const g = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(55, t);
  osc.frequency.exponentialRampToValueAtTime(32, t + 1.2);
  lp.type = 'lowpass';
  lp.frequency.value = 180;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.35, t + 0.08);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
  osc.connect(lp).connect(g).connect(master);
  osc.start(t);
  osc.stop(t + 1.5);
}
