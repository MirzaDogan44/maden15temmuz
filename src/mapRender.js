// Haritayı açılışta bir kere büyük bir canvas'a çizer ("bake").
// Her karede sadece kameranın gördüğü parça kopyalanır, bu yüzden burada
// piksel piksel pahalı işler (gölge, köşe yuvarlama, taşlar) yapılabilir.
//
// İki katman üretilir:
//   ground: zemin, duvarlar ve yerdeki her şey (madencinin altında kalır)
//   over:   tavan kirişleri ve asansör kafesinin ön tarafı (madencinin üstünde)
//
// Doku dosyaları değiştirilmez; gölgeler ve süsler onların üstüne çizilir.

import { TILE } from './config.js';
import { images, TERRAIN, DECOR } from './assets.js';
import { makeRng, hash2 } from './rng.js';

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const bayer = (x, y) => BAYER[((y & 3) << 2) | (x & 3)];

// Renkler
const STONE = { outline: [20, 16, 18], dark: [52, 46, 44], mid: [82, 75, 70], light: [112, 103, 94], hi: [142, 132, 120] };
const PEBBLE = { outline: [28, 20, 16], dark: [66, 48, 38], mid: [96, 72, 56], light: [124, 96, 74], hi: [150, 120, 92] };
const ORE_ROCK = { outline: [16, 14, 16], dark: [44, 40, 42], mid: [66, 61, 62], light: [92, 86, 84], hi: [118, 110, 104] };
const WOOD = { outline: '#1a0f08', dark: '#3b2414', mid: '#5c3a20', light: '#7a5230', hi: '#94683e', grain: '#2e1b0e' };
const METAL = { outline: '#0e1013', dark: '#262a30', mid: '#3d434b', light: '#5f6772', hi: '#8f98a3' };
const ORE_COLORS = {
  gold: ['#8a5a14', '#d6a13a', '#ffe08a'],
  crystal: ['#1b5a7a', '#4fc3e8', '#d4f6ff'],
  ruby: ['#6e1222', '#d8324a', '#ff9aa8'],
};

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** Bir görselin piksellerini okumak için. */
function pixelsOf(img, sx, sy, w, h) {
  const c = makeCanvas(w, h);
  const x = c.getContext('2d');
  x.drawImage(img, sx, sy, w, h, 0, 0, w, h);
  return x.getImageData(0, 0, w, h).data;
}

/** Yumuşak değer gürültüsü (0..1). */
function vnoise(x, y, seed) {
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const fx = x - x0, fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = hash2(x0, y0, seed), b = hash2(x0 + 1, y0, seed);
  const c = hash2(x0, y0 + 1, seed), d = hash2(x0 + 1, y0 + 1, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

/**
 * Piksel sanatı tarzında yuvarlak bir taş. Işık sol üstten gelir.
 * Taş yığınları için önce hepsi toplanıp y'ye göre sıralanarak çizilir.
 */
function drawStone(ctx, cx, cy, w, h, pal, rng) {
  const rx = w / 2, ry = h / 2;
  const x0 = Math.round(cx - rx), y0 = Math.round(cy - ry);
  const inside = (x, y) => {
    const dx = (x + 0.5 - w / 2) / rx;
    const dy = (y + 0.5 - h / 2) / ry;
    return dx * dx + dy * dy <= 1.0;
  };
  const tilt = rng.range(-0.25, 0.25);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!inside(x, y)) continue;
      const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
      let c;
      if (edge) c = pal.outline;
      else {
        const nx = (x + 0.5 - w / 2) / rx, ny = (y + 0.5 - h / 2) / ry;
        const l = -nx * 0.55 - ny * 0.85 + tilt * nx + (rng() - 0.5) * 0.25;
        c = l > 0.62 ? pal.hi : l > 0.12 ? pal.light : l > -0.45 ? pal.mid : pal.dark;
      }
      ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
      ctx.fillRect(x0 + x, y0 + y, 1, 1);
    }
  }
}

