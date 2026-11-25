// Yakalanma anındaki jumpscare: ekranı kaplayan, önden görünen Gromm yüzü.
//
// Yüz kodla çizilir (64x64 pixel art) ve tam sayı katlarıyla büyütülür.
// Zaman çizelgesi (t: yakalanmadan beri geçen süre, sn):
//   0.00-0.20  oyun donar, ekran kararır
//   0.20-1.25  yüz belirir ve hızla yaklaşır; sert sarsıntı, kırmızı flaş, çığlık
//   1.25-1.50  kararır
// Sonrasını (yazı ve yeniden başlama) oyun sahnesi yönetir.

import { makeRng } from './rng.js';

export const JUMPSCARE = { freeze: 0.2, faceEnd: 1.25, end: 1.5 };

const S = 64;
// Taş deri: koyudan açığa
const SKIN = ['#07050b', '#160f1e', '#261b32', '#3a2b4a', '#4f3e62', '#6a5880', '#8a78a0'];
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

let FACE = null;

/** Yüzü bir kere çizer ve önbelleğe alır. Gözler ayrı katmanda (parlatmak için). */
export function grommFace() {
  if (FACE) return FACE;
  const rng = makeRng(666);
  const base = document.createElement('canvas');
  base.width = base.height = S;
  const g = base.getContext('2d');
  const px = (x, y, c) => {
    g.fillStyle = c;
    g.fillRect(x, y, 1, 1);
  };

  // --- Kafa silüeti: geniş çene, pürüzlü kaya kenarı ---
  const cx = 32, cy = 35;
  const phase = [rng.range(0, 6), rng.range(0, 6), rng.range(0, 6)];
  const radius = (a) => {
    // aşağı doğru daha geniş (çene), üstte daha dar
    const base = 26 + Math.sin(a) * 3.5;
    return base + Math.sin(a * 5 + phase[0]) * 1.4 + Math.sin(a * 9 + phase[1]) * 0.9 + Math.sin(a * 13 + phase[2]) * 0.6;
  };
  const inHead = (x, y) => {
    const dx = (x + 0.5 - cx) / 1.12, dy = y + 0.5 - cy;
    return Math.hypot(dx, dy) <= radius(Math.atan2(dy, dx));
  };
  const noise = new Float32Array(S * S);
  for (let i = 0; i < S * S; i++) noise[i] = rng();

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      if (!inHead(x, y)) continue;
      // ışık sol üstten; kenarlara doğru koyulaşır
      const nx = (x - cx) / 30, ny = (y - cy) / 30;
      let l = 0.55 - nx * 0.25 - ny * 0.35 - (nx * nx + ny * ny) * 0.55;
      l += (noise[y * S + x] - 0.5) * 0.18;
      // taş levhalar: büyük ölçekli yamalar
      l += Math.sin(x * 0.45 + phase[0]) * Math.cos(y * 0.38 + phase[1]) * 0.08;
      let k = l * (SKIN.length - 1);
      const th = BAYER[((y & 3) << 2) | (x & 3)] / 16;
      k = Math.floor(k + th);
      k = Math.max(1, Math.min(SKIN.length - 1, k));
      px(x, y, SKIN[k]);
    }
  }
  // dış hat
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      if (!inHead(x, y)) continue;
      if (!inHead(x - 1, y) || !inHead(x + 1, y) || !inHead(x, y - 1) || !inHead(x, y + 1)) px(x, y, SKIN[0]);
    }
  }

  // --- Kafa üstündeki sivri, geriye kıvrık dikenler (düzensiz) ---
  const spikes = [[-16, 10, -0.7], [-7, 15, -0.3], [5, 17, 0.25], [15, 11, 0.65]];
  for (const [ox, h, lean] of spikes) {
    const bx = cx + ox, by = cy - radius(-Math.PI / 2) + 4 + Math.abs(ox) * 0.3;
    for (let i = 0; i < h; i++) {
      const k = i / h;
      const w = Math.max(0, Math.round((1 - k) * 3.4));
      const sx = Math.round(bx + lean * i * (1 + k));
      const y = Math.round(by - i);
      for (let x = sx - w; x <= sx + w; x++) {
        const edge = x === sx - w || x === sx + w || i === h - 1;
        px(x, y, edge ? SKIN[0] : x < sx ? SKIN[4] : SKIN[2]);
      }
    }
  }
  // elmacık kemikleri ve altlarındaki derin gölge (kafatası hissi)
  for (const side of [-1, 1]) {
    for (let y = 31; y <= 39; y++) {
      for (let x = 0; x < S; x++) {
        const dx = (x - (cx + side * 17)) / 7, dy = (y - 34) / 3.2;
        if (dx * dx + dy * dy > 1 || !inHead(x, y)) continue;
        const th = BAYER[((y & 3) << 2) | (x & 3)] / 16;
        if (y < 33) px(x, y, th < 0.5 ? SKIN[5] : SKIN[4]);
        else if (th < 0.6) px(x, y, SKIN[1]);
      }
    }
  }

  // --- Çatlaklar ---
  for (let c = 0; c < 9; c++) {
    let x = cx + rng.range(-22, 22), y = cy + rng.range(-20, 6);
    const ang = rng.range(0, Math.PI * 2);
    for (let i = 0; i < rng.int(5, 11); i++) {
      if (inHead(Math.round(x), Math.round(y))) {
        px(Math.round(x), Math.round(y), SKIN[0]);
        if (inHead(Math.round(x) + 1, Math.round(y))) px(Math.round(x) + 1, Math.round(y), SKIN[4]);
      }
      x += Math.cos(ang + rng.range(-0.7, 0.7));
      y += Math.sin(ang + rng.range(-0.7, 0.7));
    }
  }

  // --- Derin göz çukurları ve içe doğru çökmüş öfkeli kaşlar ---
  const eyeY = 27;
  for (const ex of [cx - 11, cx + 11]) {
    const inward = ex < cx ? 1 : -1; // burna doğru yön
    for (let y = eyeY - 6; y <= eyeY + 6; y++) {
      for (let x = ex - 9; x <= ex + 9; x++) {
        const d = ((x - ex) / 8.5) ** 2 + ((y - eyeY - 0.5) / 5) ** 2;
        if (d <= 1) px(x, y, d < 0.6 ? '#010002' : SKIN[0]);
      }
    }
    // kaş: dış uçta yüksek, burna doğru sert iniş
    for (let i = 0; i <= 12; i++) {
      const x = ex - inward * 8 + inward * i;
      const y = Math.round(eyeY - 7 + i * 0.42);
      px(x, y - 1, SKIN[6]);
      px(x, y, SKIN[5]);
      px(x, y + 1, SKIN[3]);
      px(x, y + 2, SKIN[0]);
    }
  }
  // kaşların arasında derin kırışıklar
  for (let y = eyeY - 4; y <= eyeY + 2; y++) {
    px(cx - 1, y, SKIN[0]);
    px(cx + 1, y + 1, SKIN[0]);
  }
  // burun delikleri
  for (const nx of [cx - 3, cx + 2]) {
    px(nx, 36, '#020104');
    px(nx + 1, 36, '#020104');
    px(nx, 37, '#020104');
    px(nx, 35, SKIN[5]);
  }

  // --- Açık ağız ---
  const my0 = 41, my1 = 60, mx0 = 13, mx1 = 51;
  // Ağız: üstü hafif düz, altı derin bir elips; köşeler hırlar gibi yukarı kalkık
  const inMouth = (x, y) => {
    const dx = (x + 0.5 - cx) / 19;
    const lift = dx * dx * 3; // köşeler yukarı
    const dy = (y + 0.5 - 50 + lift) / (y + lift < 50 ? 9 : 10.5);
    return dx * dx + dy * dy <= 1;
  };
  for (let y = my0; y <= my1; y++) {
    for (let x = mx0 - 4; x <= mx1 + 4; x++) {
      if (!inMouth(x, y)) continue;
      // boğaz: ortası en koyu, kenarlar koyu kırmızı (dithering)
      const d = Math.hypot((x - cx) / 18, (y - 52) / 8);
      const th = BAYER[((y & 3) << 2) | (x & 3)] / 16;
      const c = d + th * 0.35 < 0.55 ? '#050002' : d + th * 0.35 < 0.95 ? '#2a0208' : '#5a0a14';
      px(x, y, c);
    }
  }
  // dudak hattı
  for (let y = my0 - 1; y <= my1 + 1; y++) {
    for (let x = mx0 - 5; x <= mx1 + 5; x++) {
      if (inMouth(x, y)) continue;
      if (inMouth(x + 1, y) || inMouth(x - 1, y) || inMouth(x, y + 1) || inMouth(x, y - 1)) px(x, y, SKIN[0]);
    }
  }
  // --- Dişler: düzensiz, araları boşluklu; köşelerde uzun, kıvrık azılar ---
  const tooth = (x, y, w, h, down, curl = 0) => {
    for (let i = 0; i < h; i++) {
      const k = i / h;
      const half = (w / 2) * (1 - k);
      const cxT = x + curl * k * k * 3;
      const yy = down ? y + i : y - i;
      for (let xx = Math.round(cxT - half); xx <= Math.round(cxT + half); xx++) {
        if (!inMouth(xx, yy) && !inMouth(xx, yy + (down ? 1 : -1))) continue;
        const edge = xx <= Math.round(cxT - half) || xx >= Math.round(cxT + half);
        px(xx, yy, edge ? '#4a3e2c' : xx < cxT ? '#f6eed6' : k > 0.6 ? '#9c9070' : '#cfc3a2');
      }
    }
  };
  // üst sıra
  // üst çenenin kenarı (her x için ağzın ilk satırı)
  const topY = (x) => { for (let y = 30; y < 64; y++) if (inMouth(x, y)) return y; return 64; };
  const botY = (x) => { for (let y = 63; y > 30; y--) if (inMouth(x, y)) return y; return 30; };
  const upper = [[cx - 15, 4, 13, -0.7], [cx - 10, 3, 6], [cx - 6, 3, 8], [cx - 1, 3, 5], [cx + 4, 3, 7], [cx + 9, 3, 5], [cx + 14, 4, 14, 0.7]];
  for (const [tx, w, h, curl] of upper) tooth(tx, topY(Math.round(tx)), w, h, true, curl || 0);
  const lower = [[cx - 12, 4, 9, 0.5], [cx - 6, 3, 5], [cx + 1, 3, 6], [cx + 7, 3, 4], [cx + 12, 4, 10, -0.5]];
  for (const [tx, w, h, curl] of lower) tooth(tx, botY(Math.round(tx)), w, h, false, curl || 0);
  // salya
  for (const [sx, len] of [[cx - 8, 6], [cx + 6, 8]]) {
    const y0 = topY(sx) + 4;
    for (let i = 0; i < len; i++) px(sx, y0 + i, i === len - 1 ? '#b8c0c8' : '#5a6068');
  }

  // --- Gözler (ayrı katman): eğik, kısık; parlayan kırmızı, ince yarık göz bebeği ---
  const eyes = document.createElement('canvas');
  eyes.width = eyes.height = S;
  const e = eyes.getContext('2d');
  for (const ex of [cx - 11, cx + 11]) {
    const inward = ex < cx ? 1 : -1;
    for (let xx = ex - 6; xx <= ex + 6; xx++) {
      const u = (xx - ex) / 6; // -1..1
      const slant = Math.round(u * inward * 1.6); // burna doğru aşağı
      const half = Math.round(2.4 * Math.sqrt(Math.max(0, 1 - u * u)));
      for (let y = -half; y <= half; y++) {
        const yy = eyeY + 1 + slant + y;
        const core = Math.abs(u) < 0.35 && Math.abs(y) <= 1;
        e.fillStyle = core ? '#ffd890' : Math.abs(y) === half ? '#8a0606' : '#ff2a12';
        e.fillRect(xx, yy, 1, 1);
      }
    }
    e.fillStyle = '#140000';
    e.fillRect(ex, eyeY - 1, 1, 5);
  }

  FACE = { base, eyes, eyeY, cx };
  return FACE;
}

