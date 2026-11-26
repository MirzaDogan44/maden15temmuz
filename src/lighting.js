// Işık ve karanlık.
//
// Dünya 4x4 piksellik "ışık hücrelerine" bölünür. Bir hücrenin ışığı:
//
//   ortam ışığı (loş, soğuk tonlu; köşelerde ve dar yerlerde daha az)
// + duvar lambaları (sıcak; açılışta bir kere hesaplanır)
// + titreyen ışıklar (meşaleler, stand meşaleleri, kristaller; açılışta
//   hesaplanır, her karede titreme katsayısıyla eklenir)
// + hareketli ışıklar (madencinin elindeki meşale; her karede hesaplanır)
//
// Karanlık bölgelerde ortam ışığı ve sabit ışıklar sıfırlanır; bölge
// sınırında birkaç tile boyunca yavaşça kararır. Orada sadece hareketli
// ışıklar (elde taşınan meşale) bir şey gösterir.
//
// Duvarlar ışığı keser: her hücreden ışık kaynağına kare kare bir ışın
// yürütülür, arada duvar varsa hücre o ışığı almaz.
//
// Sonra ekrandaki her piksel bu ışıkla çarpılır. Işık seviyeleri birkaç
// basamağa yuvarlanır ve basamaklar arası geçişte 4x4 Bayer deseniyle
// "dithering" yapılır (yumuşak gradyan yerine piksel desenli geçiş).

import { TILE } from './config.js';
import { hash2 } from './rng.js';

const CELL = 4;
const LEVELS = 6;
const BAYER = new Float32Array([0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16));

// Hiç ışık almayan yerlerin rengi: soğuk, koyu mavi-mor.
const AMB = [0.03, 0.028, 0.065];
const DARK = [5, 3, 13];

/** Normal bölgelerdeki loş ortam ışığı (soğuk ton). */
export const FILL = { color: [0.55, 0.58, 0.85], level: 0.23 };
/** Karanlık bölge sınırındaki geçişin uzunluğu (piksel). */
const DARK_FADE = 80;

export const LAMP = { color: [1.0, 0.7, 0.38], radius: 150, intensity: 1.0, falloff: 1.05 };
export const TORCH = { color: [1.0, 0.56, 0.26], radius: 125, intensity: 1.1, falloff: 1.15 };
/** Elde taşınan meşale. */
export const HAND_TORCH = { color: [1.0, 0.62, 0.3], radius: 118, intensity: 1.1, falloff: 1.1 };
/** Madencinin etrafındaki çok küçük hale (meşalesizken karanlıkta tek görünen). */
export const SELF_GLOW = { color: [0.8, 0.78, 0.8], radius: 24, intensity: 0.22 };

export class Lighting {
  constructor(map) {
    this.map = map;
    this.gw = Math.ceil(map.pw / CELL);
    this.gh = Math.ceil(map.ph / CELL);
    this.statics = [];
    this.buildProbes();
    this.buildDarkMask();
    this.buildBase();

    this.vw = 0;
    this.vh = 0;
    this.R = this.G = this.B = null;
    this.vig = null;
  }

  /**
   * Her ışık hücresi için ışığın test edileceği nokta. Duvar hücrelerinde
   * ışık, duvarın zemine bakan tarafından gelir (yoksa duvarın arkasındaki
   * ışık ön yüzü aydınlatırdı). Kayanın içi her zaman karanlıktır.
   */
  buildProbes() {
    const { map, gw, gh } = this;
    this.px = new Int16Array(gw * gh);
    this.py = new Int16Array(gw * gh);
    for (let j = 0; j < gh; j++) {
      for (let i = 0; i < gw; i++) {
        const cx = i * CELL + CELL / 2, cy = j * CELL + CELL / 2;
        const tx = Math.floor(cx / TILE), ty = Math.floor(cy / TILE);
        const lx = cx - tx * TILE, ly = cy - ty * TILE;
        let px = cx, py = cy;
        if (map.isOpaque(tx, ty)) {
          if (!map.isOpaque(tx, ty + 1)) py = (ty + 1) * TILE + 1; // duvar yüzü
          else if (!map.isOpaque(tx, ty - 1) && ly < 11) py = ty * TILE - 1;
          else if (!map.isOpaque(tx - 1, ty) && lx < 11) px = tx * TILE - 1;
          else if (!map.isOpaque(tx + 1, ty) && lx > 21) px = (tx + 1) * TILE;
          else px = py = -1;
        }
        this.px[j * gw + i] = px;
        this.py[j * gw + i] = py;
      }
    }
  }