/** Tahta kalası. vertical: lif yönü dikey mi. */
function drawWood(ctx, x, y, w, h, vertical, rng) {
  ctx.fillStyle = WOOD.outline;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = WOOD.mid;
  ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
  ctx.fillStyle = WOOD.light;
  if (vertical) ctx.fillRect(x + 1, y + 1, 1, h - 2);
  else ctx.fillRect(x + 1, y + 1, w - 2, 1);
  ctx.fillStyle = WOOD.dark;
  if (vertical) ctx.fillRect(x + w - 2, y + 1, 1, h - 2);
  else ctx.fillRect(x + 1, y + h - 2, w - 2, 1);
  // lifler
  ctx.fillStyle = WOOD.grain;
  const n = Math.floor((w * h) / 14);
  for (let i = 0; i < n; i++) {
    if (vertical) ctx.fillRect(x + rng.int(2, w - 3), y + rng.int(1, h - 4), 1, rng.int(2, 3));
    else ctx.fillRect(x + rng.int(1, w - 4), y + rng.int(2, h - 3), rng.int(2, 3), 1);
  }
  // çivi
  ctx.fillStyle = METAL.hi;
  if (vertical) ctx.fillRect(x + Math.floor(w / 2), y + 2, 1, 1);
  else {
    ctx.fillRect(x + 2, y + Math.floor(h / 2), 1, 1);
    ctx.fillRect(x + w - 3, y + Math.floor(h / 2), 1, 1);
  }
}

/** Bir sprite'ın en parlak birkaç pikselini bulur (parıltı noktaları). */
function brightPoints(img, count, rng) {
  const d = pixelsOf(img, 0, 0, img.width, img.height);
  const pts = [];
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const i = (y * img.width + x) * 4;
      if (d[i + 3] < 200) continue;
      const l = d[i] + d[i + 1] + d[i + 2];
      if (l > 420) pts.push({ x, y, l });
    }
  }
  pts.sort((a, b) => b.l - a.l);
  const top = pts.slice(0, Math.max(count * 4, 8));
  const out = [];
  for (let i = 0; i < count && top.length; i++) out.push(top.splice(rng.int(0, top.length - 1), 1)[0]);
  return out;
}

