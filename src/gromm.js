// Gromm: madende dolaşan dev yaratık.
//
// Görsel: 10KStudios "Top-Down Boss Enemy" sprite'ları (64x64 kare, 4 yön).
// Açılışta koyu mor/griye boyanır ve 2 kat büyütülerek çizilir (~90-100 px).
// Kırmızı göz pikselleri her kare için kaydedilir; ışık hesabından sonra
// kendi ışığıyla parlatılır, böylece karanlıkta önce gözleri görünür.
//
// Davranış (1. bölüm):
//   idle    -> durup etrafı dinler
//   wander  -> haritada rastgele bir noktaya yürür
//   chase   -> madenciyi görünce kovalar (yakın + görüş hattı)
//   search  -> gözden kaybedince son gördüğü yere gider, sonra vazgeçer
//   attack  -> yakaladı
//
// Hareket hantal: hız vektörü ivmeyle değişir, ani dönemez. Madenci keskin
// dönüşlerle kaçabilir.

import { TILE, MINER_SPEED } from './config.js';
import { images, GROMM_SPRITES } from './assets.js';
import { findPath } from './pathfinding.js';

const SCALE = 2;
const FEET = 57; // karede ayakların olduğu satır
export const GROMM = {
  /** Dolaşırken: madencinin yürüyüşünden yavaş */
  wanderSpeed: MINER_SPEED * 0.75,
  /** Kovalarken: madencinin yürüyüşünden biraz hızlı, sprintten belirgin yavaş */
  chaseSpeed: MINER_SPEED * 1.1,
  /** İleri/geri ivme (px/sn²) */
  accel: 240,
  /** Yana ivme (px/sn²): düşük olduğu için köşelerde savrulur */
  turnAccel: 120,
  /** Keskin dönüşte (180°) hızın düşeceği oran */
  turnSlowdown: 0.55,
  /** Bu mesafede ve görüş hattı açıksa madenciyi fark eder */
  seeRange: 5.5 * TILE,
  /** Kovalarken madenci bu mesafeden uzaklaşırsa bırakır */
  loseRange: 8 * TILE,
  /** Son görülen yerde etrafına bakınma süresi (sn) */
  lookTime: 2.5,
  /** Ayaklar arası bu mesafeye inince yakalar (gerçekten üstüne basınca) */
  catchRange: 14,
  /** Ayak kutusu */
  box: [12, 7, 4],
};

// --- Boyama ---
const STONE_RAMP = [[16, 12, 24], [42, 32, 58], [68, 54, 88], [98, 84, 120], [134, 120, 156], [176, 164, 196]];
const SPIKE_RAMP = [[26, 14, 44], [62, 32, 98], [104, 62, 150], [160, 116, 210], [214, 190, 255]];

function ramp(r, l) {
  const t = Math.max(0, Math.min(0.999, l)) * (r.length - 1);
  const i = Math.floor(t), f = t - i;
  const a = r[i], b = r[i + 1];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

/** Bir animasyon sayfasını boyar, göz piksellerini kare kare çıkarır. */
function recolor(img, frames) {
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  const id = g.getImageData(0, 0, c.width, c.height);
  const d = id.data;
  const eyes = []; // eyes[row][frame] = [[x,y],...]
  for (let r = 0; r < 4; r++) {
    eyes.push([]);
    for (let f = 0; f < frames; f++) eyes[r].push([]);
  }
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      const i = (y * c.width + x) * 4;
      if (d[i + 3] < 20) continue;
      const R = d[i], G = d[i + 1], B = d[i + 2];
      if (R > 150 && G < 90 && B < 90) {
        // göz: koyu kırmızı bırak, parlaklığı sonra eklenecek
        d[i] = 150;
        d[i + 1] = 20;
        d[i + 2] = 24;
        eyes[Math.floor(y / 64)][Math.floor(x / 64)].push([x % 64, y % 64]);
        continue;
      }
      const l = Math.pow((0.3 * R + 0.59 * G + 0.11 * B) / 255, 0.85) * 1.25;
      const c2 = G > R + 25 && B > R + 25 ? ramp(SPIKE_RAMP, l) : ramp(STONE_RAMP, l);
      d[i] = c2[0];
      d[i + 1] = c2[1];
      d[i + 2] = c2[2];
    }
  }
  g.putImageData(id, 0, 0);
  return { canvas: c, eyes };
}