  /** Karanlık bölge maskesi: 0 = normal, 1 = zifiri karanlık. */
  buildDarkMask() {
    const { gw, gh } = this;
    this.dark = new Float32Array(gw * gh);
    for (const z of this.map.darkZones) {
      const x0 = z.x * TILE, y0 = z.y * TILE, x1 = (z.x + z.w) * TILE, y1 = (z.y + z.h) * TILE;
      for (let j = Math.floor(y0 / CELL); j < Math.ceil(y1 / CELL); j++) {
        for (let i = Math.floor(x0 / CELL); i < Math.ceil(x1 / CELL); i++) {
          if (i < 0 || j < 0 || i >= gw || j >= gh) continue;
          const k = j * gw + i;
          const px = this.px[k] >= 0 ? this.px[k] : i * CELL + 2;
          const py = this.py[k] >= 0 ? this.py[k] : j * CELL + 2;
          // bölge kenarına içeriden uzaklık
          const d = Math.min(px - x0, x1 - px, py - y0, y1 - py);
          const t = Math.max(0, Math.min(1, d / DARK_FADE));
          this.dark[k] = Math.max(this.dark[k], t * t * (3 - 2 * t));
        }
      }
    }
  }

  /** Ortam ışığı: açık alanlarda daha çok, köşelerde ve dar yerlerde daha az. */
  buildBase() {
    const { map, gw, gh } = this;
    const n = gw * gh;
    this.baseR = new Float32Array(n);
    this.baseG = new Float32Array(n);
    this.baseB = new Float32Array(n);
    // Her tile için açıklık: 5x5 komşulukta zemin oranı
    const open = new Float32Array(map.w * map.h);
    for (let ty = 0; ty < map.h; ty++) {
      for (let tx = 0; tx < map.w; tx++) {
        let c = 0;
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (!map.isOpaque(tx + dx, ty + dy)) c++;
        open[ty * map.w + tx] = c / 25;
      }
    }
    const openAt = (x, y) => {
      // tile merkezleri arasında yumuşak geçiş
      const u = x / TILE - 0.5, v = y / TILE - 0.5;
      const x0 = Math.max(0, Math.min(map.w - 2, Math.floor(u))), y0 = Math.max(0, Math.min(map.h - 2, Math.floor(v)));
      const fx = Math.max(0, Math.min(1, u - x0)), fy = Math.max(0, Math.min(1, v - y0));
      const a = open[y0 * map.w + x0], b = open[y0 * map.w + x0 + 1];
      const c = open[(y0 + 1) * map.w + x0], d = open[(y0 + 1) * map.w + x0 + 1];
      return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
    };
    const [cr, cg, cb] = FILL.color;
    const wd = this.wallDistanceField();
    for (let j = 0; j < gh; j++) {
      for (let i = 0; i < gw; i++) {
        const k = j * gw + i;
        const px = this.px[k], py = this.py[k];
        if (px < 0) continue;
        const o = openAt(px, py);
        // büyük ölçekli gölgeli/aydınlık lekeler
        const nz = smoothNoise(px / 150, py / 150);
        let v = FILL.level * (0.2 + 0.8 * Math.pow(o, 1.8)) * (0.65 + 0.5 * nz);
        // duvar dipleri iyice kararır
        const pi = Math.min(gw - 1, Math.max(0, Math.floor(px / CELL))), pj = Math.min(gh - 1, Math.max(0, Math.floor(py / CELL)));
        v *= 0.45 + 0.55 * Math.min(1, wd[pj * gw + pi] / 14);
        v *= 1 - this.dark[k];
        this.baseR[k] = v * cr;
        this.baseG[k] = v * cg;
        this.baseB[k] = v * cb;
      }
    }
  }

