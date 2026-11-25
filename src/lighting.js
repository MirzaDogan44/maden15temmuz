// Işık ve karanlık.
//
// Dünya 4x4 piksellik "ışık hücrelerine" bölünür. Her karede görünen
// hücreler için ışık miktarı (r, g, b) hesaplanır:
//   - Meşaleler ve kristaller sabit olduğu için ışık haritaları açılışta bir
//     kere hesaplanır, her karede sadece titreme katsayısıyla eklenir.
//   - Madencinin feneri her karede hesaplanır: bakış yönünde bir koni ve
//     etrafında küçük bir hale.
// Duvarlar ışığı keser: her hücreden ışık kaynağına kare kare bir ışın
// yürütülür, arada duvar varsa hücre karanlık kalır.
//
// Sonra ekrandaki her piksel bu ışıkla çarpılır. Işık seviyeleri birkaç
// basamağa yuvarlanır ve basamaklar arası geçişte 4x4 Bayer deseniyle
// "dithering" yapılır (yumuşak gradyan yerine piksel desenli geçiş).

import { TILE } from './config.js';

const CELL = 4;
const LEVELS = 6;
const BAYER = new Float32Array([0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16));

// Karanlığın rengi: soğuk, koyu mavi-mor.
const AMB = [0.042, 0.038, 0.088];
const DARK = [5, 3, 13];

export const LANTERN = {
  color: [1.0, 0.84, 0.58],
  range: 178,
  halfAngle: 0.5,
  soft: 0.28,
  intensity: 1.2,
  glowRadius: 46,
  glowIntensity: 0.7,
};

export const TORCH = {
  color: [1.0, 0.56, 0.26],
  radius: 118,
  intensity: 1.05,
};

export class Lighting {
  constructor(map) {
    this.map = map;
    this.gw = Math.ceil(map.pw / CELL);
    this.gh = Math.ceil(map.ph / CELL);
    this.statics = [];
    this.buildProbes();

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

  /**
   * Sabit bir ışık ekler. (x, y) ışığın merkezi, (ox, oy) gölge hesabının
   * başladığı nokta (meşalede duvarın hemen önündeki zemin).
   */
  addStatic({ x, y, ox = x, oy = y, radius, color, intensity, falloff = 1.6 }) {
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
        vals[(j - j0) * w + (i - i0)] = Math.pow(1 - d / radius, falloff);
      }
    }
    const light = { x, y, radius, color, intensity, i0, j0, w, h, vals, flicker: 1 };
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
    // Vinyet: kenarlara doğru karanlaşır.
    this.vig = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const nx = (x - w / 2) / (w / 2), ny = (y - h / 2) / (h / 2);
        const r = Math.sqrt((nx * nx + ny * ny) / 2);
        const t = Math.min(1, Math.max(0, (r - 0.42) / 0.55));
        this.vig[y * w + x] = 1 - 0.7 * t * t * (3 - 2 * t);
      }
    }
    this.colI = new Int32Array(w);
    this.colF = new Float32Array(w);
  }

  /** Bu karenin ışık tamponunu hesaplar. */
  compute(camX, camY, lantern) {
    const { cw, ch, R, G, B, gw, gh, map } = this;
    R.fill(0);
    G.fill(0);
    B.fill(0);
    const c0x = Math.floor(camX / CELL) - 1;
    const c0y = Math.floor(camY / CELL) - 1;
    this.c0x = c0x;
    this.c0y = c0y;

    // Sabit ışıklar
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

    // Fener
    if (lantern) {
      const P = LANTERN;
      const ox = lantern.x, oy = lantern.y;
      const range = P.range * lantern.power;
      const reach = Math.max(range, P.glowRadius);
      const a0 = Math.max(c0x, Math.floor((ox - reach) / CELL), 0);
      const a1 = Math.min(c0x + cw - 1, Math.ceil((ox + reach) / CELL), gw - 1);
      const b0 = Math.max(c0y, Math.floor((oy - reach) / CELL), 0);
      const b1 = Math.min(c0y + ch - 1, Math.ceil((oy + reach) / CELL), gh - 1);
      const ca = Math.cos(lantern.angle), sa = Math.sin(lantern.angle);
      const cosEdge = Math.cos(P.halfAngle + P.soft);
      const [cr, cg, cb] = P.color;
      for (let j = b0; j <= b1; j++) {
        const cy = j * CELL + CELL / 2;
        const dy = cy - oy;
        for (let i = a0; i <= a1; i++) {
          const cx = i * CELL + CELL / 2;
          const dx = cx - ox;
          const d = Math.sqrt(dx * dx + dy * dy);
          let v = 0;
          if (d < P.glowRadius) v = Math.pow(1 - d / P.glowRadius, 1.4) * P.glowIntensity;
          if (d < range && d > 0.001) {
            const cosA = (dx * ca + dy * sa) / d;
            if (cosA > cosEdge) {
              const ang = Math.acos(Math.min(1, cosA));
              const aw = ang < P.halfAngle ? 1 : 1 - (ang - P.halfAngle) / P.soft;
              const cone = aw * Math.pow(1 - d / range, 1.05) * P.intensity;
              v = v + cone * (1 - v * 0.5);
            }
          }
          if (v < 0.02) continue;
          const k = j * gw + i;
          const px = this.px[k];
          if (px < 0) continue;
          if (d > 5 && map.rayBlocked(ox, oy, px, this.py[k])) continue;
          v *= lantern.flicker;
          const dst = (j - c0y) * cw + (i - c0x);
          R[dst] += v * cr;
          G[dst] += v * cg;
          B[dst] += v * cb;
        }
      }
    }
  }

  /** Dünya noktasındaki ışık parlaklığı (0..~1.5). Hesaplamadan sonra çağrılmalı. */
  sample(wx, wy) {
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
    // Hücre başına parlaklık ve normalize renk tonu
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
        const o = p << 2;
        let q = ((m * vv * L + BAYER[by | ((camX + x) & 3)]) | 0) / L;
        if (q === 0) {
          // Tam karanlık: sadece ortam ışığı ve soğuk renk
          d[o] = d[o] * ar * vv + dr * vv;
          d[o + 1] = d[o + 1] * ag * vv + dg * vv;
          d[o + 2] = d[o + 2] * ab * vv + db * vv;
          continue;
        }
        const c = near + (colF[x] < 0.5 ? i : i + 1);
        const kr = ar * vv + q * CR[c], kg = ag * vv + q * CG[c], kb = ab * vv + q * CB[c];
        const dk = q < 1 ? (1 - q) * vv : 0;
        d[o] = d[o] * kr + dr * dk;
        d[o + 1] = d[o + 1] * kg + dg * dk;
        d[o + 2] = d[o + 2] * kb + db * dk;
      }
    }
  }
}