let SHEETS = null;
function sheets() {
  if (SHEETS) return SHEETS;
  SHEETS = {};
  for (const [name, a] of Object.entries(GROMM_SPRITES.anims)) {
    const img = images.get(a.src);
    if (img) SHEETS[name] = recolor(img, a.frames);
  }
  return SHEETS;
}

export class Gromm {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.dir = 'down';
    this.state = 'idle';
    this.stateTime = 0;
    this.idleFor = 3;
    this.path = [];
    this.repath = 0;
    this.lastSeen = null;
    this.unseen = 0;
    this.anim = 'idle';
    this.animT = 0;
    this.frame = 0;
    this.stuck = 0;
    /** Elinin/ayağının yere değdiği her an: (x, y) */
    this.onStomp = null;
    /** Madenciyi ilk fark ettiğinde */
    this.onSpot = null;
    sheets();
  }

  get speed() {
    return Math.hypot(this.vx, this.vy);
  }

  setState(s) {
    this.state = s;
    this.stateTime = 0;
  }

  /**
   * Madenciyi görüyor mu? Sadece görüş hattı açıksa (arada duvar yoksa) ve
   * menzil içindeyse. Kovalarken menzil daha uzun (loseRange).
   */
  canSee(player, map, range = GROMM.seeRange) {
    const d = Math.hypot(player.x - this.x, player.y - this.y);
    if (d > range) return false;
    return !map.rayBlocked(this.x, this.y - 10, player.x, player.y - 8);
  }

  goTo(map, x, y) {
    const res = findPath(map, this.x, this.y, x, y, { box: GROMM.box, wallCost: 2.5 });
    this.path = res ? res.points : [];
    return this.path.length > 0;
  }

  pickWanderTarget(map, player) {
    for (let k = 0; k < 30; k++) {
      const tx = Math.floor(Math.random() * map.w), ty = Math.floor(Math.random() * map.h);
      let open = true;
      for (let oy = -1; oy <= 1 && open; oy++) for (let ox = -1; ox <= 1; ox++) if (map.isSolid(tx + ox, ty + oy)) open = false;
      if (!open) continue;
      const x = (tx + 0.5) * TILE, y = (ty + 0.6) * TILE;
      const d = Math.hypot(x - this.x, y - this.y);
      if (d < 5 * TILE || d > 22 * TILE) continue;
      if (this.goTo(map, x, y)) return true;
    }
    return false;
  }

  update(dt, map, player) {
    this.stateTime += dt;
    const alive = !player.dead;
    const dist = Math.hypot(player.x - this.x, player.y - this.y);

    switch (this.state) {
      case 'idle':
        this.path = [];
        if (alive && this.canSee(player, map)) this.startChase(player);
        else if (this.stateTime > this.idleFor) {
          if (this.pickWanderTarget(map, player)) this.setState('wander');
          else this.stateTime = 0;
        }
        break;
      case 'wander':
        if (alive && this.canSee(player, map)) this.startChase(player);
        else if (!this.path.length) this.rest();
        break;
      case 'chase': {
        if (dist > GROMM.loseRange) {
          // Yeterince uzaklaştı: bırak, etrafına bakın
          this.lookAround();
          break;
        }
        if (alive && this.canSee(player, map, GROMM.loseRange)) {
          this.lastSeen = { x: player.x, y: player.y };
          this.repath -= dt;
          if (this.repath <= 0) {
            this.repath = 0.3;
            this.goTo(map, player.x, player.y);
          }
        } else {
          // Görüş kesildi: en son görüldüğü yere git
          this.setState('search');
          this.goTo(map, this.lastSeen.x, this.lastSeen.y);
        }
        break;
      }
      case 'search':
        if (alive && this.canSee(player, map)) this.startChase(player);
        else if (!this.path.length || this.stateTime > 10) this.lookAround();
        break;
      case 'look':
        // Durup etrafına bakınır: yönünü değiştirir
        this.path = [];
        if (alive && this.canSee(player, map)) this.startChase(player);
        else {
          const k = Math.floor(this.stateTime / 0.6);
          if (k !== this.lookStep) {
            this.lookStep = k;
            const dirs = ['left', 'up', 'right', 'down'];
            this.dir = dirs[(dirs.indexOf(this.dir) + 1 + (Math.random() < 0.5 ? 0 : 2)) % 4];
          }
          if (this.stateTime > this.lookFor) this.rest(0.3);
        }
        break;
      case 'attack':
        this.path = [];
        break;
    }

    // Hareket: hedef hız; keskin dönüşte yavaşlar
    const maxV = this.state === 'chase' ? GROMM.chaseSpeed : GROMM.wanderSpeed;
    let dvx = 0, dvy = 0;
    if (this.path.length) {
      const p = this.path[0];
      const dx = p.x - this.x, dy = p.y - this.y;
      const d = Math.hypot(dx, dy);
      const last = this.path.length === 1;
      if (d < (last ? 6 : 18)) this.path.shift();
      else {
        let sp = last && this.state !== 'chase' ? maxV * Math.min(1, d / 30) : maxV;
        const v = this.speed;
        if (v > 20) {
          // hareket yönü ile istenen yön arasındaki açı
          const cos = (this.vx * dx + this.vy * dy) / (v * d);
          const ang = Math.acos(Math.max(-1, Math.min(1, cos)));
          sp *= 1 - GROMM.turnSlowdown * (ang / Math.PI);
        }
        dvx = (dx / d) * sp;
        dvy = (dy / d) * sp;
      }
    }
    // İvme: ileri/geri ve yana ayrı sınır (yana düşük: savrulma)
    const v = this.speed;
    let ax = dvx - this.vx, ay = dvy - this.vy;
    if (v > 1) {
      const ux = this.vx / v, uy = this.vy / v;
      let along = ax * ux + ay * uy;
      let side = -ax * uy + ay * ux;
      const ma = GROMM.accel * dt, ms = GROMM.turnAccel * dt;
      along = Math.max(-ma, Math.min(ma, along));
      side = Math.max(-ms, Math.min(ms, side));
      ax = along * ux - side * uy;
      ay = along * uy + side * ux;
    } else {
      const al = Math.hypot(ax, ay), ma = GROMM.accel * dt;
      if (al > ma) {
        ax = (ax / al) * ma;
        ay = (ay / al) * ma;
      }
    }
    this.vx += ax;
    this.vy += ay;
    const [rx, ry1, ry2] = GROMM.box;
    const ox = this.x, oy = this.y;
    const nx = this.x + this.vx * dt, ny = this.y + this.vy * dt;
    if (!map.boxBlocked(nx, ny, rx, ry1, ry2)) {
      this.x = nx;
      this.y = ny;
    } else {
      if (!map.boxBlocked(nx, this.y, rx, ry1, ry2)) this.x = nx;
      else this.vx *= 0.3;
      if (!map.boxBlocked(this.x, ny, rx, ry1, ry2)) this.y = ny;
      else this.vy *= 0.3;
    }
    const moved = Math.hypot(this.x - ox, this.y - oy) / dt;
    if (this.path.length && moved < 10) {
      this.stuck += dt;
      if (this.stuck > 1) {
        this.stuck = 0;
        this.path = [];
        this.repath = 0;
        if (this.state !== 'chase') this.rest(0.5);
      }
    } else this.stuck = 0;

    // Yön ve animasyon
    if (this.state === 'attack') {
      this.anim = 'swipe';
      this.animT += dt;
      return;
    }
    if (moved > 12) {
      const avx = Math.abs(this.vx), avy = Math.abs(this.vy);
      const horiz = this.dir === 'left' || this.dir === 'right';
      if (avx > avy * (horiz ? 0.75 : 1.35)) this.dir = this.vx < 0 ? 'left' : 'right';
      else this.dir = this.vy < 0 ? 'up' : 'down';
      if (this.anim !== 'walk') {
        this.anim = 'walk';
        this.animT = 0;
      }
      const a = GROMM_SPRITES.anims.walk;
      this.animT += dt * (moved / 9) / a.fps;
      const f = Math.floor(this.animT * a.fps) % a.frames;
      if (f !== this.frame && (f === 2 || f === 7) && this.onStomp) this.onStomp(this.x, this.y, f === 2 ? -1 : 1);
      this.frame = f;
    } else {
      if (this.anim !== 'idle') {
        this.anim = 'idle';
        this.animT = 0;
      }
      this.animT += dt;
      this.frame = Math.floor(this.animT * GROMM_SPRITES.anims.idle.fps) % GROMM_SPRITES.anims.idle.frames;
    }
  }

  startChase(player) {
    const was = this.state;
    this.setState('chase');
    this.repath = 0;
    this.unseen = 0;
    this.lastSeen = { x: player.x, y: player.y };
    if (was !== 'chase' && this.onSpot) this.onSpot();
  }

  /** Son görülen yerde durup 2-3 sn etrafına bakın, sonra dolaşmaya dön. */
  lookAround() {
    this.setState('look');
    this.lookFor = GROMM.lookTime + Math.random() * 0.8;
    this.lookStep = -1;
    this.path = [];
  }

  rest(t = 1 + Math.random() * 2.5) {
    this.setState('idle');
    this.idleFor = t;
    this.path = [];
  }

  /** Yakaladı: madenciye dönüp pençe savurur. */
  attack(player) {
    this.setState('attack');
    this.animT = 0;
    const dx = player.x - this.x, dy = player.y - this.y;
    if (Math.abs(dx) > Math.abs(dy)) this.dir = dx < 0 ? 'left' : 'right';
    else this.dir = dy < 0 ? 'up' : 'down';
    this.vx = this.vy = 0;
    this.path = [];
  }

  currentFrame() {
    const a = GROMM_SPRITES.anims[this.anim];
    if (this.anim === 'walk' || this.anim === 'idle') return { a, f: this.frame };
    const f = Math.min(a.frames - 1, Math.floor(this.animT * a.fps));
    return { a, f };
  }

  draw(ctx, camX, camY) {
    const sh = SHEETS && SHEETS[this.anim];
    const { a, f } = this.currentFrame();
    const x = Math.round(this.x - camX), y = Math.round(this.y - camY);
    // ayak gölgesi
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(x - 22, y - 4, 44, 6);
    ctx.fillRect(x - 17, y - 6, 34, 10);
    if (!sh) {
      ctx.fillStyle = '#3b2e4a';
      ctx.fillRect(x - 30, y - 90, 60, 90);
      return;
    }
    const row = a.rows[this.dir] ?? 0;
    ctx.drawImage(sh.canvas, f * 64, row * 64, 64, 64, x - 32 * SCALE, y - FEET * SCALE, 64 * SCALE, 64 * SCALE);
  }

  /** Gözler (ışık hesabından sonra): parlak kırmızı ve hafif hale. */
  drawEyes(ctx, camX, camY, t) {
    const sh = SHEETS && SHEETS[this.anim];
    if (!sh) return;
    const { a, f } = this.currentFrame();
    const row = a.rows[this.dir] ?? 0;
    const pts = sh.eyes[row][f];
    if (!pts.length) return;
    const ox = Math.round(this.x - camX) - 32 * SCALE, oy = Math.round(this.y - camY) - FEET * SCALE;
    const pulse = 0.85 + Math.sin(t * 2.3) * 0.15;
    // hale (dithering'li)
    let cx = 0, cy = 0;
    for (const [px, py] of pts) {
      cx += px;
      cy += py;
    }
    cx = ox + (cx / pts.length) * SCALE;
    cy = oy + (cy / pts.length) * SCALE;
    ctx.fillStyle = `rgba(255,40,30,${(0.22 * pulse).toFixed(2)})`;
    for (let dy = -6; dy <= 6; dy++) {
      for (let dx = -8; dx <= 8; dx++) {
        if ((dx + dy) & 1 || dx * dx + dy * dy * 1.6 > 60) continue;
        ctx.fillRect(Math.round(cx + dx), Math.round(cy + dy), 1, 1);
      }
    }
    ctx.fillStyle = `rgba(255,60,40,${pulse.toFixed(2)})`;
    for (const [px, py] of pts) ctx.fillRect(ox + px * SCALE, oy + py * SCALE, SCALE, SCALE);
    ctx.fillStyle = `rgba(255,220,190,${(0.9 * pulse).toFixed(2)})`;
    const [px, py] = pts[0];
    ctx.fillRect(ox + px * SCALE, oy + py * SCALE, 1, 1);
  }
}