  /**
   * Her hücrenin en yakın duvara uzaklığı (piksel, yaklaşık). İki geçişli
   * "chamfer" uzaklık dönüşümü: hücre sayısıyla doğrusal, hızlı.
   */
  wallDistanceField() {
    const { map, gw, gh } = this;
    const INF = 1e6;
    const d = new Float32Array(gw * gh);
    for (let j = 0; j < gh; j++) {
      const ty = Math.floor((j * CELL) / TILE);
      for (let i = 0; i < gw; i++) d[j * gw + i] = map.isOpaque(Math.floor((i * CELL) / TILE), ty) ? 0 : INF;
    }
    const a = CELL, b = CELL * 1.414;
    for (let j = 0; j < gh; j++) {
      for (let i = 0; i < gw; i++) {
        const k = j * gw + i;
        let v = d[k];
        if (v === 0) continue;
        if (i > 0) v = Math.min(v, d[k - 1] + a);
        if (j > 0) {
          v = Math.min(v, d[k - gw] + a);
          if (i > 0) v = Math.min(v, d[k - gw - 1] + b);
          if (i < gw - 1) v = Math.min(v, d[k - gw + 1] + b);
        }
        d[k] = v;
      }
    }
    for (let j = gh - 1; j >= 0; j--) {
      for (let i = gw - 1; i >= 0; i--) {
        const k = j * gw + i;
        let v = d[k];
        if (v === 0) continue;
        if (i < gw - 1) v = Math.min(v, d[k + 1] + a);
        if (j < gh - 1) {
          v = Math.min(v, d[k + gw] + a);
          if (i < gw - 1) v = Math.min(v, d[k + gw + 1] + b);
          if (i > 0) v = Math.min(v, d[k + gw - 1] + b);
        }
        d[k] = v;
      }
    }
    return d;
  }