export function bakeMap(map) {
  const W = map.pw, H = map.ph;
  const ground = makeCanvas(W, H);
  const g = ground.getContext('2d');
  const over = makeCanvas(W, H);
  const o = over.getContext('2d');
  const rng = makeRng(map.level.seed);
  const seed = map.level.seed;

  /** Işık yayan noktalar (kristaller, asansör lambası). */
  const glows = [];
  /** Karanlıkta yanıp sönen parıltı pikselleri. */
  const sparkles = [];

  const opaque = (tx, ty) => map.isOpaque(tx, ty);

  // ---------- 1) Zemin dokusu, her yere ----------
  const floorImg = images.get(TERRAIN.floor.src);
  for (let ty = 0; ty < map.h; ty++) {
    for (let tx = 0; tx < map.w; tx++) {
      if (floorImg) g.drawImage(floorImg, TERRAIN.floor.x, 0, TILE, TILE, tx * TILE, ty * TILE, TILE, TILE);
      else {
        g.fillStyle = '#4a3226';
        g.fillRect(tx * TILE, ty * TILE, TILE, TILE);
      }
    }
  }

  // ---------- 2) Piksel işlemleri: lekeler, duvar dibinde gölge, duvarlar ----------
  const img = g.getImageData(0, 0, W, H);
  const d = img.data;
  const mul = (i, f) => {
    d[i] *= f;
    d[i + 1] *= f;
    d[i + 2] *= f;
  };

  const faceImg = images.get(TERRAIN.wallFace.src);
  const facePx = faceImg ? pixelsOf(faceImg, TERRAIN.wallFace.x, 0, TILE, TILE) : null;

  for (let ty = 0; ty < map.h; ty++) {
    for (let tx = 0; tx < map.w; tx++) {
      const bx = tx * TILE, by = ty * TILE;
      if (!opaque(tx, ty)) {
        // Zemin: büyük ölçekli koyu lekeler (aynı dokunun tekrarını kırar)
        // ve duvar diplerinde ortam gölgesi.
        const wN = opaque(tx, ty - 1), wS = opaque(tx, ty + 1);
        const wW = opaque(tx - 1, ty), wE = opaque(tx + 1, ty);
        const wNW = opaque(tx - 1, ty - 1), wNE = opaque(tx + 1, ty - 1);
        const wSW = opaque(tx - 1, ty + 1), wSE = opaque(tx + 1, ty + 1);
        for (let ly = 0; ly < TILE; ly++) {
          for (let lx = 0; lx < TILE; lx++) {
            const px = bx + lx, py = by + ly;
            const i = (py * W + px) * 4;
            const n = vnoise(px / 52, py / 52, seed) * 0.7 + vnoise(px / 13, py / 13, seed + 7) * 0.3;
            if (n > 0.58 && (n - 0.58) * 3.2 > bayer(px, py)) mul(i, 0.78);
            else if (n < 0.3 && (0.3 - n) * 2.5 > bayer(px + 1, py + 2)) mul(i, 1.12);

            let s = 0;
            if (wN) s = Math.max(s, (1 - ly / 9) * 1.0);
            if (wW) s = Math.max(s, (1 - lx / 6) * 0.8);
            if (wE) s = Math.max(s, (1 - (31 - lx) / 6) * 0.8);
            if (wS) s = Math.max(s, (1 - (31 - ly) / 4) * 0.55);
            if (wNW && !wN && !wW) s = Math.max(s, (1 - Math.hypot(lx, ly) / 7) * 0.9);
            if (wNE && !wN && !wE) s = Math.max(s, (1 - Math.hypot(31 - lx, ly) / 7) * 0.9);
            if (wSW && !wS && !wW) s = Math.max(s, (1 - Math.hypot(lx, 31 - ly) / 5) * 0.6);
            if (wSE && !wS && !wE) s = Math.max(s, (1 - Math.hypot(31 - lx, 31 - ly) / 5) * 0.6);
            if (s > 0.85) mul(i, 0.42);
            else if (s > bayer(px, py)) mul(i, 0.6);
          }
        }
        continue;
      }

      // Duvar karesi
      const face = !opaque(tx, ty + 1);
      const fN = !opaque(tx, ty - 1), fW = !opaque(tx - 1, ty), fE = !opaque(tx + 1, ty);
      const R = 11;
      const rNW = fN && fW, rNE = fN && fE;
      const rSW = face && fW, rSE = face && fE;
      for (let ly = 0; ly < TILE; ly++) {
        for (let lx = 0; lx < TILE; lx++) {
          // Dışbükey köşeleri yuvarla: köşe dışında kalan pikseller zemin kalır.
          if (rNW && lx < R && ly < R && (R - lx) ** 2 + (R - ly) ** 2 > R * R) continue;
          if (rNE && lx > 31 - R && ly < R && (lx - (31 - R)) ** 2 + (R - ly) ** 2 > R * R) continue;
          if (rSW && lx < 6 && ly > 25 && (6 - lx) ** 2 + (ly - 25) ** 2 > 36) continue;
          if (rSE && lx > 25 && ly > 25 && (lx - 25) ** 2 + (ly - 25) ** 2 > 36) continue;

          const px = bx + lx, py = by + ly;
          const i = (py * W + px) * 4;
          if (face && facePx) {
            const j = (ly * TILE + lx) * 4;
            let f = 1;
            if (ly >= 29) f = 0.55; // zemine değdiği yer
            else if (ly < 9) f = 0.72; // üst kenarın gölgesi
            else if (ly < 12 && bayer(px, py) > 0.5) f = 0.82;
            if ((fW && lx < 2) || (fE && lx > 29)) f *= 0.8;
            d[i] = facePx[j] * f;
            d[i + 1] = facePx[j + 1] * f;
            d[i + 2] = facePx[j + 2] * f;
          } else {
            // Kayanın üstü: neredeyse siyah, seyrek benekli.
            const h = hash2(px, py, seed + 3);
            const v = h > 0.97 ? 30 : h > 0.9 ? 22 : 13;
            d[i] = v;
            d[i + 1] = v - 2;
            d[i + 2] = v + 5;
          }
        }
      }
    }
  }
  g.putImageData(img, 0, 0);

  // ---------- 3) Zemin süsleri: çakıl, çatlak ----------
  for (let ty = 0; ty < map.h; ty++) {
    for (let tx = 0; tx < map.w; tx++) {
      if (opaque(tx, ty)) continue;
      const c = map.char(tx, ty);
      if ('rkE'.includes(c)) continue;
      const bx = tx * TILE, by = ty * TILE;
      const pebbles = rng.int(0, 3);
      for (let k = 0; k < pebbles; k++) {
        drawStone(g, bx + rng.int(4, 28), by + rng.int(6, 28), rng.int(2, 4), rng.int(2, 3), PEBBLE, rng);
      }
      if (rng.chance(0.16)) {
        // çatlak
        g.fillStyle = 'rgba(14,9,8,0.7)';
        let x = bx + rng.int(6, 26), y = by + rng.int(8, 26);
        const steps = rng.int(5, 11);
        for (let k = 0; k < steps; k++) {
          g.fillRect(x, y, 1, 1);
          x += rng.int(-1, 1);
          y += rng.pick([-1, 1, 0]);
        }
      }
    }
  }

  // ---------- 4) Raylar ----------
  const isRail = (tx, ty) => 'rk'.includes(map.char(tx, ty));
  for (const r of [...map.rails, ...map.decor.filter((q) => q.type === 'k')]) {
    const bx = r.tx * TILE, by = r.ty * TILE;
    const horiz = isRail(r.tx - 1, r.ty) || isRail(r.tx + 1, r.ty) || !(isRail(r.tx, r.ty - 1) || isRail(r.tx, r.ty + 1));
    for (let k = 0; k < 4; k++) {
      if (rng.chance(0.08)) continue; // kayıp travers
      const off = 2 + k * 8 + rng.int(0, 1);
      if (horiz) {
        g.fillStyle = WOOD.dark;
        g.fillRect(bx + off, by + 9, 4, 17);
        g.fillStyle = WOOD.mid;
        g.fillRect(bx + off, by + 9, 3, 16);
      } else {
        g.fillStyle = WOOD.dark;
        g.fillRect(bx + 7, by + off, 17, 4);
        g.fillStyle = WOOD.mid;
        g.fillRect(bx + 7, by + off, 16, 3);
      }
    }
    for (const off of [11, 22]) {
      if (horiz) {
        g.fillStyle = METAL.hi;
        g.fillRect(bx, by + off, TILE, 1);
        g.fillStyle = METAL.dark;
        g.fillRect(bx, by + off + 1, TILE, 1);
      } else {
        g.fillStyle = METAL.hi;
        g.fillRect(bx + off - 2, by, 1, TILE);
        g.fillStyle = METAL.dark;
        g.fillRect(bx + off - 1, by, 1, TILE);
      }
    }
  }

  // ---------- 5) Duvar kenarı taşları ----------
  const stones = [];
  const addRow = (x0, x1, y, small) => {
    for (let x = x0 + rng.int(0, 2); x < x1; x += rng.int(5, 8)) {
      const big = !small && rng.chance(0.1);
      stones.push({ x, y: y + rng.range(-0.6, 0.8) + (big ? 1.5 : 0), w: big ? rng.int(10, 12) : rng.int(6, 9), h: big ? rng.int(8, 9) : rng.int(5, 7) });
    }
  };
  const addCol = (x, y0, y1, small) => {
    for (let y = y0 + rng.int(0, 2); y < y1; y += rng.int(5, 7)) {
      const big = !small && rng.chance(0.1);
      stones.push({ x: x + rng.range(-0.8, 0.8), y, w: big ? rng.int(9, 11) : rng.int(5, small ? 7 : 8), h: big ? rng.int(9, 11) : rng.int(5, 8) });
    }
  };
  const addArc = (cx, cy, r, a0, a1) => {
    for (let k = 0; k < 3; k++) {
      const a = a0 + ((a1 - a0) * (k + 0.5)) / 3;
      stones.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, w: rng.int(6, 8), h: rng.int(5, 7) });
    }
  };
  for (let ty = 0; ty < map.h; ty++) {
    for (let tx = 0; tx < map.w; tx++) {
      if (!opaque(tx, ty)) continue;
      const bx = tx * TILE, by = ty * TILE;
      const face = !opaque(tx, ty + 1);
      const fN = !opaque(tx, ty - 1), fW = !opaque(tx - 1, ty), fE = !opaque(tx + 1, ty);
      const rNW = fN && fW, rNE = fN && fE;
      if (face) {
        // Duvar yüzünün üst kenarı (kayanın dudağı)
        addRow(bx + (rNW ? 7 : -1), bx + (rNE ? 26 : 32), by + 3, false);
        if (rNW) addArc(bx + 11, by + 11, 8, Math.PI * 1.05, Math.PI * 1.45);
        if (rNE) addArc(bx + 20, by + 11, 8, Math.PI * 1.55, Math.PI * 1.95);
        if (fW) addCol(bx + 2, by + (rNW ? 12 : 6), by + 27, true);
        if (fE) addCol(bx + 29, by + (rNE ? 12 : 6), by + 27, true);
      } else {
        if (fN) addRow(bx + (rNW ? 7 : -1), bx + (rNE ? 26 : 32), by + 3, false);
        if (rNW) addArc(bx + 11, by + 11, 8, Math.PI * 1.05, Math.PI * 1.45);
        if (rNE) addArc(bx + 20, by + 11, 8, Math.PI * 1.55, Math.PI * 1.95);
        if (fW) addCol(bx + 3, by + (rNW ? 12 : -1), by + 32, false);
        if (fE) addCol(bx + 28, by + (rNE ? 12 : -1), by + 32, false);
      }
    }
  }
  stones.sort((a, b) => a.y - b.y);
  for (const s of stones) drawStone(g, s.x, s.y, s.w, s.h, STONE, rng);

  // ---------- 6) Destek kirişleri ve meşale tutucuları (duvar yüzünde) ----------
  for (const s of map.supports) {
    const bx = s.tx * TILE, by = s.ty * TILE;
    drawWood(g, bx + 13, by + 7, 7, 26, true, rng);
    drawWood(g, bx - 3, by + 2, TILE + 6, 7, false, rng);
  }
  for (const t of map.torches) {
    const bx = t.tx * TILE + 16, by = t.ty * TILE;
    // duvardaki is lekesi
    g.fillStyle = 'rgba(0,0,0,0.35)';
    for (let k = 0; k < 14; k++) g.fillRect(bx + rng.int(-3, 3), by + rng.int(4, 12), 1, 1);
    // sap
    g.fillStyle = WOOD.outline;
    g.fillRect(bx - 2, by + 11, 4, 12);
    g.fillStyle = WOOD.light;
    g.fillRect(bx - 1, by + 11, 2, 11);
    g.fillStyle = WOOD.dark;
    g.fillRect(bx, by + 12, 1, 10);
    // demir kelepçe
    g.fillStyle = METAL.outline;
    g.fillRect(bx - 3, by + 16, 6, 4);
    g.fillStyle = METAL.light;
    g.fillRect(bx - 2, by + 17, 4, 1);
    g.fillStyle = METAL.dark;
    g.fillRect(bx - 2, by + 18, 4, 1);
    // yanmış uç
    g.fillStyle = '#2a1408';
    g.fillRect(bx - 2, by + 10, 4, 2);
  }

  // ---------- 7) Tavan kirişleri (madencinin üstünde kalır) ----------
  for (const b of map.beams) {
    const bx = b.tx * TILE, by = b.ty * TILE;
    const bw = (b.tx1 - b.tx + 1) * TILE;
    // zemine düşen gölge
    g.fillStyle = 'rgba(0,0,0,0.45)';
    for (let y = by + 15; y < by + 19; y++) {
      for (let x = bx; x < bx + bw; x++) if (bayer(x, y) < 0.5) g.fillRect(x, y, 1, 1);
    }
    drawWood(o, bx - 9, by + 5, bw + 18, 8, false, rng);
    drawWood(o, bx - 12, by + 2, 6, 13, true, rng);
    drawWood(o, bx + bw + 6, by + 2, 6, 13, true, rng);
    // ortada bir askı direği daha (geniş tünellerde)
    if (bw > 3 * TILE) drawWood(o, bx + Math.floor(bw / 2) - 3, by + 3, 6, 11, true, rng);
  }

  // ---------- 7b) Duvar lambaları ----------
  for (const L of map.lamps) {
    const cx = L.tx * TILE + 16, by = L.ty * TILE;
    if (!L.lit) {
      // is lekesi
      g.fillStyle = 'rgba(0,0,0,0.5)';
      for (let k = 0; k < 22; k++) g.fillRect(cx + rng.int(-4, 4), by + rng.int(2, 10), 1, 1);
    }
    // duvara tutturulmuş kol
    g.fillStyle = METAL.outline;
    g.fillRect(cx - 1, by + 7, 3, 3);
    g.fillRect(cx - 5, by + 9, 11, 2);
    g.fillStyle = METAL.light;
    g.fillRect(cx - 4, by + 9, 9, 1);
    // fener gövdesi
    g.fillStyle = METAL.outline;
    g.fillRect(cx - 4, by + 11, 9, 12);
    g.fillStyle = METAL.mid;
    g.fillRect(cx - 3, by + 11, 7, 2);
    g.fillRect(cx - 3, by + 20, 7, 2);
    if (L.lit) {
      g.fillStyle = '#e8b85a';
      g.fillRect(cx - 3, by + 13, 7, 7);
      g.fillStyle = '#fff0c0';
      g.fillRect(cx - 1, by + 15, 3, 3);
    } else {
      g.fillStyle = '#16181c';
      g.fillRect(cx - 3, by + 13, 7, 7);
      g.fillStyle = '#3a3f46';
      g.fillRect(cx - 2, by + 14, 1, 1);
      g.fillRect(cx + 1, by + 16, 2, 1);
      g.fillRect(cx, by + 17, 1, 2);
    }
    // kafes çubukları
    g.fillStyle = METAL.outline;
    g.fillRect(cx - 1, by + 13, 1, 7);
    g.fillRect(cx + 1, by + 13, 1, 7);
  }

  // ---------- 7c) Uyarı tabelaları ----------
  for (const sgn of map.signs) {
    const cx = sgn.tx * TILE + 16, by = sgn.ty * TILE;
    g.fillStyle = 'rgba(0,0,0,0.4)';
    g.fillRect(cx - 6, by + 28, 12, 3);
    drawWood(g, cx - 2, by + 12, 4, 18, true, rng);
    drawWood(g, cx - 12, by + 3, 24, 13, false, rng);
    // kırmızı üçgen ve ünlem
    g.fillStyle = '#7a1a14';
    for (let i = 0; i < 9; i++) g.fillRect(cx - Math.floor(i / 2) - 1, by + 5 + i, Math.floor(i / 2) * 2 + 3, 1);
    g.fillStyle = '#c83a2a';
    for (let i = 1; i < 8; i++) g.fillRect(cx - Math.floor(i / 2), by + 5 + i, Math.floor(i / 2) * 2 + 1, 1);
    g.fillStyle = '#f2e2c0';
    g.fillRect(cx, by + 8, 1, 3);
    g.fillRect(cx, by + 12, 1, 1);
  }

  // ---------- 7d) Meşale standları (meşalenin kendisi oyunda çizilir) ----------
  for (const st of map.stands) {
    const cx = st.tx * TILE + 16, by = st.ty * TILE;
    g.fillStyle = 'rgba(0,0,0,0.45)';
    g.fillRect(cx - 9, by + 27, 18, 3);
    g.fillStyle = METAL.outline;
    for (let i = 0; i < 16; i++) {
      g.fillRect(cx - Math.round(i * 0.5) - 1, by + 13 + i, 2, 1);
      g.fillRect(cx + Math.round(i * 0.5), by + 13 + i, 2, 1);
    }
    g.fillRect(cx - 1, by + 12, 2, 17);
    g.fillStyle = METAL.light;
    g.fillRect(cx - 5, by + 10, 10, 1);
    g.fillStyle = METAL.outline;
    g.fillRect(cx - 5, by + 11, 10, 3);
    g.fillStyle = METAL.mid;
    g.fillRect(cx - 4, by + 11, 8, 1);
  }

  // ---------- 8) Asansör kafesi ----------
  if (map.elevator) {
    const e = map.elevator;
    const x0 = e.tx * TILE, y0 = e.ty * TILE;
    const w = e.tw * TILE, h = e.th * TILE;
    const x1 = x0 + w, y1 = y0 + h;
    // Arkadaki kuyu (üstteki duvar yüzünde)
    const sy = y0 - TILE;
    g.fillStyle = '#040406';
    g.fillRect(x0 + 3, sy - 2, w - 6, TILE + 2);
    g.fillStyle = METAL.dark;
    g.fillRect(x0 + 7, sy - 2, 2, TILE + 2);
    g.fillRect(x1 - 9, sy - 2, 2, TILE + 2);
    g.fillStyle = METAL.light;
    g.fillRect(x0 + 7, sy - 2, 1, TILE + 2);
    g.fillRect(x1 - 9, sy - 2, 1, TILE + 2);
    // halatlar
    g.fillStyle = '#6d6a64';
    g.fillRect(x0 + w / 2 - 5, sy - 2, 1, TILE + 6);
    g.fillRect(x0 + w / 2 + 4, sy - 2, 1, TILE + 6);
    // üst kiriş
    drawWood(g, x0 - 2, sy - 3, w + 4, 6, false, rng);
    // Platform
    g.fillStyle = METAL.outline;
    g.fillRect(x0 + 1, y0 + 2, w - 2, h - 3);
    g.fillStyle = METAL.dark;
    g.fillRect(x0 + 2, y0 + 3, w - 4, h - 5);
    g.fillStyle = '#1b1e23';
    for (let x = x0 + 5; x < x1 - 3; x += 5) g.fillRect(x, y0 + 4, 1, h - 7);
    for (let y = y0 + 7; y < y1 - 3; y += 5) g.fillRect(x0 + 3, y, w - 6, 1);
    g.fillStyle = METAL.mid;
    g.fillRect(x0 + 2, y0 + 3, w - 4, 1);
    g.fillStyle = METAL.hi;
    for (const [rx, ry] of [[x0 + 4, y0 + 5], [x1 - 5, y0 + 5], [x0 + 4, y1 - 5], [x1 - 5, y1 - 5]]) g.fillRect(rx, ry, 1, 1);
    // Yan kafes duvarları
    for (const sx of [x0 + 1, x1 - 4]) {
      g.fillStyle = METAL.outline;
      g.fillRect(sx, y0 - 20, 3, h + 20);
      g.fillStyle = METAL.mid;
      for (let y = y0 - 18; y < y1; y += 3) g.fillRect(sx + 1, y, 1, 2);
    }
    // Ön direkler ve üst çubuk (madencinin önünde)
    for (const sx of [x0, x1 - 4]) {
      o.fillStyle = METAL.outline;
      o.fillRect(sx, y1 - 36, 4, 36);
      o.fillStyle = METAL.light;
      o.fillRect(sx + 1, y1 - 35, 1, 34);
      o.fillStyle = METAL.dark;
      o.fillRect(sx + 2, y1 - 35, 1, 34);
    }
    o.fillStyle = METAL.outline;
    o.fillRect(x0, y1 - 38, w, 4);
    o.fillStyle = METAL.mid;
    o.fillRect(x0 + 1, y1 - 37, w - 2, 1);
    // örgü
    o.fillStyle = 'rgba(80,88,98,0.8)';
    for (let x = x0 + 6; x < x1 - 5; x += 6) o.fillRect(x, y1 - 34, 1, 4);
    // lamba yeri
    glows.push({ x: x1 - 2, y: y1 - 40, color: [0.35, 1.0, 0.45], radius: 34, intensity: 0.5, lamp: true });
  }

  // ---------- 9) Cevher kayaları ----------
  for (const ore of map.ores) {
    const cx = ore.tx * TILE + 16, cy = ore.ty * TILE + 19;
    // gölge
    g.fillStyle = 'rgba(0,0,0,0.4)';
    g.fillRect(cx - 10, cy + 6, 20, 3);
    drawStone(g, cx, cy, 22, 17, ORE_ROCK, rng);
    drawStone(g, cx + 6, cy - 5, 11, 9, ORE_ROCK, rng);
    const [dk, md, hi] = ORE_COLORS[ore.kind];
    ore.glints = [];
    const n = rng.int(5, 7);
    for (let k = 0; k < n; k++) {
      const px = Math.round(cx + rng.range(-7, 7)), py = Math.round(cy + rng.range(-6, 5));
      g.fillStyle = dk;
      g.fillRect(px, py, 3, 2);
      g.fillStyle = md;
      g.fillRect(px, py, 2, 1);
      g.fillStyle = hi;
      g.fillRect(px, py, 1, 1);
      ore.glints.push({ x: px, y: py, phase: rng.range(0, 10), rate: rng.range(0.6, 1.4) });
    }
    if (ore.kind === 'crystal') glows.push({ x: cx, y: cy, color: [0.3, 0.75, 1.0], radius: 22, intensity: 0.3 });
  }

  // ---------- 10) Süs objeleri ----------
  const decorImg = (key) => images.get(DECOR[key]);
  for (const q of map.decor) {
    const bx = q.tx * TILE, by = q.ty * TILE;
    switch (q.type) {
      case 'k': {
        // maden arabası
        const x = bx + 3, y = by + 7;
        g.fillStyle = 'rgba(0,0,0,0.45)';
        g.fillRect(x + 1, y + 18, 26, 4);
        for (const wx of [x + 3, x + 20]) {
          g.fillStyle = METAL.outline;
          g.fillRect(wx, y + 15, 5, 5);
          g.fillStyle = METAL.mid;
          g.fillRect(wx + 1, y + 16, 3, 3);
        }
        g.fillStyle = METAL.outline;
        g.fillRect(x, y, 26, 17);
        g.fillStyle = '#4a3a2c';
        g.fillRect(x + 1, y + 6, 24, 10);
        g.fillStyle = '#5e4a38';
        g.fillRect(x + 1, y + 6, 24, 1);
        g.fillStyle = METAL.mid;
        g.fillRect(x + 1, y + 1, 24, 5);
        g.fillStyle = METAL.hi;
        g.fillRect(x + 1, y + 1, 24, 1);
        for (let k = 0; k < 7; k++) drawStone(g, x + rng.int(5, 21), y + rng.int(2, 5), rng.int(4, 6), rng.int(3, 5), STONE, rng);
        g.fillStyle = METAL.outline;
        for (const rx of [x + 6, x + 13, x + 20]) g.fillRect(rx, y + 7, 1, 9);
        break;
      }
      case 'c': {
        const key = (q.tx + q.ty) % 2 ? 'crystalBig' : 'crystalCluster';
        const im = decorImg(key);
        if (im) {
          g.drawImage(im, bx, by);
          for (const p of brightPoints(im, 4, rng)) sparkles.push({ x: bx + p.x, y: by + p.y, phase: rng.range(0, 10), rate: rng.range(0.5, 1.2), color: '#d8fff6' });
        }
        glows.push({ x: bx + 16, y: by + 18, color: [0.25, 0.9, 0.8], radius: 40, intensity: 0.42 });
        break;
      }
      case 'g': {
        const key = rng.chance(0.6) ? 'crystalSmall' : 'crystalSmallWhite';
        const im = decorImg(key);
        const x = bx + rng.int(4, 12), y = by + rng.int(6, 14);
        if (im) {
          g.drawImage(im, x, y);
          for (const p of brightPoints(im, 2, rng)) sparkles.push({ x: x + p.x, y: y + p.y, phase: rng.range(0, 10), rate: rng.range(0.4, 1.0), color: key === 'crystalSmall' ? '#c8fff0' : '#ffffff' });
        }
        glows.push({ x: x + 8, y: y + 8, color: key === 'crystalSmall' ? [0.25, 0.9, 0.8] : [0.7, 0.75, 0.9], radius: 20, intensity: 0.3 });
        break;
      }
      case 'm': {
        const im = decorImg(rng.chance(0.5) ? 'mushroomRed' : 'mushroomTeal');
        if (im) g.drawImage(im, bx + rng.int(-2, 2), by + rng.int(-2, 2));
        break;
      }
      case 'b': {
        const im = decorImg('skeleton');
        if (im) g.drawImage(im, bx, by + 2);
        break;
      }
      case 'x': {
        const n = rng.int(5, 8);
        const list = [];
        for (let k = 0; k < n; k++) list.push({ x: bx + 16 + rng.range(-10, 10), y: by + 18 + rng.range(-8, 8), w: rng.int(3, 7), h: rng.int(3, 6) });
        list.sort((a, b) => a.y - b.y);
        for (const s of list) drawStone(g, s.x, s.y, s.w, s.h, rng.chance(0.5) ? STONE : PEBBLE, rng);
        break;
      }
      case 'w':
        drawWeb(g, map, q.tx, q.ty, rng);
        break;
    }
  }

  return { ground, over, glows, sparkles };
}

