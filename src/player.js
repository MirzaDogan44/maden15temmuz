// Madenci: tıkla-yürü hareketi, yön, animasyon ve adım olayları.

import { MINER_SPEED, CARRY_SLOWDOWN, MIN_CARRY_SPEED } from './config.js';
import { MINER_SPRITES, drawMiner } from './assets.js';

const TURN_RATE = 14; // hız vektörünün hedef yöne dönme hızı (1/sn)
const WAYPOINT_RADIUS = 7; // ara noktaya bu kadar yaklaşınca sonrakine geç
const ARRIVE_RADIUS = 1.2;
const SWING = 0.58; // bir kazma vuruşunun süresi (sn)
const HIT_AT = 0.72; // vuruşun hangi anında taşa değer (0..1)
// Ayak kutusu
const RX = 5, RY1 = 4, RY2 = 3;

export class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.dir = 'down';
    /** Fenerin baktığı açı (radyan). Yumuşakça hareket yönüne döner. */
    this.angle = Math.PI / 2;
    this.path = [];
    this.speed = MINER_SPEED;
    this.walkTime = 0;
    this.idleTime = 0;
    this.frame = 0;
    this.moving = false;
    this.stuckTime = 0;
    /** Ayağın yere bastığı karede çağrılır. */
    this.onStep = null;
    /** Elinde meşale var mı? (Işığı ileride Gromm'un "görme"sini etkileyecek.) */
    this.hasTorch = false;
    /** Sırttaki çuvaldaki cevherler (tür listesi) */
    this.cargo = [];
    /** Kazma durumu: { target, t, cycle, onHit } veya null */
    this.dig = null;
    /** Yakalandıysa ölüm animasyonu zamanı */
    this.dead = false;
    this.deadTime = 0;
  }

  get carried() {
    return this.cargo.length;
  }

  /** Taşıma yüküne göre yürüme hızı. */
  get currentSpeed() {
    return MINER_SPEED * Math.max(MIN_CARRY_SPEED, 1 - CARRY_SLOWDOWN * this.cargo.length);
  }

  /** (x, y)'deki bir hedefi kazmaya başla. onHit her vuruşta çağrılır. */
  startDig(x, y, onHit) {
    this.path = [];
    this.vx = this.vy = 0;
    const dx = x - this.x, dy = y - this.y;
    if (Math.abs(dx) > Math.abs(dy) * 0.8) this.dir = dx < 0 ? 'left' : 'right';
    else this.dir = dy < 0 ? 'up' : 'down';
    this.dig = { x, y, t: 0, cycle: -1, onHit };
  }

  stopDig() {
    this.dig = null;
  }

  setDead() {
    this.dead = true;
    this.deadTime = 0;
    this.path = [];
    this.dig = null;
    this.vx = this.vy = 0;
  }

  /** Elde tutulan meşalenin alev noktası (dünya koordinatı). */
  torchTip() {
    const bob = this.moving && this.frame % 2 ? 1 : 0;
    if (this.dig) {
      // Kazarken meşale diğer elde
      switch (this.dir) {
        case 'left': return { x: this.x + 7, y: this.y - 18 };
        case 'right': return { x: this.x - 7, y: this.y - 18 };
        case 'up': return { x: this.x + 8, y: this.y - 20 };
        default: return { x: this.x - 8, y: this.y - 19 };
      }
    }
    switch (this.dir) {
      case 'left': return { x: this.x - 9, y: this.y - 19 + bob };
      case 'right': return { x: this.x + 9, y: this.y - 19 + bob };
      case 'up': return { x: this.x - 8, y: this.y - 20 + bob };
      default: return { x: this.x + 8, y: this.y - 19 + bob };
    }
  }

  /** Meşale sapı (sprite'tan önce/sonra çizilir). */
  drawTorchStick(ctx, camX, camY) {
    const tip = this.torchTip();
    const x = Math.round(tip.x - camX), y = Math.round(tip.y - camY);
    const lean = this.dir === 'left' ? 1 : this.dir === 'right' ? -1 : 0;
    ctx.fillStyle = '#1a0f08';
    for (let i = 0; i < 9; i++) ctx.fillRect(x + Math.round((lean * i) / 4) - 1, y + 1 + i, 3, 1);
    ctx.fillStyle = '#7a5230';
    for (let i = 0; i < 8; i++) ctx.fillRect(x + Math.round((lean * i) / 4), y + 1 + i, 1, 1);
    ctx.fillStyle = '#2a1408';
    ctx.fillRect(x - 1, y, 3, 2);
  }

  setPath(points) {
    this.path = points ? points.slice() : [];
    this.stuckTime = 0;
    this.dig = null;
  }

  stop() {
    this.path = [];
  }

  update(dt, map) {
    if (this.dead) {
      this.deadTime += dt;
      return;
    }
    this.speed = this.currentSpeed;
    if (this.dig) {
      const d = this.dig;
      d.t += dt;
      const cycle = Math.floor(d.t / SWING);
      const phase = (d.t % SWING) / SWING;
      if (phase >= HIT_AT && cycle !== d.cycle) {
        d.cycle = cycle;
        d.onHit();
      }
      this.moving = false;
      this.idleTime += dt;
      return;
    }
    let dvx = 0, dvy = 0;
    if (this.path.length) {
      const p = this.path[0];
      const dx = p.x - this.x, dy = p.y - this.y;
      const dist = Math.hypot(dx, dy);
      const last = this.path.length === 1;
      if ((last && dist < ARRIVE_RADIUS) || (!last && dist < WAYPOINT_RADIUS)) {
        this.path.shift();
        if (last) {
          this.vx = this.vy = 0;
        }
      } else {
        // Son noktaya yaklaşırken yavaşla.
        const sp = last ? this.speed * Math.min(1, dist / 10 + 0.25) : this.speed;
        dvx = (dx / dist) * sp;
        dvy = (dy / dist) * sp;
      }
    }

    // Yön değişimini yumuşat: köşelerde keskin değil kavisli döner.
    const k = 1 - Math.exp(-TURN_RATE * dt);
    this.vx += (dvx - this.vx) * k;
    this.vy += (dvy - this.vy) * k;
    if (!this.path.length && Math.hypot(this.vx, this.vy) < 4) this.vx = this.vy = 0;

    // Çarpışmalı hareket: önce tam, olmazsa eksen eksen kaydır.
    const ox = this.x, oy = this.y;
    const nx = this.x + this.vx * dt, ny = this.y + this.vy * dt;
    if (!map.boxBlocked(nx, ny, RX, RY1, RY2)) {
      this.x = nx;
      this.y = ny;
    } else {
      if (!map.boxBlocked(nx, this.y, RX, RY1, RY2)) this.x = nx;
      if (!map.boxBlocked(this.x, ny, RX, RY1, RY2)) this.y = ny;
    }
    const moved = Math.hypot(this.x - ox, this.y - oy);
    const speedNow = moved / dt;

    // Takılma koruması: yol varken neredeyse hiç ilerlemiyorsa dur.
    if (this.path.length && speedNow < this.speed * 0.15) {
      this.stuckTime += dt;
      if (this.stuckTime > 0.5) this.stop();
    } else this.stuckTime = 0;

    this.moving = speedNow > 8;
    if (this.moving) {
      // Yön seçimi (biraz eşik payıyla, titreme olmasın)
      const ax = Math.abs(this.vx), ay = Math.abs(this.vy);
      const horiz = this.dir === 'left' || this.dir === 'right';
      if (ax > ay * (horiz ? 0.8 : 1.25)) this.dir = this.vx < 0 ? 'left' : 'right';
      else this.dir = this.vy < 0 ? 'up' : 'down';

      // Fener açısı
      const target = Math.atan2(this.vy, this.vx);
      let da = target - this.angle;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      this.angle += da * (1 - Math.exp(-10 * dt));

      // Yürüme animasyonu hızla orantılı ilerler.
      const anim = MINER_SPRITES.anims.walk;
      this.walkTime += dt * (speedNow / MINER_SPEED);
      const f = Math.floor(this.walkTime * anim.fps) % anim.frames;
      if (f !== this.frame && (f === 1 || f === 3) && this.onStep) this.onStep();
      this.frame = f;
      this.idleTime = 0;
    } else {
      this.idleTime += dt;
      this.walkTime = 0;
      this.frame = 0;
    }
  }

  /** Kazma: sapı tahta, başı demir; vuruş açısına göre piksel piksel çizilir. */
  drawPickaxe(ctx, camX, camY) {
    const d = this.dig;
    const phase = (d.t % SWING) / SWING;
    // sağa bakarken açı: kaldırılmış -2.5 rad, vuruş 0.55 rad
    const up = -2.5, hit = 0.55;
    let a;
    if (phase < 0.5) a = hit + (up - hit) * easeOut(phase / 0.5);
    else if (phase < HIT_AT) a = up + (hit - up) * easeIn((phase - 0.5) / (HIT_AT - 0.5));
    else a = hit - Math.sin(((phase - HIT_AT) / (1 - HIT_AT)) * Math.PI) * 0.15;
    const flip = this.dir === 'left';
    if (flip) a = Math.PI - a;
    const hand = {
      left: [-5, -12], right: [5, -12], up: [-6, -13], down: [6, -11],
    }[this.dir];
    const hx = this.x - camX + hand[0], hy = this.y - camY + hand[1];
    const ca = Math.cos(a), sa = Math.sin(a);
    const L = 12;
    // sap
    for (let i = -2; i <= L; i++) {
      const px = Math.round(hx + ca * i), py = Math.round(hy + sa * i);
      ctx.fillStyle = '#1a0f08';
      ctx.fillRect(px, py, 2, 2);
      ctx.fillStyle = '#8a5c34';
      ctx.fillRect(px, py, 1, 1);
    }
    // baş: sapın ucunda, ona dik ve hafif kavisli
    const ex = hx + ca * L, ey = hy + sa * L;
    const nx = -sa, ny = ca;
    for (let k = -5; k <= 5; k++) {
      const bend = (k * k) / 10;
      const px = Math.round(ex + nx * k - ca * bend), py = Math.round(ey + ny * k - sa * bend);
      ctx.fillStyle = '#16181c';
      ctx.fillRect(px - 1, py - 1, 3, 3);
    }
    for (let k = -5; k <= 5; k++) {
      const bend = (k * k) / 10;
      const px = Math.round(ex + nx * k - ca * bend), py = Math.round(ey + ny * k - sa * bend);
      ctx.fillStyle = Math.abs(k) >= 4 ? '#c8ced6' : '#7c848f';
      ctx.fillRect(px, py, 1, 1);
    }
  }

  /** Sırttaki cevher çuvalı. */
  drawSack(ctx, camX, camY) {
    const off = { down: [0, -21], up: [0, -16], left: [6, -18], right: [-6, -18] }[this.dir];
    const x = Math.round(this.x - camX + off[0]), y = Math.round(this.y - camY + off[1]);
    const n = this.cargo.length;
    const w = 7 + Math.min(4, n), h = 6 + Math.min(4, n);
    ctx.fillStyle = '#1e140c';
    ctx.fillRect(x - Math.ceil(w / 2) - 1, y - h, w + 2, h + 1);
    ctx.fillStyle = '#6e5232';
    ctx.fillRect(x - Math.ceil(w / 2), y - h + 1, w, h - 1);
    ctx.fillStyle = '#8c6c44';
    ctx.fillRect(x - Math.ceil(w / 2), y - h + 1, w, 1);
    const cols = { gold: '#ffd04a', crystal: '#7fd8ff', ruby: '#ff5a6e' };
    for (let i = 0; i < Math.min(4, n); i++) {
      ctx.fillStyle = cols[this.cargo[i]];
      ctx.fillRect(x - Math.ceil(w / 2) + 1 + i * 2, y - h, 2, 2);
    }
  }

  draw(ctx, camX, camY) {
    const x = this.x - camX, y = this.y - camY;
    if (this.dead) {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(Math.round(x - 6), Math.round(y - 2), 12, 3);
      drawMiner(ctx, 'death', 'down', this.deadTime, x, y);
      return;
    }
    const sackBehind = this.cargo.length && this.dir !== 'up';
    const pickBehind = this.dig && this.dir === 'up';
    if (sackBehind) this.drawSack(ctx, camX, camY);
    if (pickBehind) this.drawPickaxe(ctx, camX, camY);
    // ayak gölgesi
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(Math.round(x - 5), Math.round(y - 1), 10, 2);
    ctx.fillRect(Math.round(x - 4), Math.round(y - 2), 8, 4);
    // Yukarı bakarken meşale vücudun arkasında kalır.
    if (this.hasTorch && this.dir === 'up') this.drawTorchStick(ctx, camX, camY);
    const ok = this.moving
      ? drawMiner(ctx, 'walk', this.dir, { frame: this.frame }, x, y)
      : drawMiner(ctx, 'idle', this.dir, this.idleTime, x, y);
    if (this.hasTorch && this.dir !== 'up') this.drawTorchStick(ctx, camX, camY);
    if (this.cargo.length && !sackBehind) this.drawSack(ctx, camX, camY);
    if (this.dig && !pickBehind) this.drawPickaxe(ctx, camX, camY);
    if (!ok) {
      ctx.fillStyle = '#c98a3a';
      ctx.fillRect(Math.round(x - 6), Math.round(y - 20), 12, 20);
    }
  }
}

function easeOut(t) {
  return 1 - (1 - t) * (1 - t);
}
function easeIn(t) {
  return t * t * t;
}
