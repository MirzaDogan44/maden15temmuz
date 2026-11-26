// Ses sistemi. Bütün sesler Web Audio API ile kodla üretilir, ses dosyası yok.
//
// Tarayıcılar kullanıcı dokunmadan ses çalmaya izin vermez. Bu yüzden
// init() kullanıcı jesti sayılan olaylarda çağrılır (bkz. input.js onGesture).
//
// Yapı:
//   efektler -> sfxBus ---------------------------> master -> hoparlör
//            -> reverbSend -> mağara yankısı -> sfxBus
//   müzik    -> musicBus (+ kendi yankısı) ----> master

let ctx = null;
let master = null;
let reverb = null;
let reverbSend = null;
let noiseBuf = null;
let muted = false;
/** Ses efektleri ve müzik ayrı kanallardan geçer (ayarlardan ayrı ayrı kapatılabilir). */
let sfxBus = null;
let musicBus = null;
let musicReverb = null;
const busOn = { sfx: true, music: true };

const MUTE_KEY = 'gromm.muted';
try {
  muted = localStorage.getItem(MUTE_KEY) === '1';
} catch {
  /* gizli sekmede localStorage olmayabilir */
}

const rand = (a, b) => a + Math.random() * (b - a);

/** Ses sistemini başlatır. Kullanıcı jesti içinde çağrılmalı. */
export function init() {
  // Jest sayılmayan bir olayda (ör. dokunmatik pointerdown) bağlam açma:
  // tarayıcı askıda başlatıp uyarı verir. Bir sonraki jestte (pointerup) açılır.
  const ua = navigator.userActivation;
  if (!ctx && ua && !ua.isActive) return false;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 1;
    master.connect(ctx.destination);
    sfxBus = ctx.createGain();
    sfxBus.gain.value = busOn.sfx ? 1 : 0;
    sfxBus.connect(master);
    musicBus = ctx.createGain();
    musicBus.gain.value = busOn.music ? 1 : 0;
    musicBus.connect(master);

    // Beyaz gürültü (çakıl, taş, rüzgâr gibi seslerin hammaddesi)
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

    // Mağara yankısı: kodla üretilmiş, yavaşça sönen gürültü darbesi.
    const len = Math.floor(ctx.sampleRate * 2.6);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        const t = i / ctx.sampleRate;
        data[i] = (Math.random() * 2 - 1) * Math.exp(-t * 2.3) * (t < 0.02 ? t / 0.02 : 1);
      }
    }
    reverb = ctx.createConvolver();
    reverb.buffer = ir;
    const wet = ctx.createGain();
    wet.gain.value = 0.55;
    reverb.connect(wet).connect(sfxBus);
    // müziğin kendi yankısı (müzik kapanınca kuyruğu da susar)
    musicReverb = ctx.createConvolver();
    musicReverb.buffer = ir;
    const mwet = ctx.createGain();
    mwet.gain.value = 0.9;
    musicReverb.connect(mwet).connect(musicBus);
    reverbSend = ctx.createGain();
    reverbSend.gain.value = 1;
    reverbSend.connect(reverb);
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

/** Müzik / ses efektleri kanalını aç-kapa (ayarlar). */
export function setBus(name, on) {
  busOn[name] = on;
  const bus = name === 'music' ? musicBus : sfxBus;
  if (bus) bus.gain.setTargetAtTime(on ? 1 : 0, ctx.currentTime, 0.05);
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

/** Çıkış zinciri: kazanç + stereo kaydırma + isteğe bağlı yankı. */
function out(gain, pan = 0, wet = 0) {
  const g = ctx.createGain();
  g.gain.value = gain;
  let node = g;
  if (ctx.createStereoPanner) {
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    g.connect(p);
    node = p;
    g.__pan = p;
  }
  node.connect(sfxBus);
  if (wet > 0) {
    const s = ctx.createGain();
    s.gain.value = wet;
    node.connect(s).connect(reverbSend);
  }
  return g;
}

function noiseSource(rate = 1) {
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  s.playbackRate.value = rate;
  return s;
}

/** Ses çalınabilir mi? (Arka plandayken birikip sonra hepsi birden çalmasın.) */
function live() {
  return ctx && ctx.state === 'running' && !document.hidden;
}

/** Kısa, yumuşak bir arayüz tık sesi. */
export function playUiTap() {
  if (!live()) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(520, t);
  osc.frequency.exponentialRampToValueAtTime(260, t + 0.06);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.12, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
  osc.connect(g).connect(sfxBus);
  osc.start(t);
  osc.stop(t + 0.1);
}

/** Başlangıç ekranından oyuna geçerken derin, boğuk bir gümbürtü. */
export function playStartRumble() {
  if (!live()) return;
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
  osc.connect(lp).connect(g).connect(out(1, 0, 0.6));
  osc.start(t);
  osc.stop(t + 1.5);
}

/**
 * Madencinin adımı: çakıl ezilmesi. Her adım biraz farklı (perde, ses, renk).
 * run: koşarken daha sert ve yüksek.
 */
export function playStep(run = false) {
  if (!live()) return;
  const t = ctx.currentTime;
  const dur = run ? rand(0.05, 0.08) : rand(0.04, 0.065);
  const src = noiseSource(rand(0.7, 1.3));
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = rand(1400, 2600) * (run ? 1.15 : 1);
  bp.Q.value = rand(0.7, 1.3);
  const g = ctx.createGain();
  const vol = (run ? 0.22 : 0.12) * rand(0.75, 1.1);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(bp).connect(g).connect(out(1, rand(-0.1, 0.1), 0.12));
  src.start(t, rand(0, 1.5));
  src.stop(t + dur + 0.02);

  // gövde: alçak, kısa bir tok ses
  const o = ctx.createOscillator();
  const og = ctx.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(rand(85, 110), t);
  o.frequency.exponentialRampToValueAtTime(50, t + 0.05);
  og.gain.setValueAtTime(0.0001, t);
  og.gain.exponentialRampToValueAtTime(run ? 0.12 : 0.06, t + 0.004);
  og.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
  o.connect(og).connect(sfxBus);
  o.start(t);
  o.stop(t + 0.08);
}

/** Meşale çıtırtısı. vol 0..1, pan -1..1 */
export function playTorchCrackle(vol, pan) {
  if (!live() || vol < 0.02) return;
  const t = ctx.currentTime;
  const n = Math.floor(rand(1, 4));
  for (let k = 0; k < n; k++) {
    const st = t + k * rand(0.02, 0.07);
    const src = noiseSource(rand(1.5, 2.5));
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = rand(2500, 5000);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, st);
    g.gain.exponentialRampToValueAtTime(0.09 * vol * rand(0.5, 1), st + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, st + rand(0.01, 0.03));
    src.connect(hp).connect(g).connect(out(1, pan, 0.1));
    src.start(st, rand(0, 1.8));
    src.stop(st + 0.05);
  }
}