/** Örümcek ağı: iki duvarın birleştiği köşeye yapışır. */
function drawWeb(g, map, tx, ty, rng) {
  const n = map.isOpaque(tx, ty - 1), s = map.isOpaque(tx, ty + 1);
  const w = map.isOpaque(tx - 1, ty), e = map.isOpaque(tx + 1, ty);
  // Hangi köşede iki duvar birleşiyor? (sol üst, sağ üst, sol alt, sağ alt)
  let right = false, bottom = false;
  if (n && w) { /* sol üst */ }
  else if (n && e) right = true;
  else if (s && w) bottom = true;
  else if (s && e) { right = true; bottom = true; }
  else if (e) right = true;
  else if (s) bottom = true;
  const cx = tx * TILE + (right ? TILE : 0), cy = ty * TILE + (bottom ? TILE : 0);
  const sx = right ? -1 : 1, sy = bottom ? -1 : 1;
  const L = 24;
  const threads = 6;
  g.fillStyle = 'rgba(205,205,215,0.55)';
  const pts = [];
  for (let k = 0; k < threads; k++) {
    const a = ((k + 0.5) / threads) * (Math.PI / 2);
    const len = L * rng.range(0.8, 1.05);
    const dx = Math.cos(a) * sx, dy = Math.sin(a) * sy;
    pts.push({ dx, dy, len });
    for (let r = 0; r < len; r += 1) g.fillRect(Math.round(cx + dx * r), Math.round(cy + dy * r), 1, 1);
  }
  g.fillStyle = 'rgba(205,205,215,0.4)';
  for (const r of [7, 13, 19]) {
    for (let k = 0; k < pts.length - 1; k++) {
      const a = pts[k], b = pts[k + 1];
      const ax = cx + a.dx * r, ay = cy + a.dy * r;
      const bx2 = cx + b.dx * r, by2 = cy + b.dy * r;
      const sag = 1.5;
      for (let t = 0; t <= 1; t += 0.12) {
        const x = ax + (bx2 - ax) * t, y = ay + (by2 - ay) * t + Math.sin(t * Math.PI) * sag * sy;
        g.fillRect(Math.round(x), Math.round(y), 1, 1);
      }
    }
  }
}