/**
 * Jumpscare'i çizer. t: yakalanmadan beri süre. rnd: sarsıntı için.
 * Ekranın tamamını kaplar (alttaki oyunun üstüne).
 */
export function drawJumpscare(ctx, w, h, t) {
  const J = JUMPSCARE;
  // donma: hızla kararan ekran
  if (t < J.freeze) {
    ctx.fillStyle = `rgba(0,0,0,${Math.min(1, t / 0.1).toFixed(2)})`;
    ctx.fillRect(0, 0, w, h);
    return;
  }
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  if (t > J.faceEnd) return;

  const f = grommFace();
  const k = (t - J.freeze) / (J.faceEnd - J.freeze); // 0..1
  // ölçek: tam sayı adımlarla hızla büyür (yaklaşır)
  // ekranın kısa kenarının yarısından, kısa kenarı taşana kadar
  const s0 = Math.max(2, Math.floor((Math.min(w, h) * 0.5) / S));
  const s1 = Math.max(s0 + 2, Math.ceil((Math.min(w, h) * 1.3) / S));
  const ease = 1 - Math.pow(1 - Math.min(1, k * 1.5), 3);
  const sc = Math.max(s0, Math.round(s0 + (s1 - s0) * ease));
  // sert sarsıntı: başta en güçlü
  const amp = Math.max(2, sc * 0.9) * (1 - k * 0.5);
  const jx = Math.round((Math.random() * 2 - 1) * amp), jy = Math.round((Math.random() * 2 - 1) * amp);
  const size = S * sc;
  const x = Math.round(w / 2 - size / 2) + jx;
  const y = Math.round(h / 2 - size * 0.55) + jy;

  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(f.base, x, y, size, size);
  // gözler titreyerek parlar, etrafında kırmızı hale
  const flick = 0.75 + Math.random() * 0.25;
  ctx.globalAlpha = 0.35 * flick;
  ctx.fillStyle = '#ff1a10';
  for (const ex of [f.cx - 11, f.cx + 11]) {
    const gx = x + (ex - 7) * sc, gy = y + (f.eyeY - 5) * sc;
    // dithering'li hale: iri pikseller
    for (let yy = 0; yy < 11; yy++) {
      for (let xx = 0; xx < 15; xx++) {
        if ((xx + yy) & 1) continue;
        const d = ((xx - 7) / 7) ** 2 + ((yy - 5) / 5) ** 2;
        if (d < 1 && d > 0.3) ctx.fillRect(gx + xx * sc, gy + yy * sc, sc, sc);
      }
    }
  }
  ctx.globalAlpha = flick;
  ctx.drawImage(f.eyes, x, y, size, size);
  ctx.globalAlpha = 1;

  // kırmızı flaş: girişte güçlü, sonra nabız gibi
  const flash = Math.max(0, 0.65 - k * 2.2) + (Math.sin(t * 40) > 0.6 ? 0.12 : 0);
  if (flash > 0) {
    ctx.fillStyle = `rgba(200,0,0,${flash.toFixed(2)})`;
    ctx.fillRect(0, 0, w, h);
  }
}
