// Atmosfer parçacıkları: fener ışığında süzülen toz ve meşale kıvılcımları.
// Hepsi dünya koordinatında tutulur, ışık hesabından sonra çizilir.

import { LANTERN } from './lighting.js';

const MAX_DUST = 90;
const MAX_EMBERS = 80;

export class Particles {
  constructor() {
    this.dust = [];
    this.embers = [];
    this.dustTimer = 0;
  }

  /** Fener konisinin içinde yeni toz zerrecikleri doğurur. */
  updateDust(dt, lantern, solidAt) {
    this.dustTimer += dt;
    while (this.dustTimer > 1 / 30) {
      this.dustTimer -= 1 / 30;
      if (this.dust.length >= MAX_DUST) break;
      const a = lantern.angle + (Math.random() * 2 - 1) * LANTERN.halfAngle * 1.1;
      const r = 12 + Math.random() * LANTERN.range * 0.8;
      const x = lantern.x + Math.cos(a) * r, y = lantern.y + Math.sin(a) * r - 8;
      if (solidAt(x, y)) continue;
      this.dust.push({
        x, y,
        vx: (Math.random() - 0.5) * 4,
        vy: (Math.random() - 0.5) * 3 + 1,
        life: 0,
        max: 2 + Math.random() * 3.5,
        ph: Math.random() * 10,
        bright: 0.5 + Math.random() * 0.5,
      });
    }
    for (const p of this.dust) {
      p.life += dt;
      p.x += (p.vx + Math.sin(p.life * 1.3 + p.ph) * 2.5) * dt;
      p.y += (p.vy + Math.cos(p.life * 0.9 + p.ph) * 1.5) * dt;
    }
    this.dust = this.dust.filter((p) => p.life < p.max);
  }

  spawnEmber(x, y) {
    if (this.embers.length >= MAX_EMBERS) return;
    this.embers.push({
      x: x + (Math.random() - 0.5) * 3,
      y,
      vx: (Math.random() - 0.5) * 8,
      vy: -14 - Math.random() * 16,
      life: 0,
      max: 0.5 + Math.random() * 1.0,
      ph: Math.random() * 6,
    });
  }

  updateEmbers(dt) {
    for (const p of this.embers) {
      p.life += dt;
      p.vx += Math.sin(p.life * 7 + p.ph) * 20 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy *= 1 - 0.6 * dt;
    }
    this.embers = this.embers.filter((p) => p.life < p.max);
  }

  drawDust(ctx, camX, camY, light) {
    for (const p of this.dust) {
      const L = Math.min(1, light(p.x, p.y));
      if (L < 0.12) continue;
      const t = p.life / p.max;
      const fade = Math.min(1, t * 4, (1 - t) * 3);
      const a = L * fade * p.bright * 0.95;
      if (a < 0.05) continue;
      ctx.fillStyle = `rgba(255,232,190,${a.toFixed(2)})`;
      ctx.fillRect(Math.round(p.x - camX), Math.round(p.y - camY), 1, 1);
    }
  }

  drawEmbers(ctx, camX, camY) {
    for (const p of this.embers) {
      const t = p.life / p.max;
      const c = t < 0.3 ? '255,220,120' : t < 0.65 ? '255,140,50' : '200,60,30';
      ctx.fillStyle = `rgba(${c},${(1 - t * 0.7).toFixed(2)})`;
      ctx.fillRect(Math.round(p.x - camX), Math.round(p.y - camY), 1, 1);
    }
  }
}