// ---------------------------------------------------------------------------
// Ambiyans
// ---------------------------------------------------------------------------

let ambience = null;

/** Arkada sürekli çalan uğultu ve rastgele aralıklı mağara sesleri. */
export function startAmbience() {
  if (!ctx || ambience) return;
  const t = ctx.currentTime;
  const bus = ctx.createGain();
  bus.gain.setValueAtTime(0.0001, t);
  bus.gain.exponentialRampToValueAtTime(1, t + 3);
  bus.connect(sfxBus);

  // Alçak uğultu: iki derin, hafifçe akortsuz ton + çok boğuk gürültü.
  const humGain = ctx.createGain();
  humGain.gain.value = 0.07;
  humGain.connect(bus);
  const oscs = [];
  for (const [f, type, v] of [[41, 'sine', 1], [61.5, 'sine', 0.5], [82.3, 'triangle', 0.18]]) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = f;
    const g = ctx.createGain();
    g.gain.value = v;
    o.connect(g).connect(humGain);
    o.start();
    oscs.push(o);
  }
  const rumble = noiseSource(0.4);
  rumble.loop = true;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 110;
  const rg = ctx.createGain();
  rg.gain.value = 0.5;
  rumble.connect(lp).connect(rg).connect(bus);
  rumble.start();
  // Uğultu yavaşça kabarıp söner.
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.07;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 0.025;
  lfo.connect(lfoGain).connect(humGain.gain);
  lfo.start();
  oscs.push(lfo);

  ambience = { bus, oscs, rumble, timers: [] };
  schedule(playDrip, 1.5, 6);
  schedule(playCreak, 7, 20);
  schedule(playRockfall, 12, 32);
}

function schedule(fn, min, max) {
  const tick = () => {
    if (!ambience) return;
    fn();
    ambience.timers.push(setTimeout(tick, rand(min, max) * 1000));
  };
  ambience.timers.push(setTimeout(tick, rand(min, max) * 1000));
}

export function stopAmbience() {
  if (!ambience) return;
  for (const id of ambience.timers) clearTimeout(id);
  const t = ctx.currentTime;
  ambience.bus.gain.setTargetAtTime(0.0001, t, 0.3);
  const a = ambience;
  setTimeout(() => {
    for (const o of a.oscs) o.stop();
    a.rumble.stop();
    a.bus.disconnect();
  }, 1500);
  ambience = null;
}

/** Su damlası: kısa, aşağı kayan bir "plip", bolca yankıyla. */
export function playDrip() {
  if (!live()) return;
  const t = ctx.currentTime;
  const pan = rand(-0.9, 0.9);
  const far = rand(0.3, 1);
  const drops = Math.random() < 0.25 ? 2 : 1;
  for (let k = 0; k < drops; k++) {
    const st = t + k * rand(0.25, 0.6);
    const o = ctx.createOscillator();
    o.type = 'sine';
    const f0 = rand(1300, 2300);
    o.frequency.setValueAtTime(f0, st);
    o.frequency.exponentialRampToValueAtTime(f0 * rand(0.35, 0.5), st + 0.05);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, st);
    g.gain.exponentialRampToValueAtTime(0.08 * far, st + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, st + 0.09);
    o.connect(g).connect(out(1, pan, 0.9));
    o.start(st);
    o.stop(st + 0.12);
  }
}

