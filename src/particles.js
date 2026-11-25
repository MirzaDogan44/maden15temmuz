// Atmosfer parçacıkları: fener ışığında süzülen toz ve meşale kıvılcımları.
// Hepsi dünya koordinatında tutulur, ışık hesabından sonra çizilir.

const MAX_DUST = 90;
const MAX_EMBERS = 80;

export class Particles {
  constructor() {
    this.dust = [];
    this.embers = [];
    this.dustTimer = 0;
    /** Yükseklikli parçacıklar: taş kırıntısı, tavandan düşen çakıl. */
    this.chips = [];
    /** Toz bulutları */
    this.puffs = [];
    /** Kıvılcım sprite efektleri */
    this.sparks = [];
  }

  /** Kazma vuruşunda sıçrayan taş parçaları. colors: [[r,g,b], ...] */
  spawnDebris(x, y, n, colors, power = 1) {
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (20 + Math.random() * 45) * power;
      this.chips.push({
        x, y, z: 6 + Math.random() * 8,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6, vz: 40 + Math.random() * 70 * power,
        c: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() < 0.3 ? 2 : 1, life: 0, max: 1.2 + Math.random() * 0.8, bounced: false,
      });
    }
  }

  /** Tavandan düşen küçük çakıl. */
  spawnFalling(x, y) {
    this.chips.push({
      x, y, z: 70 + Math.random() * 50, vx: 0, vy: 0, vz: 0,
      c: [110, 100, 92], size: Math.random() < 0.4 ? 2 : 1, life: 0, max: 2.5, bounced: false,
    });
  }

  /** Yerden kalkan toz bulutu. */
  spawnPuff(x, y, n = 6, spread = 14) {
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2;
      this.puffs.push({
        x: x + Math.cos(a) * spread * 0.4, y: y + Math.sin(a) * spread * 0.2,
        vx: Math.cos(a) * (10 + Math.random() * 18), vy: Math.sin(a) * (4 + Math.random() * 8) - 3,
        r: 2 + Math.random() * 3, life: 0, max: 0.7 + Math.random() * 0.8,
      });
    }
  }

  spawnSpark(x, y) {
    this.sparks.push({ x, y, t: 0 });
  }

  updateEffects(dt) {
    for (const p of this.chips) {
      p.life += dt;
      if (p.z > 0 || p.vz > 0) {
        p.vz -= 320 * dt;
        p.z += p.vz * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.z <= 0) {
          p.z = 0;
          if (!p.bounced && Math.abs(p.vz) > 40) {
            p.vz = -p.vz * 0.3;
            p.vx *= 0.4;
            p.vy *= 0.4;
            p.bounced = true;
          } else {
            p.vz = 0;
            p.vx = p.vy = 0;
          }
        }
      }
    }
    this.chips = this.chips.filter((p) => p.life < p.max);
    for (const p of this.puffs) {
      p.life += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 1 - 2.5 * dt;
      p.vy *= 1 - 2.5 * dt;
      p.r += dt * 6;
    }
    this.puffs = this.puffs.filter((p) => p.life < p.max);
    for (const s of this.sparks) s.t += dt;
    this.sparks = this.sparks.filter((s) => s.t < 0.16);
  }

  /** Işıktan sonra çizilir; renk bulunduğu yerdeki ışıkla ölçeklenir. */
  drawEffects(ctx, camX, camY, light, sparkImg) {
    for (const p of this.puffs) {
      const L = Math.max(0.12, Math.min(1, light(p.x, p.y)));
      const t = p.life / p.max;
      const a = (1 - t) * 0.45 * L;
      ctx.fillStyle = `rgba(150,138,125,${a.toFixed(2)})`;
      const r = Math.round(p.r);
      ctx.fillRect(Math.round(p.x - camX - r), Math.round(p.y - camY - r / 2), r * 2, r);
    }
    for (const p of this.chips) {
      const L = Math.max(0.15, Math.min(1, light(p.x, p.y) * 1.1));
      const fade = Math.min(1, (p.max - p.life) / 0.4);
      const [r, g, b] = p.c;
      ctx.fillStyle = `rgba(${(r * L) | 0},${(g * L) | 0},${(b * L) | 0},${fade.toFixed(2)})`;
      ctx.fillRect(Math.round(p.x - camX), Math.round(p.y - p.z - camY), p.size, p.size);
    }
    if (sparkImg) {
      for (const s of this.sparks) {
        const f = s.t < 0.08 ? 0 : 1;
        ctx.drawImage(sparkImg, f * 32, 0, 32, 32, Math.round(s.x - camX - 16), Math.round(s.y - camY - 16), 32, 32);
      }
    }
  }

  /**
   * Madencinin çevresinde havada süzülen toz zerrecikleri doğurur.
   * Sadece ışık alan yerlerde görünürler (bkz. drawDust).
   */
  updateDust(dt, center, solidAt) {
    this.dustTimer += dt;
    while (this.dustTimer > 1 / 30) {
      this.dustTimer -= 1 / 30;
      if (this.dust.length >= MAX_DUST) break;
      const a = Math.random() * Math.PI * 2;
      const r = 8 + Math.random() * 150;
      const x = center.x + Math.cos(a) * r, y = center.y + Math.sin(a) * r * 0.8 - 10;
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