  /** Bir ışığın hücre hücre katkısını hesaplar (gölgelerle birlikte). */
  traceLight(x, y, ox, oy, radius, falloff, applyDark) {
    const { map, gw, gh } = this;
    const i0 = Math.max(0, Math.floor((x - radius) / CELL));
    const j0 = Math.max(0, Math.floor((y - radius) / CELL));
    const i1 = Math.min(gw - 1, Math.ceil((x + radius) / CELL));
    const j1 = Math.min(gh - 1, Math.ceil((y + radius) / CELL));
    const w = i1 - i0 + 1, h = j1 - j0 + 1;
    const vals = new Float32Array(w * h);
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const k = j * gw + i;
        const px = this.px[k], py = this.py[k];
        if (px < 0) continue;
        const cx = i * CELL + CELL / 2, cy = j * CELL + CELL / 2;
        const d = Math.hypot(cx - x, cy - y);
        if (d >= radius) continue;
        if (map.rayBlocked(ox, oy, px, py)) continue;
        let v = Math.pow(1 - d / radius, falloff);
        if (applyDark) v *= 1 - this.dark[k];
        vals[(j - j0) * w + (i - i0)] = v;
      }
    }
    return { i0, j0, w, h, vals };
  }

  /**
   * Sabit ve titremeyen bir ışığı ortam ışığına kalıcı olarak ekler
   * (duvar lambaları).
   */
  addBaked({ x, y, ox = x, oy = y, radius, color, intensity, falloff = 1.5 }) {
    const t = this.traceLight(x, y, ox, oy, radius, falloff, true);
    const [cr, cg, cb] = color;
    for (let j = 0; j < t.h; j++) {
      for (let i = 0; i < t.w; i++) {
        const v = t.vals[j * t.w + i] * intensity;
        if (!v) continue;
        const k = (t.j0 + j) * this.gw + t.i0 + i;
        this.baseR[k] += v * cr;
        this.baseG[k] += v * cg;
        this.baseB[k] += v * cb;
      }
    }
  }

  /**
   * Titreyebilen sabit bir ışık ekler. (x, y) ışığın merkezi, (ox, oy) gölge
   * hesabının başladığı nokta (duvardaki ışıklarda duvarın önündeki zemin).
   * Dönen nesnenin `flicker` değeri her karede değiştirilebilir (0 = sönük).
   */
  addStatic({ x, y, ox = x, oy = y, radius, color, intensity, falloff = 1.6, applyDark = true }) {
    const t = this.traceLight(x, y, ox, oy, radius, falloff, applyDark);
    const light = { x, y, radius, color, intensity, ...t, flicker: 1 };
    this.statics.push(light);
    return light;
  }

  resize(w, h) {
    if (w === this.vw && h === this.vh) return;
    this.vw = w;
    this.vh = h;
    this.cw = Math.ceil(w / CELL) + 3;
    this.ch = Math.ceil(h / CELL) + 3;
    const n = this.cw * this.ch;
    this.R = new Float32Array(n);
    this.G = new Float32Array(n);
    this.B = new Float32Array(n);
    // Vinyet: kenarlara doğru hafifçe karanlaşır.
    this.vig = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const nx = (x - w / 2) / (w / 2), ny = (y - h / 2) / (h / 2);
        const r = Math.sqrt((nx * nx + ny * ny) / 2);
        const t = Math.min(1, Math.max(0, (r - 0.45) / 0.55));
        this.vig[y * w + x] = 1 - 0.5 * t * t * (3 - 2 * t);
      }
    }
    this.colI = new Int32Array(w);
    this.colF = new Float32Array(w);
  }

  /** Karanlık bölge katsayısı (0..1) bir dünya noktasında. */
  darkAt(wx, wy) {
    const i = Math.floor(wx / CELL), j = Math.floor(wy / CELL);
    if (i < 0 || j < 0 || i >= this.gw || j >= this.gh) return 0;
    return this.dark[j * this.gw + i];
  }

  /**
   * Bu karenin ışık tamponunu hesaplar.
   * dynamic: [{ x, y, radius, intensity, color, falloff }] her karede gölgesiyle
   * hesaplanan ışıklar (elde taşınan meşale, madencinin halesi).
   */
  compute(camX, camY, dynamic) {
    const { cw, ch, R, G, B, gw, gh, map } = this;
    const c0x = Math.floor(camX / CELL) - 1;
    const c0y = Math.floor(camY / CELL) - 1;
    this.c0x = c0x;
    this.c0y = c0y;

    // Ortam ışığı + lambalar
    for (let j = 0; j < ch; j++) {
      const wj = c0y + j;
      let dst = j * cw;
      if (wj < 0 || wj >= gh) {
        R.fill(0, dst, dst + cw);
        G.fill(0, dst, dst + cw);
        B.fill(0, dst, dst + cw);
        continue;
      }
      for (let i = 0; i < cw; i++, dst++) {
        const wi = c0x + i;
        if (wi < 0 || wi >= gw) {
          R[dst] = G[dst] = B[dst] = 0;
          continue;
        }
        const k = wj * gw + wi;
        R[dst] = this.baseR[k];
        G[dst] = this.baseG[k];
        B[dst] = this.baseB[k];
      }
    }

    // Titreyen sabit ışıklar
    for (const L of this.statics) {
      const f = L.intensity * L.flicker;
      if (f <= 0) continue;
      const a0 = Math.max(L.i0, c0x), a1 = Math.min(L.i0 + L.w - 1, c0x + cw - 1);
      const b0 = Math.max(L.j0, c0y), b1 = Math.min(L.j0 + L.h - 1, c0y + ch - 1);
      if (a0 > a1 || b0 > b1) continue;
      const [cr, cg, cb] = L.color;
      for (let j = b0; j <= b1; j++) {
        let src = (j - L.j0) * L.w + (a0 - L.i0);
        let dst = (j - c0y) * cw + (a0 - c0x);
        for (let i = a0; i <= a1; i++, src++, dst++) {
          const v = L.vals[src] * f;
          if (v === 0) continue;
          R[dst] += v * cr;
          G[dst] += v * cg;
          B[dst] += v * cb;
        }
      }
    }

    // Hareketli ışıklar (gölgeli)
    for (const D of dynamic) {
      if (!D || D.intensity <= 0) continue;
      const ox = D.x, oy = D.y, rad = D.radius, fall = D.falloff || 1.4;
      const a0 = Math.max(c0x, Math.floor((ox - rad) / CELL), 0);
      const a1 = Math.min(c0x + cw - 1, Math.ceil((ox + rad) / CELL), gw - 1);
      const b0 = Math.max(c0y, Math.floor((oy - rad) / CELL), 0);
      const b1 = Math.min(c0y + ch - 1, Math.ceil((oy + rad) / CELL), gh - 1);
      const [cr, cg, cb] = D.color;
      for (let j = b0; j <= b1; j++) {
        const dy = j * CELL + CELL / 2 - oy;
        for (let i = a0; i <= a1; i++) {
          const dx = i * CELL + CELL / 2 - ox;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d >= rad) continue;
          const k = j * gw + i;
          const px = this.px[k];
          if (px < 0) continue;
          if (d > 6 && map.rayBlocked(ox, oy, px, this.py[k])) continue;
          const v = Math.pow(1 - d / rad, fall) * D.intensity;
          const dst = (j - c0y) * cw + (i - c0x);
          R[dst] += v * cr;
          G[dst] += v * cg;
          B[dst] += v * cb;
        }
      }
    }
  }

  /** Dünya noktasındaki ışık parlaklığı (0..~1.5). compute()'tan sonra çağrılmalı. */
  sample(wx, wy) {
    if (!this.R || this.c0x === undefined) return 0; // henüz hiç hesaplanmadı
    const i = Math.floor(wx / CELL) - this.c0x;
    const j = Math.floor(wy / CELL) - this.c0y;
    if (i < 0 || j < 0 || i >= this.cw || j >= this.ch) return 0;
    const k = j * this.cw + i;
    return Math.max(this.R[k], this.G[k], this.B[k]);
  }

  /**
   * Sahne piksellerine ışığı uygular.
   * Hız için: sadece parlaklık (en güçlü kanal) piksel piksel enterpole
   * edilir; rengin tonu en yakın hücreden alınır (ton yavaş değişir).
   */
  apply(imageData, camX, camY) {
    const { cw, ch, R, G, B, vig } = this;
    const w = imageData.width, h = imageData.height;
    const d = imageData.data;
    const { colI, colF } = this;
    const n = cw * ch;
    if (!this.M || this.M.length !== n) {
      this.M = new Float32Array(n);
      this.CR = new Float32Array(n);
      this.CG = new Float32Array(n);
      this.CB = new Float32Array(n);
      this.rowM = new Float32Array(cw);
    }
    const { M, CR, CG, CB, rowM } = this;
    for (let k = 0; k < n; k++) {
      const r = R[k], g = G[k], b = B[k];
      let m = r > g ? r : g;
      if (b > m) m = b;
      M[k] = m;
      if (m > 0.0001) {
        CR[k] = r / m;
        CG[k] = g / m;
        CB[k] = b / m;
      } else CR[k] = CG[k] = CB[k] = 0;
    }
    for (let x = 0; x < w; x++) {
      const u = (camX + x - CELL / 2) / CELL - this.c0x;
      const i = Math.floor(u);
      colI[x] = i;
      colF[x] = u - i;
    }
    const L = LEVELS;
    const ar = AMB[0], ag = AMB[1], ab = AMB[2];
    const dr = DARK[0], dg = DARK[1], db = DARK[2];
    // Pikseller 32 bit okunup yazılır (Uint8ClampedArray'e kanal kanal
    // yazmaktan çok daha hızlı). Bayt sırası: A B G R (little-endian).
    const u32 = new Uint32Array(d.buffer, d.byteOffset, w * h);
    let p = 0;
    for (let y = 0; y < h; y++) {
      const v = (camY + y - CELL / 2) / CELL - this.c0y;
      const j = Math.floor(v);
      const fy = v - j;
      const r0 = j * cw, r1 = r0 + cw;
      for (let i = 0; i < cw - 1; i++) rowM[i] = M[r0 + i] + (M[r1 + i] - M[r0 + i]) * fy;
      const near = fy < 0.5 ? r0 : r1;
      const by = ((camY + y) & 3) << 2;
      for (let x = 0; x < w; x++, p++) {
        const i = colI[x];
        const a = rowM[i];
        const m = a + (rowM[i + 1] - a) * colF[x];
        const vv = vig[p];
        const q = ((m * vv * L + BAYER[by | ((camX + x) & 3)]) | 0) / L;
        const px = u32[p];
        const sr = px & 255, sg = (px >>> 8) & 255, sb = (px >>> 16) & 255;
        let or, og, ob;
        if (q === 0) {
          or = sr * ar * vv + dr * vv;
          og = sg * ag * vv + dg * vv;
          ob = sb * ab * vv + db * vv;
        } else {
          const c = near + (colF[x] < 0.5 ? i : i + 1);
          const dk = q < 1 ? (1 - q) * vv : 0;
          or = sr * (ar * vv + q * CR[c]) + dr * dk;
          og = sg * (ag * vv + q * CG[c]) + dg * dk;
          ob = sb * (ab * vv + q * CB[c]) + db * dk;
          if (or > 255) or = 255;
          if (og > 255) og = 255;
          if (ob > 255) ob = 255;
        }
        u32[p] = 0xff000000 | ((ob | 0) << 16) | ((og | 0) << 8) | (or | 0);
      }
    }
  }
}

function smoothNoise(x, y) {
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const fx = x - x0, fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = hash2(x0, y0, 91), b = hash2(x0 + 1, y0, 91);
  const c = hash2(x0, y0 + 1, 91), e = hash2(x0 + 1, y0 + 1, 91);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + e) * sx * sy;
}
