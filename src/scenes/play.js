// Oyun sahnesi: harita, madenci, kamera, ışık ve atmosfer.
//
// Çizim sırası (her kare):
//   1) Ekran dışı "sahne" canvas'ına: zemin katmanı, madenci, tavan katmanı
//   2) Sahne pikselleri ışıkla çarpılır (karanlık, fener, meşaleler)
//   3) Ana canvas'a kendi ışığı olanlar eklenir: alevler, kıvılcımlar,
//      kristal parıltıları, toz, tıklama işareti

import { DEBUG, TILE } from '../config.js';
import { LEVELS } from '../levels.js';
import { TileMap } from '../map.js';
import { bakeMap } from '../mapRender.js';
import { Lighting, TORCH } from '../lighting.js';
import { Player } from '../player.js';
import { findPath } from '../pathfinding.js';
import { Particles } from '../particles.js';
import { drawText } from '../font.js';
import * as audio from '../audio.js';

const NO_LIGHT = new URLSearchParams(location.search).has('nolight');

export class PlayScene {
  constructor(game, levelIndex = 0) {
    this.game = game;
    this.t = 0;
    this.level = LEVELS[levelIndex];
    this.map = new TileMap(this.level);
    const baked = bakeMap(this.map);
    this.ground = baked.ground;
    this.over = baked.over;
    this.sparkles = baked.sparkles;

    this.player = new Player(this.map.start.x, this.map.start.y);
    this.player.onStep = () => audio.playStep(false);

    // Işıklar
    this.lighting = new Lighting(this.map);
    this.torches = this.map.torches.map((t) => {
      const x = t.tx * TILE + 16, y = t.ty * TILE + 9;
      const light = this.lighting.addStatic({
        x, y: y + 6,
        ox: x, oy: (t.ty + 1) * TILE + 2,
        radius: TORCH.radius, color: TORCH.color, intensity: TORCH.intensity,
      });
      return { x, y, light, phase: Math.random() * 100, flick: 1, target: 1, timer: 0, emberTimer: Math.random() };
    });
    for (const L of this.map.lamps) {
      if (!L.lit) continue;
      const x = L.tx * TILE + 16;
      this.lighting.addStatic({
        x, y: L.ty * TILE + 20, ox: x, oy: (L.ty + 1) * TILE + 2,
        radius: 140, color: [1.0, 0.72, 0.4], intensity: 0.9,
      });
    }
    this.glows = baked.glows.map((gl) => ({
      ...gl,
      light: this.lighting.addStatic({ x: gl.x, y: gl.y, radius: gl.radius, color: gl.color, intensity: gl.intensity, falloff: 1.3 }),
    }));
    this.lantern = { x: 0, y: 0, angle: this.player.angle, flicker: 1, power: 1 };

    this.particles = new Particles();
    this.marker = null;
    this.fadeIn = 0;

    // Kamera
    const s = game.screen;
    this.camX = this.player.x - s.width / 2;
    this.camY = this.player.y - s.height / 2;
    this.clampCamera();

    // Sahne tamponu (ışık için piksel okunacak)
    this.scene = document.createElement('canvas');
    this.sctx = this.scene.getContext('2d', { willReadFrequently: true });

    audio.startAmbience();
  }

  clampCamera() {
    const { width: w, height: h } = this.game.screen;
    const mw = this.map.pw, mh = this.map.ph;
    this.camX = mw <= w ? (mw - w) / 2 : Math.max(0, Math.min(mw - w, this.camX));
    this.camY = mh <= h ? (mh - h) / 2 : Math.max(0, Math.min(mh - h, this.camY));
  }

  handleTap(tap) {
    const wx = tap.x + Math.round(this.camX), wy = tap.y + Math.round(this.camY);
    const res = findPath(this.map, this.player.x, this.player.y, wx, wy);
    if (!res || !res.points.length) return;
    this.player.setPath(res.points);
    this.marker = { x: res.target.x, y: res.target.y, t: 0, exact: res.exact };
  }