/** Eski tahta destek kirişinin gıcırtısı. */
export function playCreak() {
  if (!live()) return;
  const t = ctx.currentTime;
  const dur = rand(0.7, 1.6);
  const o = ctx.createOscillator();
  o.type = 'sawtooth';
  const base = rand(65, 110);
  const curve = new Float32Array(24);
  for (let i = 0; i < curve.length; i++) curve[i] = base * (1 + Math.sin(i * 0.9) * 0.05 + (Math.random() - 0.5) * 0.18);
  o.frequency.setValueCurveAtTime(curve, t, dur);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = rand(450, 900);
  bp.Q.value = 5;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.05, t + dur * 0.3);
  g.gain.linearRampToValueAtTime(0.03, t + dur * 0.7);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(bp).connect(g).connect(out(1, rand(-0.8, 0.8), 0.7));
  o.start(t);
  o.stop(t + dur + 0.05);
}

/** Uzaktan taş düşmesi: boğuk, birkaç küçük çarpma ve bir tok ses. */
export function playRockfall() {
  if (!live()) return;
  const t = ctx.currentTime;
  const pan = rand(-1, 1);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = rand(350, 700);
  const bus = out(1, pan, 0.8);
  lp.connect(bus);
  const n = Math.floor(rand(5, 12));
  let st = t;
  for (let k = 0; k < n; k++) {
    st += rand(0.04, 0.18) * (1 + k * 0.15);
    const src = noiseSource(rand(0.5, 1.2));
    const g = ctx.createGain();
    const v = 0.18 * Math.pow(0.82, k) * rand(0.6, 1);
    g.gain.setValueAtTime(0.0001, st);
    g.gain.exponentialRampToValueAtTime(v, st + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, st + rand(0.03, 0.09));
    src.connect(g).connect(lp);
    src.start(st, rand(0, 1.8));
    src.stop(st + 0.12);
  }
  const o = ctx.createOscillator();
  o.frequency.setValueAtTime(70, t);
  o.frequency.exponentialRampToValueAtTime(35, t + 0.3);
  const og = ctx.createGain();
  og.gain.setValueAtTime(0.0001, t);
  og.gain.exponentialRampToValueAtTime(0.1, t + 0.01);
  og.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
  o.connect(og).connect(lp);
  o.start(t);
  o.stop(t + 0.4);
}

/** Meşaleyi standdan alma: kısa bir alev "vuuş"u. */
export function playTorchPickup() {
  if (!live()) return;
  const t = ctx.currentTime;
  const src = noiseSource(0.8);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 0.8;
  bp.frequency.setValueAtTime(300, t);
  bp.frequency.exponentialRampToValueAtTime(1800, t + 0.25);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.25, t + 0.06);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
  src.connect(bp).connect(g).connect(out(1, 0, 0.3));
  src.start(t, rand(0, 1));
  src.stop(t + 0.45);
  playTorchCrackle(0.8, 0);
}

/** Meşaleyi söndürme: kısa bir "fısss". */
export function playTorchOut() {
  if (!live()) return;
  const t = ctx.currentTime;
  const src = noiseSource(1.2);
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.setValueAtTime(2500, t);
  hp.frequency.exponentialRampToValueAtTime(900, t + 0.45);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.16, t + 0.03);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
  src.connect(hp).connect(g).connect(out(1, 0, 0.2));
  src.start(t, rand(0, 1));
  src.stop(t + 0.55);
}

/** Kazma vuruşu: metalik "tink" + taşın tok sesi. */
export function playPickHit() {
  if (!live()) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  o.type = 'square';
  const f = rand(1800, 2400);
  o.frequency.setValueAtTime(f, t);
  o.frequency.exponentialRampToValueAtTime(f * 0.7, t + 0.08);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = f;
  bp.Q.value = 6;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.12, t + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
  o.connect(bp).connect(g).connect(out(1, 0, 0.35));
  o.start(t);
  o.stop(t + 0.14);
  const src = noiseSource(rand(0.5, 0.8));
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 900;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0.0001, t);
  ng.gain.exponentialRampToValueAtTime(0.35, t + 0.003);
  ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
  src.connect(lp).connect(ng).connect(out(1, 0, 0.3));
  src.start(t, rand(0, 1.5));
  src.stop(t + 0.12);
}

/** Cevher kırılması: çatırtılı bir çöküş. */
export function playOreBreak() {
  if (!live()) return;
  const t = ctx.currentTime;
  for (let k = 0; k < 6; k++) {
    const st = t + k * rand(0.02, 0.06);
    const src = noiseSource(rand(0.6, 1.2));
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = rand(700, 1600);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, st);
    g.gain.exponentialRampToValueAtTime(0.3 * Math.pow(0.8, k), st + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, st + rand(0.05, 0.12));
    src.connect(lp).connect(g).connect(out(1, rand(-0.2, 0.2), 0.4));
    src.start(st, rand(0, 1.5));
    src.stop(st + 0.15);
  }
}

