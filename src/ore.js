// Cevherler: altın, mavi kristal, kırmızı yakut.
//
// Her cevher açılışta kodla çizilen küçük bir sprite'tır (32x32). Kazma
// vuruşlarıyla çatlar, sallanır ve birkaç vuruşta kırılır.

import { TILE } from './config.js';
import { drawStone, ORE_ROCK } from './mapRender.js';

export const ORE_TYPES = {
  gold: { name: 'altın', hp: 3, light: [1.0, 0.8, 0.35], glint: '#fff2b0', shards: null },
  crystal: { name: 'kristal', hp: 4, light: [0.35, 0.75, 1.0], glint: '#e6fbff', shards: ['#0c2238', '#1e5c8a', '#4fb8e8', '#9fe8ff', '#ffffff'] },
  ruby: { name: 'yakut', hp: 4, light: [1.0, 0.3, 0.35], glint: '#ffe0e4', shards: ['#2a0610', '#7a1022', '#d8324a', '#ff8a9a', '#ffffff'] },
};

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** Kristal sivri ucu: sol yüz açık, sağ yüz koyu, ucu parlak. */
function drawShard(g, bx, by, w, h, tilt, pal) {
  const [outline, dark, mid, light, hi] = pal;
  for (let i = 0; i < h; i++) {
    const k = i / h; // 0 dip, 1 uç
    const half = Math.max(0.5, (w / 2) * (1 - k * k * 0.85));
    const cx = bx + tilt * k * h * 0.35;
    const y = by - i;
    const x0 = Math.round(cx - half), x1 = Math.round(cx + half);
    for (let x = x0; x <= x1; x++) {
      let c = x === x0 || x === x1 ? outline : x < cx - 0.5 ? light : x > cx + 0.5 ? dark : mid;
      if (i === h - 1) c = outline;
      g.fillStyle = c;
      g.fillRect(x, y, 1, 1);
    }
    if (i > h * 0.45 && i < h - 1) {
      g.fillStyle = hi;
      g.fillRect(Math.round(cx - half) + 1, y, 1, 1);
    }
  }
}

export class Ore {
  constructor(def, rng) {
    this.tx = def.tx;
    this.ty = def.ty;
    this.kind = def.kind;
    this.type = ORE_TYPES[def.kind];
    this.maxHp = this.type.hp;
    this.hp = this.maxHp;
    this.broken = false;
    this.shake = 0;
    /** Sprite'ın sol üst köşesi (dünya) */
    this.x0 = this.tx * TILE;
    this.y0 = this.ty * TILE - 6;
    /** Ortası (etkileşim ve ışık için) */
    this.x = this.tx * TILE + 16;
    this.y = this.ty * TILE + 18;
    this.sprite = makeCanvas(32, 38);
    this.glints = [];
    this.cracks = [];
    this.build(rng);
  }

  build(rng) {
    const g = this.sprite.getContext('2d');
    const cx = 16, cy = 30;
    // gölge
    g.fillStyle = 'rgba(0,0,0,0.45)';
    g.fillRect(cx - 12, cy + 4, 24, 3);
    g.fillRect(cx - 10, cy + 7, 20, 1);
    drawStone(g, cx, cy, 24, 15, ORE_ROCK, rng);
    drawStone(g, cx - 6, cy - 3, 12, 10, ORE_ROCK, rng);
    drawStone(g, cx + 7, cy - 1, 10, 9, ORE_ROCK, rng);

    if (this.kind === 'gold') {
      // damarlar ve külçeler
      g.fillStyle = '#8a5a14';
      let x = cx - 9, y = cy - 3;
      for (let k = 0; k < 16; k++) {
        g.fillRect(Math.round(x), Math.round(y), 1, 1);
        x += 1.2;
        y += rng.range(-0.7, 0.8);
      }
      const n = rng.int(6, 8);
      for (let k = 0; k < n; k++) {
        const px = Math.round(cx + rng.range(-9, 8)), py = Math.round(cy + rng.range(-7, 3));
        g.fillStyle = '#6a4510';
        g.fillRect(px - 1, py - 1, 4, 3);
        g.fillStyle = '#d6a13a';
        g.fillRect(px, py - 1, 3, 2);
        g.fillStyle = '#ffd04a';
        g.fillRect(px, py - 1, 2, 1);
        g.fillStyle = '#fff2a0';
        g.fillRect(px, py - 1, 1, 1);
        this.glints.push({ x: px, y: py - 1, phase: rng.range(0, 10), rate: rng.range(0.7, 1.5) });
      }
    } else {
      const pal = this.type.shards;
      const shards = [
        { x: cx - 5, h: rng.int(12, 15), w: 5, t: -0.8 },
        { x: cx + 1, h: rng.int(16, 20), w: 6, t: 0.1 },
        { x: cx + 7, h: rng.int(10, 13), w: 5, t: 0.9 },
        { x: cx - 10, h: rng.int(6, 8), w: 4, t: -1.2 },
      ];
      for (const s of shards) {
        drawShard(g, s.x, cy - 2, s.w, s.h, s.t, pal);
        this.glints.push({ x: Math.round(s.x + s.t * s.h * 0.3) - 1, y: cy - 2 - Math.round(s.h * 0.7), phase: rng.range(0, 10), rate: rng.range(0.5, 1.2) });
      }
      // dipte küçük parçalar
      for (let k = 0; k < 3; k++) drawShard(g, cx + rng.range(-10, 10), cy + 3, 3, rng.int(3, 5), rng.range(-1, 1), pal);
    }

    // Her vuruşta açılacak çatlaklar (önceden belirlenir)
    for (let s = 0; s < this.maxHp; s++) {
      const pts = [];
      let x = cx + rng.range(-6, 6), y = cy + rng.range(-6, 2);
      const ang = rng.range(0, Math.PI * 2);
      for (let k = 0; k < 9; k++) {
        pts.push([Math.round(x), Math.round(y)]);
        x += Math.cos(ang + rng.range(-0.8, 0.8)) * 1.3;
        y += Math.sin(ang + rng.range(-0.8, 0.8)) * 1.1;
      }
      this.cracks.push(pts);
    }
  }

  get damage() {
    return this.maxHp - this.hp;
  }

  /** Bir kazma vuruşu. Kırıldıysa true döner. */
  hit() {
    if (this.broken) return false;
    this.hp--;
    this.shake = 0.18;
    if (this.hp <= 0) {
      this.broken = true;
      return true;
    }
    return false;
  }

  update(dt) {
    this.shake = Math.max(0, this.shake - dt);
  }

  draw(ctx, camX, camY) {
    if (this.broken) return;
    const j = this.shake > 0 ? Math.round((Math.random() * 2 - 1) * 1.5) : 0;
    const x = this.x0 - camX + j, y = this.y0 - camY;
    ctx.drawImage(this.sprite, x, y);
    // çatlaklar
    for (let s = 0; s < this.damage; s++) {
      for (const [px, py] of this.cracks[s]) {
        ctx.fillStyle = '#0e0a0a';
        ctx.fillRect(x + px, y + py, 1, 1);
        ctx.fillStyle = 'rgba(200,190,180,0.5)';
        ctx.fillRect(x + px + 1, y + py, 1, 1);
      }
    }
  }
}