  update(dt, taps) {
    this.t += dt;
    this.fadeIn = Math.min(1, this.fadeIn + dt / 1.5);
    for (const tap of taps) {
      if (this.game.hud.handleTap(tap)) continue;
      this.handleTap(tap);
    }

    const p = this.player;
    p.update(dt, this.map);

    // Kamera: madenciyi yumuşakça takip eder, baktığı yöne biraz önden bakar.
    const s = this.game.screen;
    const look = p.moving ? 18 : 8;
    const tx = p.x + Math.cos(p.angle) * look - s.width / 2;
    const ty = p.y - 10 + Math.sin(p.angle) * look - s.height / 2;
    const k = 1 - Math.exp(-4.5 * dt);
    this.camX += (tx - this.camX) * k;
    this.camY += (ty - this.camY) * k;
    this.clampCamera();

    // Fener
    const L = this.lantern;
    L.x = p.x;
    L.y = p.y - 3;
    L.angle = p.angle + Math.sin(this.t * 1.7) * 0.025 + (p.moving ? Math.sin(p.walkTime * 16) * 0.03 : 0);
    L.flicker = 0.97 + Math.sin(this.t * 23) * 0.01 + Math.random() * 0.02;

    // Meşale titremesi: rastgele hedefe yumuşak geçiş + iki dalga
    for (const tr of this.torches) {
      tr.timer -= dt;
      if (tr.timer <= 0) {
        tr.timer = 0.05 + Math.random() * 0.12;
        tr.target = 0.78 + Math.random() * 0.3;
      }
      tr.flick += (tr.target - tr.flick) * (1 - Math.exp(-18 * dt));
      tr.light.flicker = tr.flick + Math.sin(this.t * 7.1 + tr.phase) * 0.05;

      // Kıvılcım ve çıtırtı, sadece ekrana yakınsa
      const dx = tr.x - p.x, dy = tr.y - p.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 420) {
        tr.emberTimer -= dt;
        if (tr.emberTimer <= 0) {
          tr.emberTimer = 0.15 + Math.random() * 0.5;
          this.particles.spawnEmber(tr.x, tr.y - 5);
        }
        if (dist < 220 && Math.random() < dt * 1.6) audio.playTorchCrackle(Math.pow(1 - dist / 220, 1.5), dx / 220);
      }
    }
    for (const gl of this.glows) {
      if (gl.lamp) gl.light.flicker = 0.75 + Math.sin(this.t * 2.2) * 0.25;
    }

    this.particles.updateDust(dt, L, (x, y) => this.map.solidAt(x, y));
    this.particles.updateEmbers(dt);