/** Cevheri çuvala koyma: kısa, parlak bir çınlama. */
export function playOrePickup(kind = 'gold') {
  if (!live()) return;
  const t = ctx.currentTime;
  const base = { gold: 880, crystal: 1175, ruby: 988 }[kind] || 880;
  [1, 1.5, 2].forEach((m, i) => {
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = base * m;
    const g = ctx.createGain();
    const st = t + i * 0.06;
    g.gain.setValueAtTime(0.0001, st);
    g.gain.exponentialRampToValueAtTime(0.07, st + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, st + 0.35);
    o.connect(g).connect(out(1, 0, 0.5));
    o.start(st);
    o.stop(st + 0.4);
  });
}

/** Asansöre cevher yükleme: tahta/metal "tok". */
export function playLoad() {
  if (!live()) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  o.type = 'triangle';
  o.frequency.setValueAtTime(220, t);
  o.frequency.exponentialRampToValueAtTime(110, t + 0.08);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.25, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
  o.connect(g).connect(out(1, 0, 0.4));
  o.start(t);
  o.stop(t + 0.2);
  const src = noiseSource(1.2);
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 2500;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0.0001, t);
  ng.gain.exponentialRampToValueAtTime(0.08, t + 0.002);
  ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
  src.connect(hp).connect(ng).connect(sfxBus);
  src.start(t, rand(0, 1.5));
  src.stop(t + 0.06);
}

/** Asansöre güç geldi: yükselen uğultu ve zil. */
export function playElevatorReady() {
  if (!live()) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(50, t);
  o.frequency.exponentialRampToValueAtTime(120, t + 0.8);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 400;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.18, t + 0.3);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
  o.connect(lp).connect(g).connect(out(1, 0, 0.5));
  o.start(t);
  o.stop(t + 1.2);
  for (const [f, d] of [[1320, 0.8], [1760, 0.95]]) {
    const b = ctx.createOscillator();
    b.type = 'sine';
    b.frequency.value = f;
    const bg = ctx.createGain();
    bg.gain.setValueAtTime(0.0001, t + d);
    bg.gain.exponentialRampToValueAtTime(0.1, t + d + 0.005);
    bg.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.8);
    b.connect(bg).connect(out(1, 0, 0.6));
    b.start(t + d);
    b.stop(t + d + 0.9);
  }
}

/** Asansörün yukarı çıkışı: zincir ve motor gürültüsü. */
export function playElevatorRide() {
  if (!live()) return;
  const t = ctx.currentTime;
  const src = noiseSource(0.5);
  src.loop = true;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 300;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.4, t + 0.4);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
  src.connect(lp).connect(g).connect(out(1, 0, 0.4));
  src.start(t);
  src.stop(t + 2.5);
  for (let k = 0; k < 10; k++) {
    const st = t + 0.2 + k * 0.2;
    const o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.value = rand(300, 380);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.0001, st);
    og.gain.exponentialRampToValueAtTime(0.03 * (1 - k / 10), st + 0.002);
    og.gain.exponentialRampToValueAtTime(0.0001, st + 0.04);
    o.connect(og).connect(sfxBus);
    o.start(st);
    o.stop(st + 0.05);
  }
}

// ---------------------------------------------------------------------------
// Gromm
// ---------------------------------------------------------------------------

/**
 * Gromm'un adımı: derin "GÜM". dist piksel, pan -1..1.
 * Uzaktayken boğuk ve kısık (low-pass), yakındayken sert ve yüksek.
 */
export function playThud(dist, pan = 0) {
  if (!live()) return;
  const near = Math.max(0, 1 - dist / 950);
  if (near <= 0) return;
  const t = ctx.currentTime;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 90 + 900 * near * near;
  lp.Q.value = 0.7;
  const bus = out(1, pan * 0.8, 0.5 + (1 - near) * 0.4);
  lp.connect(bus);
  // gövde: hızla düşen alçak ton
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(rand(62, 75), t);
  o.frequency.exponentialRampToValueAtTime(28, t + 0.35);
  const g = ctx.createGain();
  const vol = 0.75 * Math.pow(near, 1.4) + 0.04;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
  o.connect(g).connect(lp);
  o.start(t);
  o.stop(t + 0.55);
  // taş çatırtısı
  const src = noiseSource(rand(0.4, 0.7));
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0.0001, t);
  ng.gain.exponentialRampToValueAtTime(vol * 0.6, t + 0.005);
  ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
  src.connect(ng).connect(lp);
  src.start(t, rand(0, 1.5));
  src.stop(t + 0.2);
}

/** Gromm madenciyi fark etti: alçak, titreşimli bir hırıltı. */
export function playGrowl(dist = 0, pan = 0) {
  if (!live()) return;
  const near = Math.max(0.15, 1 - dist / 700);
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(70, t);
  o.frequency.linearRampToValueAtTime(95, t + 0.3);
  o.frequency.exponentialRampToValueAtTime(50, t + 1.1);
  const am = ctx.createOscillator();
  am.frequency.value = 22;
  const amg = ctx.createGain();
  amg.gain.value = 0.4;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.3 * near, t + 0.15);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
  am.connect(amg).connect(g.gain);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 500;
  o.connect(lp).connect(g).connect(out(1, pan, 0.6));
  o.start(t);
  am.start(t);
  o.stop(t + 1.3);
  am.stop(t + 1.3);
}

