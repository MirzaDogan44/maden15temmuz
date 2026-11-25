// Madenci: tıkla-yürü hareketi, yön, animasyon ve adım olayları.

import { MINER_SPEED } from './config.js';
import { MINER_SPRITES, drawMiner } from './assets.js';

const TURN_RATE = 14; // hız vektörünün hedef yöne dönme hızı (1/sn)
const WAYPOINT_RADIUS = 7; // ara noktaya bu kadar yaklaşınca sonrakine geç
const ARRIVE_RADIUS = 1.2;
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
  }

  setPath(points) {
    this.path = points ? points.slice() : [];
    this.stuckTime = 0;
  }

  stop() {
    this.path = [];
  }

  update(dt, map) {
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
      this.walkTime += dt * (speedNow / this.speed);
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

  draw(ctx, camX, camY) {
    const x = this.x - camX, y = this.y - camY;
    // ayak gölgesi
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(Math.round(x - 5), Math.round(y - 1), 10, 2);
    ctx.fillRect(Math.round(x - 4), Math.round(y - 2), 8, 4);
    const ok = this.moving
      ? drawMiner(ctx, 'walk', this.dir, { frame: this.frame }, x, y)
      : drawMiner(ctx, 'idle', this.dir, this.idleTime, x, y);
    if (!ok) {
      ctx.fillStyle = '#c98a3a';
      ctx.fillRect(Math.round(x - 6), Math.round(y - 20), 12, 20);
    }
  }
}