    if (this.marker) {
      this.marker.t += dt;
      if (!p.path.length && this.marker.t > 0.2) this.marker.done = (this.marker.done || 0) + dt;
      if (this.marker.done > 0.5) this.marker = null;
    }
  }

  draw(ctx, w, h) {
    const sh = this.game;
    const camX = Math.round(this.camX) + sh.shakeX;
    const camY = Math.round(this.camY) + sh.shakeY;

    if (this.scene.width !== w || this.scene.height !== h) {
      this.scene.width = w;
      this.scene.height = h;
    }
    this.lighting.resize(w, h);
    const sc = this.sctx;
    sc.imageSmoothingEnabled = false;
    sc.fillStyle = '#000';
    sc.fillRect(0, 0, w, h);
    sc.drawImage(this.ground, -camX, -camY);
    this.player.draw(sc, camX, camY);
    sc.drawImage(this.over, -camX, -camY);

    if (NO_LIGHT) {
      ctx.drawImage(this.scene, 0, 0);
    } else {
      this.lighting.compute(camX, camY, this.lantern);
      const img = sc.getImageData(0, 0, w, h);
      this.lighting.apply(img, camX, camY);
      ctx.putImageData(img, 0, 0);
    }

    // --- Kendi ışığı olanlar ---
    const light = (x, y) => (NO_LIGHT ? 1 : this.lighting.sample(x, y));
    for (const tr of this.torches) drawFlame(ctx, tr.x - camX, tr.y - camY, this.t, tr.phase, tr.flick);
    this.particles.drawEmbers(ctx, camX, camY);
    this.particles.drawDust(ctx, camX, camY, light);
    for (const s of this.sparkles) {
      const v = Math.pow(Math.max(0, Math.sin(this.t * s.rate + s.phase)), 12);
      if (v < 0.08) continue;
      const x = s.x - camX, y = s.y - camY;
      ctx.fillStyle = s.color;
      ctx.globalAlpha = v;
      ctx.fillRect(x, y, 1, 1);
      if (v > 0.6) {
        ctx.globalAlpha = v * 0.5;
        ctx.fillRect(x - 1, y, 3, 1);
        ctx.fillRect(x, y - 1, 1, 3);
      }
    }
    ctx.globalAlpha = 1;
    // Cevher parıltıları: sadece ışık vurunca.
    for (const ore of this.map.ores) {
      for (const g of ore.glints || []) {
        const L = Math.min(1, light(g.x, g.y) * 1.3);
        const v = Math.pow(Math.max(0, Math.sin(this.t * g.rate + g.phase)), 10) * L;
        if (v < 0.1) continue;
        ctx.globalAlpha = v;
        ctx.fillStyle = '#fff6d8';
        ctx.fillRect(g.x - camX, g.y - camY, 1, 1);
      }
    }
    ctx.globalAlpha = 1;
    for (const gl of this.glows) {
      if (!gl.lamp) continue;
      const a = 0.55 + gl.light.flicker * 0.45;
      const lx = gl.x - camX - 1, ly = gl.y - camY;
      ctx.fillStyle = '#0c1a0e';
      ctx.fillRect(lx - 1, ly - 1, 4, 4);
      ctx.fillStyle = `rgba(120,255,140,${a.toFixed(2)})`;
      ctx.fillRect(lx, ly, 2, 2);
      ctx.fillStyle = `rgba(220,255,225,${(a * 0.8).toFixed(2)})`;
      ctx.fillRect(lx, ly, 1, 1);
    }

    this.drawPathMarker(ctx, camX, camY);

    // Bölüm adı
    const bt = this.t;
    if (bt < 5) {
      const a = Math.min(1, bt / 1, (5 - bt) / 1.2);
      ctx.globalAlpha = Math.max(0, a);
      drawText(ctx, this.level.name, Math.floor(w / 2), Math.floor(h * 0.18), { color: '#cdbb98', size: 2, align: 'center', shadow: '#000' });
      ctx.globalAlpha = 1;
    }

    if (this.fadeIn < 1) {
      ctx.fillStyle = `rgba(0,0,0,${(1 - this.fadeIn).toFixed(2)})`;
      ctx.fillRect(0, 0, w, h);
    }

    if (DEBUG) {
      drawText(ctx, `${Math.round(this.player.x)},${Math.round(this.player.y)}`, 4, h - 26, { color: '#7f7', shadow: '#000' });
    }
  }

  /** Hedefte küçük bir işaret ve yol boyunca silik noktalar. */
  drawPathMarker(ctx, camX, camY) {
    const m = this.marker;
    if (!m) return;
    const fade = m.done ? Math.max(0, 1 - m.done / 0.5) : 1;
    const p = this.player;
    // yol noktaları
    if (p.path.length) {
      ctx.fillStyle = 'rgba(232,197,96,0.32)';
      let ax = p.x, ay = p.y;
      let carry = 6;
      for (const q of p.path) {
        const dx = q.x - ax, dy = q.y - ay;
        const len = Math.hypot(dx, dy);
        let s = carry;
        while (s < len) {
          ctx.fillRect(Math.round(ax + (dx * s) / len - camX), Math.round(ay + (dy * s) / len - camY), 1, 1);
          s += 7;
        }
        carry = s - len;
        ax = q.x;
        ay = q.y;
      }
    }
    // hedef işareti: ilk anda büyük, sonra küçük ve nabız gibi atan elmas
    const pop = Math.max(0, 1 - m.t / 0.25);
    const r = Math.round(3 + pop * 4 + (m.t > 0.25 ? Math.sin(m.t * 6) * 0.6 : 0));
    const x = Math.round(m.x - camX), y = Math.round(m.y - camY);
    ctx.globalAlpha = 0.85 * fade;
    ctx.fillStyle = m.exact ? '#e8c560' : '#c98a5a';
    for (let i = -r; i <= r; i++) {
      const j = r - Math.abs(i);
      ctx.fillRect(x + i, y - j, 1, 1);
      ctx.fillRect(x + i, y + j, 1, 1);
    }
    ctx.fillRect(x, y, 1, 1);
    ctx.globalAlpha = 1;
  }
}

/** Pixel art meşale alevi. f: titreme (0.8..1.1) */
function drawFlame(ctx, x, y, t, phase, f) {
  x = Math.round(x);
  y = Math.round(y);
  const hgt = Math.round(6 + f * 3);
  const sway = Math.round(Math.sin(t * 9 + phase) * 1.2);
  const cols = ['#a8341a', '#ef7d22', '#ffc94a', '#fff2b8'];
  for (let i = 0; i < hgt; i++) {
    const k = i / hgt; // 0 alt, 1 tepe
    const half = k < 0.35 ? 2 : k < 0.7 ? 1 : 0;
    const sx = x + Math.round(sway * k);
    const yy = y - i;
    ctx.fillStyle = cols[0];
    ctx.fillRect(sx - half - 1, yy, half * 2 + 2, 1);
    if (k < 0.85) {
      ctx.fillStyle = cols[1];
      ctx.fillRect(sx - half, yy, half * 2 + (half ? 1 : 1), 1);
    }
    if (k < 0.55) {
      ctx.fillStyle = cols[2];
      ctx.fillRect(sx - Math.max(0, half - 1), yy, Math.max(1, half * 2 - 1), 1);
    }
    if (k < 0.25) {
      ctx.fillStyle = cols[3];
      ctx.fillRect(sx, yy, 1, 1);
    }
  }
  // tepedeki kopan alev parçası
  if (Math.sin(t * 13 + phase) > 0.3) {
    ctx.fillStyle = cols[1];
    ctx.fillRect(x + sway, y - hgt - 1, 1, 1);
  }
}