/** Kükreme (yakalama ve bölüm geçişi). */
export function playRoar() {
  if (!live()) return;
  const t = ctx.currentTime;
  for (const [f0, v] of [[90, 0.4], [137, 0.25], [61, 0.35]]) {
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(f0 * 0.8, t);
    o.frequency.linearRampToValueAtTime(f0 * 1.2, t + 0.25);
    o.frequency.exponentialRampToValueAtTime(f0 * 0.5, t + 1.6);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + 0.1);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    o.connect(lp).connect(g).connect(out(1, 0, 0.7));
    o.start(t);
    o.stop(t + 1.9);
  }
  const src = noiseSource(0.6);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 600;
  bp.Q.value = 0.6;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0.0001, t);
  ng.gain.exponentialRampToValueAtTime(0.35, t + 0.1);
  ng.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
  src.connect(bp).connect(ng).connect(out(1, 0, 0.6));
  src.start(t);
  src.stop(t + 1.6);
}

/** Kalp atışı (iki vuruş: "tu-dum"). vol 0..1 */
export function playHeartbeat(vol) {
  if (!live() || vol < 0.02) return;
  const t = ctx.currentTime;
  [[0, 1], [0.16, 0.7]].forEach(([d, k]) => {
    const st = t + d;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(58, st);
    o.frequency.exponentialRampToValueAtTime(38, st + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, st);
    g.gain.exponentialRampToValueAtTime(0.5 * vol * k, st + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, st + 0.16);
    o.connect(g).connect(sfxBus);
    o.start(st);
    o.stop(st + 0.2);
  });
}

/** Nefes nefese kalma: iki kısa, hırıltılı soluk. vol 0..1 */
export function playBreath(vol = 1) {
  if (!live()) return;
  const t = ctx.currentTime;
  [[0, 0.32, 1], [0.42, 0.3, 0.8], [0.82, 0.34, 0.6]].forEach(([d, len, k]) => {
    const st = t + d;
    const src = noiseSource(rand(0.5, 0.7));
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(rand(700, 900), st);
    bp.frequency.linearRampToValueAtTime(rand(1100, 1400), st + len);
    bp.Q.value = 1.5;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, st);
    g.gain.linearRampToValueAtTime(0.16 * vol * k, st + len * 0.35);
    g.gain.exponentialRampToValueAtTime(0.0001, st + len);
    src.connect(bp).connect(g).connect(out(1, 0, 0.15));
    src.start(st, rand(0, 1.4));
    src.stop(st + len + 0.02);
  });
}

/**
 * Jumpscare çığlığı: yüksek, bozuk ve kısa. Birkaç testere dişi ses titreyerek
 * aşağı kayar, gürültüyle karışır ve sert bir distorsiyondan geçer.
 */
export function playScream() {
  if (!live()) return;
  const t = ctx.currentTime;
  const dur = 1.0;
  const shaper = ctx.createWaveShaper();
  const curve = new Float32Array(1024);
  for (let i = 0; i < curve.length; i++) {
    const x = (i / (curve.length - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * 6) * 0.9;
  }
  shaper.curve = curve;
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 120;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.55, t + 0.02);
  g.gain.setValueAtTime(0.55, t + dur * 0.6);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  shaper.connect(hp).connect(g).connect(out(1, 0, 0.35));
  const pre = ctx.createGain();
  pre.gain.value = 0.6;
  pre.connect(shaper);
  for (const [f0, f1] of [[880, 420], [1240, 560], [660, 300], [1720, 900]]) {
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(f0 * 0.85, t);
    o.frequency.linearRampToValueAtTime(f0, t + 0.08);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    // titreme (vibrato)
    const lfo = ctx.createOscillator();
    lfo.frequency.value = rand(28, 40);
    const lg = ctx.createGain();
    lg.gain.value = f0 * 0.05;
    lfo.connect(lg).connect(o.frequency);
    const og = ctx.createGain();
    og.gain.value = 0.25;
    o.connect(og).connect(pre);
    o.start(t);
    lfo.start(t);
    o.stop(t + dur + 0.05);
    lfo.stop(t + dur + 0.05);
  }
  const src = noiseSource(1.0);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.setValueAtTime(3000, t);
  bp.frequency.exponentialRampToValueAtTime(1200, t + dur);
  bp.Q.value = 0.8;
  const ng = ctx.createGain();
  ng.gain.value = 0.5;
  src.connect(bp).connect(ng).connect(pre);
  src.start(t);
  src.stop(t + dur + 0.05);
  // altta derin kükreme
  playRoar();
}

/**
 * Şalter: çok büyük, metalik "KLANK!". Sert bir darbe, uzun çınlayan
 * uyumsuz metal tınıları ve alçak bir tok ses; bolca mağara yankısı.
 */
export function playKlank() {
  if (!live()) return;
  const t = ctx.currentTime;
  const bus = out(1, 0, 0.9);
  // darbe
  const src = noiseSource(1.2);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 1800;
  bp.Q.value = 0.9;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0.0001, t);
  ng.gain.exponentialRampToValueAtTime(0.7, t + 0.002);
  ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
  src.connect(bp).connect(ng).connect(bus);
  src.start(t, rand(0, 1.5));
  src.stop(t + 0.1);
  // metal çınlaması (uyumsuz kısmi tonlar)
  for (const [f, v, d] of [[212, 0.22, 1.3], [347, 0.18, 1.0], [571, 0.14, 0.8], [893, 0.1, 0.6], [1297, 0.07, 0.45]]) {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = f * rand(0.99, 1.01);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g).connect(bus);
    o.start(t);
    o.stop(t + d + 0.05);
  }
  // tok gövde
  const o = ctx.createOscillator();
  o.frequency.setValueAtTime(95, t);
  o.frequency.exponentialRampToValueAtTime(42, t + 0.3);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.5, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
  o.connect(g).connect(bus);
  o.start(t);
  o.stop(t + 0.4);
}

/** Şalterin kolu inerken kısa bir sürtünme. */
export function playLeverPull() {
  if (!live()) return;
  const t = ctx.currentTime;
  const src = noiseSource(0.7);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.setValueAtTime(900, t);
  bp.frequency.linearRampToValueAtTime(500, t + 0.15);
  bp.Q.value = 3;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.12, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
  src.connect(bp).connect(g).connect(out(1, 0, 0.3));
  src.start(t, rand(0, 1.5));
  src.stop(t + 0.18);
}

// ---------------- Gromm'un kazması ----------------

/** Duvara dalış: kaya kazıma ve çatırtı. */
export function playDigScrape(dist = 0, pan = 0) {
  if (!live()) return;
  const near = Math.max(0.12, 1 - dist / 800);
  const t = ctx.currentTime;
  for (let k = 0; k < 4; k++) {
    const st = t + k * 0.2 + rand(0, 0.05);
    const src = noiseSource(rand(0.5, 0.8));
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = rand(300, 700);
    bp.Q.value = 1.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, st);
    g.gain.exponentialRampToValueAtTime(0.4 * near, st + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, st + 0.22);
    src.connect(bp).connect(g).connect(out(1, pan, 0.5));
    src.start(st, rand(0, 1.5));
    src.stop(st + 0.25);
  }
  playThud(dist * 0.8, pan);
}

/**
 * Yerin altından gelen sürekli gümbürtü. Dönen nesne her karede
 * set(ses 0..1, pan, parlaklık 0..1) ile güncellenir, stop() ile susar.
 */
export function startDigRumble() {
  if (!ctx) return { set() {}, stop() {} };
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  src.playbackRate.value = 0.35;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 120;
  lp.Q.value = 1.5;
  const o = ctx.createOscillator();
  o.type = 'triangle';
  o.frequency.value = 38;
  const og = ctx.createGain();
  og.gain.value = 0.5;
  // titreşim: gümbürtü sabit kalmasın
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 5.5;
  const lfoG = ctx.createGain();
  lfoG.gain.value = 0.35;
  const g = ctx.createGain();
  g.gain.value = 0.0001;
  lfo.connect(lfoG).connect(g.gain);
  const bus = out(1, 0, 0.35);
  src.connect(lp).connect(g);
  o.connect(og).connect(g);
  g.connect(bus);
  src.start(t, rand(0, 1.5));
  o.start(t);
  lfo.start(t);
  let stopped = false;
  return {
    set(vol, pan = 0, bright = 0) {
      if (stopped || !ctx) return;
      const now = ctx.currentTime;
      g.gain.setTargetAtTime(Math.max(0.0001, vol * 0.9), now, 0.08);
      lp.frequency.setTargetAtTime(90 + 500 * bright, now, 0.1);
      if (bus.__pan) bus.__pan.pan.setTargetAtTime(pan, now, 0.1);
    },
    stop() {
      if (stopped || !ctx) return;
      stopped = true;
      const now = ctx.currentTime;
      g.gain.setTargetAtTime(0.0001, now, 0.15);
      src.stop(now + 0.8);
      o.stop(now + 0.8);
      lfo.stop(now + 0.8);
    },
  };
}

/** Patlayarak çıkış: kaya patlaması, yağan taşlar. */
export function playRockBurst(dist = 0, pan = 0) {
  if (!live()) return;
  const near = Math.max(0.15, 1 - dist / 900);
  const t = ctx.currentTime;
  const src = noiseSource(0.5);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(2200 * near + 300, t);
  lp.frequency.exponentialRampToValueAtTime(150, t + 1.2);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.9 * near, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.3);
  src.connect(lp).connect(g).connect(out(1, pan, 0.8));
  src.start(t, rand(0, 0.5));
  src.stop(t + 1.4);
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(70, t);
  o.frequency.exponentialRampToValueAtTime(25, t + 0.6);
  const og = ctx.createGain();
  og.gain.setValueAtTime(0.0001, t);
  og.gain.exponentialRampToValueAtTime(0.9 * near, t + 0.01);
  og.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
  o.connect(og).connect(out(1, pan, 0.4));
  o.start(t);
  o.stop(t + 0.85);
  // ardından dökülen taşlar
  for (let k = 0; k < 7; k++) {
    const st = t + 0.15 + k * rand(0.06, 0.14);
    const s2 = noiseSource(rand(0.8, 1.4));
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = rand(800, 2200);
    bp.Q.value = 3;
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.0001, st);
    g2.gain.exponentialRampToValueAtTime(0.18 * near, st + 0.004);
    g2.gain.exponentialRampToValueAtTime(0.0001, st + 0.07);
    s2.connect(bp).connect(g2).connect(out(1, pan + rand(-0.2, 0.2), 0.5));
    s2.start(st, rand(0, 1.5));
    s2.stop(st + 0.08);
  }
}

// ---------------- Açlık ve soğuk ----------------

/** Yemek yeme: birkaç ıslak çiğneme/çıtırtı. */
export function playEat() {
  if (!live()) return;
  const t = ctx.currentTime;
  for (let k = 0; k < 4; k++) {
    const st = t + k * 0.17 + rand(0, 0.04);
    const src = noiseSource(rand(0.9, 1.3));
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = rand(900, 1700);
    bp.Q.value = 2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, st);
    g.gain.exponentialRampToValueAtTime(0.2, st + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, st + 0.09);
    src.connect(bp).connect(g).connect(out(1, 0, 0.15));
    src.start(st, rand(0, 1.5));
    src.stop(st + 0.1);
  }
}

/** Mide guruldaması: alçak, dalgalanan bir homurtu. */
export function playStomachGrowl() {
  if (!live()) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(rand(85, 110), t);
  o.frequency.linearRampToValueAtTime(rand(140, 170), t + 0.35);
  o.frequency.linearRampToValueAtTime(rand(70, 90), t + 0.8);
  const am = ctx.createOscillator();
  am.frequency.value = rand(14, 20);
  const amg = ctx.createGain();
  amg.gain.value = 0.5;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 380;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.12, t + 0.1);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
  am.connect(amg).connect(g.gain);
  o.connect(lp).connect(g).connect(out(1, 0, 0.2));
  o.start(t);
  am.start(t);
  o.stop(t + 1);
  am.stop(t + 1);
}

/** Diş takırtısı: hızlı, kuru tıkırtılar. */
export function playTeethChatter() {
  if (!live()) return;
  const t = ctx.currentTime;
  const n = 7 + Math.floor(Math.random() * 5);
  for (let k = 0; k < n; k++) {
    const st = t + k * rand(0.045, 0.06);
    const o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.value = rand(2200, 2800);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, st);
    g.gain.exponentialRampToValueAtTime(0.05, st + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, st + 0.02);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1500;
    o.connect(hp).connect(g).connect(out(1, 0, 0.1));
    o.start(st);
    o.stop(st + 0.03);
  }
}

// ---------------- Final: dinamit ----------------

/** Dinamit kurarken: ip/bant hışırtısı ve metal tık. */
export function playArmTick() {
  if (!live()) return;
  const t = ctx.currentTime;
  const src = noiseSource(rand(0.7, 1.1));
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = rand(1800, 3200);
  bp.Q.value = 1.5;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.12, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
  src.connect(bp).connect(g).connect(out(1, 0, 0.2));
  src.start(t, rand(0, 1.5));
  src.stop(t + 0.2);
  const o = ctx.createOscillator();
  o.type = 'square';
  o.frequency.value = rand(900, 1300);
  const og = ctx.createGain();
  og.gain.setValueAtTime(0.0001, t + 0.12);
  og.gain.exponentialRampToValueAtTime(0.06, t + 0.122);
  og.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
  o.connect(og).connect(out(1, 0, 0.2));
  o.start(t + 0.1);
  o.stop(t + 0.18);
}

/** Fitil tutuşması: cızırtı. */
export function playFuse(vol = 1, pan = 0) {
  if (!live()) return;
  const t = ctx.currentTime;
  const src = noiseSource(1.6);
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 3000;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.18 * vol, t + 0.05);
  g.gain.setValueAtTime(0.18 * vol, t + 0.5);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
  src.connect(hp).connect(g).connect(out(1, pan, 0.3));
  src.start(t, rand(0, 1));
  src.stop(t + 1);
}

/** Geri sayım tıkı (son saniyelerde daha tiz). */
export function playCountdownTick(urgent = false) {
  if (!live()) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  o.type = 'square';
  o.frequency.value = urgent ? 1320 : 660;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(urgent ? 0.09 : 0.05, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
  o.connect(g).connect(sfxBus);
  o.start(t);
  o.stop(t + 0.1);
}

/** Dev patlama: uzun, derin bir gümbürtü ve çöken kayalar. */
export function playBigExplosion(muffled = false) {
  if (!live()) return;
  const t = ctx.currentTime;
  const src = noiseSource(0.35);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(muffled ? 500 : 3000, t);
  lp.frequency.exponentialRampToValueAtTime(80, t + 4);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(1.0, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 4.5);
  src.connect(lp).connect(g).connect(out(1, 0, 1));
  src.start(t);
  src.stop(t + 4.6);
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(55, t);
  o.frequency.exponentialRampToValueAtTime(18, t + 3);
  const og = ctx.createGain();
  og.gain.setValueAtTime(0.0001, t);
  og.gain.exponentialRampToValueAtTime(1.0, t + 0.02);
  og.gain.exponentialRampToValueAtTime(0.0001, t + 3.2);
  o.connect(og).connect(out(1, 0, 0.5));
  o.start(t);
  o.stop(t + 3.3);
  for (let k = 0; k < 4; k++) playRockBurst(200 + k * 150, rand(-0.6, 0.6));
}

// ---------------- Menü müziği ----------------
//
// Yavaş, gizemli, hafif ürkütücü: derin bir arka ses (drone), üstünde seyrek
// ve yankılı minör notalar, arada maden sesleri. Notalar bir zamanlayıcıyla
// biraz ileriye planlanır; döngü kesintisiz sürer.

let music = null;
// La minör (doğal) dizisinden yumuşak notalar (Hz)
const NOTES = [220, 246.94, 261.63, 293.66, 329.63, 349.23, 392, 440, 523.25];
// Dönen bir motif: her döngüde aynı iskelet, küçük rastgele süslemeler
const MOTIF = [[4, 0], [2, 3], [1, 5], [0, 7], [-1, 0], [3, 3], [5, 2.5], [4, 4]];

function musicNote(f, t, len, vol) {
  const o = ctx.createOscillator();
  o.type = 'triangle';
  o.frequency.value = f;
  const o2 = ctx.createOscillator();
  o2.type = 'sine';
  o2.frequency.value = f * 2.001;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.04);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  const g2 = ctx.createGain();
  g2.gain.value = 0.25;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 1400;
  o.connect(lp);
  o2.connect(g2).connect(lp);
  lp.connect(g);
  g.connect(musicBus);
  const send = ctx.createGain();
  send.gain.value = 0.8;
  g.connect(send).connect(musicReverb);
  o.start(t);
  o2.start(t);
  o.stop(t + len + 0.1);
  o2.stop(t + len + 0.1);
}

/** Menü müziğini başlat (zaten çalıyorsa bir şey yapmaz). */
export function startMenuMusic() {
  if (!ctx || music) return;
  const t = ctx.currentTime;
  const bus = ctx.createGain();
  bus.gain.setValueAtTime(0.0001, t);
  bus.gain.exponentialRampToValueAtTime(1, t + 4);
  bus.connect(musicBus);
  // drone: derin, yavaşça nefes alan iki ton
  const oscs = [];
  const dg = ctx.createGain();
  dg.gain.value = 0.09;
  const dlp = ctx.createBiquadFilter();
  dlp.type = 'lowpass';
  dlp.frequency.value = 220;
  dg.connect(dlp).connect(bus);
  for (const [f, type] of [[55, 'sawtooth'], [55.4, 'sawtooth'], [82.4, 'sine']]) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = f;
    o.connect(dg);
    o.start(t);
    oscs.push(o);
  }
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.05;
  const lg = ctx.createGain();
  lg.gain.value = 90;
  lfo.connect(lg).connect(dlp.frequency);
  lfo.start(t);
  oscs.push(lfo);
  // seyrek notalar: 0.25 sn'de bir ileriye planlama
  const beat = 1.6;
  const state = { next: t + 2.5, step: 0, bus };
  const timer = setInterval(() => {
    if (!ctx || !music) return;
    const now = ctx.currentTime;
    while (state.next < now + 1) {
      const [deg, gap] = MOTIF[state.step % MOTIF.length];
      if (deg >= 0) {
        const f = NOTES[Math.max(0, Math.min(NOTES.length - 1, deg + (Math.random() < 0.15 ? 2 : 0)))];
        musicNote(f, state.next, 3.2, 0.07);
        // ara sıra alttan beşli
        if (state.step % 4 === 0) musicNote(f / 2, state.next + 0.02, 4, 0.04);
      }
      state.next += gap * beat * (0.9 + Math.random() * 0.2);
      state.step++;
    }
  }, 250);
  // arada maden sesleri (efekt kanalından)
  const fx = setInterval(() => {
    if (!music) return;
    const r = Math.random();
    if (r < 0.4) playDrip();
    else if (r < 0.55) playCreak();
    else if (r < 0.65) playThud(700 + Math.random() * 200, Math.random() * 2 - 1);
  }, 5200);
  music = { bus, oscs, timer, fx };
}

/** Menü müziğini yavaşça kıs ve durdur. */
export function stopMenuMusic(fade = 2) {
  if (!music) return;
  const m = music;
  music = null;
  clearInterval(m.timer);
  clearInterval(m.fx);
  const t = ctx.currentTime;
  m.bus.gain.cancelScheduledValues(t);
  m.bus.gain.setValueAtTime(Math.max(0.0001, m.bus.gain.value), t);
  m.bus.gain.exponentialRampToValueAtTime(0.0001, t + fade);
  setTimeout(() => {
    for (const o of m.oscs) o.stop();
    m.bus.disconnect();
  }, fade * 1000 + 200);
}
