// Oyun sahnesi: harita, madenci, kamera, ışık ve atmosfer.
//
// Çizim sırası (her kare):
//   1) Ekran dışı "sahne" canvas'ına: zemin katmanı, nesneler ve madenci
//      (y'ye göre sıralı), tavan katmanı
//   2) Sahne pikselleri ışıkla çarpılır (ortam ışığı, lambalar, meşaleler)
//   3) Ana canvas'a kendi ışığı olanlar eklenir: alevler, kıvılcımlar,
//      kristal parıltıları, toz, tıklama işareti, mesajlar

import { DEBUG, TILE } from '../config.js';
import { LEVELS } from '../levels.js';
import { TileMap } from '../map.js';
import { bakeMap } from '../mapRender.js';
import { Lighting, TORCH, LAMP, HAND_TORCH, SELF_GLOW } from '../lighting.js';
import { Player } from '../player.js';
import { findPath } from '../pathfinding.js';
import { Particles } from '../particles.js';
import { drawText, textWidth } from '../font.js';
import * as audio from '../audio.js';

const NO_LIGHT = new URLSearchParams(location.search).has('nolight');

export class PlayScene {
  constructor(game, levelIndex = 0) {
    this.game = game;
    this.levelIndex = levelIndex;
    this.t = 0;
    this.level = LEVELS[levelIndex];
    this.map = new TileMap(this.level);
    const baked = bakeMap(this.map);
    this.ground = baked.ground;
    this.over = baked.over;
    this.sparkles = baked.sparkles;

    this.player = new Player(this.map.start.x, this.map.start.y);
    this.player.onStep = () => audio.playStep(false);

    // ---- Işıklar ----
    const L = (this.lighting = new Lighting(this.map));
    // Duvar lambaları: sabit, ortam ışığına gömülür.
    this.lamps = [];
    for (const lp of this.map.lamps) {
      const x = lp.tx * TILE + 16;
      if (lp.lit) {
        L.addBaked({ x, y: lp.ty * TILE + 20, ox: x, oy: (lp.ty + 1) * TILE + 2, ...LAMP });
        this.lamps.push({ x, y: lp.ty * TILE + 13, phase: Math.random() * 10 });
      }
    }
    // Duvar meşaleleri: titrer.
    this.torches = this.map.torches.map((t) => {
      const x = t.tx * TILE + 16, y = t.ty * TILE + 9;
      const light = L.addStatic({ x, y: y + 6, ox: x, oy: (t.ty + 1) * TILE + 2, ...TORCH });
      return { x, y, light, ...flickerState() };
    });
    // Meşale standları: üstündeki meşale alınabilir.
    this.stands = this.map.stands.map((st) => {
      const x = st.tx * TILE + 16, y = st.ty * TILE + 3;
      const light = L.addStatic({ x, y: y + 8, ox: x, oy: st.ty * TILE + 30, radius: 110, color: TORCH.color, intensity: 0.95 });
      return { tx: st.tx, ty: st.ty, x, y, hasTorch: true, light, ...flickerState() };
    });
    this.glows = baked.glows.map((gl) => ({
      ...gl,
      light: L.addStatic({ x: gl.x, y: gl.y, radius: gl.radius, color: gl.color, intensity: gl.intensity, falloff: 1.3 }),
    }));
    this.handTorch = { x: 0, y: 0, ...HAND_TORCH, intensity: 0, ...flickerState() };
    this.selfGlow = { x: 0, y: 0, ...SELF_GLOW };

    // ---- Etkileşim: dokunulabilen nesneler ----
    this.targets = [];
    for (const st of this.stands) {
      this.targets.push({
        kind: 'stand',
        obj: st,
        x: st.x,
        y: st.ty * TILE + 18,
        box: { x0: st.tx * TILE - 4, y0: st.ty * TILE - 14, x1: (st.tx + 1) * TILE + 4, y1: (st.ty + 1) * TILE + 4 },
        reach: 34,
        act: () => this.takeTorch(st),
      });
    }
    this.pending = null;

    this.particles = new Particles();
    this.marker = null;
    this.toasts = [];
    this.darkHintCooldown = 0;
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

  /**
   * Haritadaki görünür ışık kaynakları. Gromm'un "görme" özelliği bunları
   * kullanacak: ışığın içinde duran madenci uzaktan fark edilir.
   * kind: 'lamp' | 'torch' | 'stand' | 'hand'
   */
  lightSources() {
    const out = [];
    for (const lp of this.lamps) out.push({ kind: 'lamp', x: lp.x, y: lp.y, radius: LAMP.radius });
    for (const t of this.torches) out.push({ kind: 'torch', x: t.x, y: t.y, radius: TORCH.radius });
    for (const s of this.stands) if (s.hasTorch) out.push({ kind: 'stand', x: s.x, y: s.y, radius: 110 });
    if (this.player.hasTorch) {
      const tip = this.player.torchTip();
      out.push({ kind: 'hand', x: tip.x, y: tip.y, radius: HAND_TORCH.radius });
    }
    return out;
  }

  toast(text, dur = 2.8) {
    this.toasts = this.toasts.filter((t) => t.text !== text);
    this.toasts.push({ text, t: 0, dur });
  }

  takeTorch(st) {
    if (!st.hasTorch) return;
    if (this.player.hasTorch) {
      this.toast('Elinde zaten bir meşale var.');
      return;
    }
    st.hasTorch = false;
    st.light.flicker = 0;
    this.player.hasTorch = true;
    audio.playTorchPickup();
    this.toast('Meşaleyi aldın.');
    for (let k = 0; k < 8; k++) this.particles.spawnEmber(st.x, st.y);
  }

  clampCamera() {
    const { width: w, height: h } = this.game.screen;
    const mw = this.map.pw, mh = this.map.ph;
    this.camX = mw <= w ? (mw - w) / 2 : Math.max(0, Math.min(mw - w, this.camX));
    this.camY = mh <= h ? (mh - h) / 2 : Math.max(0, Math.min(mh - h, this.camY));
  }

  handleTap(tap) {
    const wx = tap.x + Math.round(this.camX), wy = tap.y + Math.round(this.camY);
    // Önce dokunulabilen bir nesneye mi dokunuldu?
    const target = this.targets.find((tg) => !tg.disabled && wx >= tg.box.x0 && wx <= tg.box.x1 && wy >= tg.box.y0 && wy <= tg.box.y1);
    if (target) {
      if (Math.hypot(this.player.x - target.x, this.player.y - target.y) <= target.reach) {
        this.player.stop();
        this.pending = null;
        target.act();
        return;
      }
      const res = findPath(this.map, this.player.x, this.player.y, target.x, target.y);
      if (!res) return;
      this.player.setPath(res.points);
      this.pending = target;
      this.marker = { x: target.x, y: target.y, t: 0, exact: true };
      return;
    }
    const res = findPath(this.map, this.player.x, this.player.y, wx, wy);
    if (!res || !res.points.length) return;
    this.player.setPath(res.points);
    this.pending = null;
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

    // Varınca bekleyen işi yap
    if (this.pending && !p.path.length) {
      const tg = this.pending;
      this.pending = null;
      if (Math.hypot(p.x - tg.x, p.y - tg.y) <= tg.reach + 6) tg.act();
    }

    // Kamera: madenciyi yumuşakça takip eder.
    const s = this.game.screen;
    const look = p.moving ? 16 : 0;
    const tx = p.x + Math.cos(p.angle) * look - s.width / 2;
    const ty = p.y - 12 + Math.sin(p.angle) * look - s.height / 2;
    const k = 1 - Math.exp(-4.5 * dt);
    this.camX += (tx - this.camX) * k;
    this.camY += (ty - this.camY) * k;
    this.clampCamera();

    // Işık titremeleri
    for (const tr of this.torches) tr.light.flicker = stepFlicker(tr, dt, this.t);
    for (const st of this.stands) {
      const f = stepFlicker(st, dt, this.t);
      st.light.flicker = st.hasTorch ? f : 0;
    }
    for (const gl of this.glows) if (gl.lamp) gl.light.flicker = 0.75 + Math.sin(this.t * 2.2) * 0.25;
    const ht = this.handTorch;
    const hf = stepFlicker(ht, dt, this.t);
    const tip = p.torchTip();
    ht.x = tip.x;
    ht.y = p.y - 4;
    ht.intensity = p.hasTorch ? HAND_TORCH.intensity * hf : 0;
    ht.radius = HAND_TORCH.radius * (0.96 + hf * 0.04);
    this.selfGlow.x = p.x;
    this.selfGlow.y = p.y - 6;

    // Kıvılcımlar ve çıtırtı
    const flames = [...this.torches, ...this.stands.filter((st) => st.hasTorch)];
    for (const tr of flames) {
      const dx = tr.x - p.x, dy = tr.y - p.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 420) continue;
      tr.emberTimer -= dt;
      if (tr.emberTimer <= 0) {
        tr.emberTimer = 0.15 + Math.random() * 0.5;
        this.particles.spawnEmber(tr.x, tr.y - 5);
      }
      if (dist < 220 && Math.random() < dt * 1.6) audio.playTorchCrackle(Math.pow(1 - dist / 220, 1.5), dx / 220);
    }
    if (p.hasTorch) {
      ht.emberTimer -= dt;
      if (ht.emberTimer <= 0) {
        ht.emberTimer = 0.1 + Math.random() * 0.35;
        this.particles.spawnEmber(tip.x, tip.y - 4);
      }
      if (Math.random() < dt * 1.2) audio.playTorchCrackle(0.35, 0);
    }

    // Karanlık bölge ipucu
    this.darkHintCooldown -= dt;
    if (!p.hasTorch && this.lighting.darkAt(p.x, p.y) > 0.6 && this.darkHintCooldown <= 0) {
      this.toast('Zifiri karanlık... Girişteki standdan meşale al.', 3.5);
      this.darkHintCooldown = 10;
    }

    this.particles.updateDust(dt, p, (x, y) => this.map.solidAt(x, y));
    this.particles.updateEmbers(dt);

    if (this.marker) {
      this.marker.t += dt;
      if (!p.path.length && this.marker.t > 0.2) this.marker.done = (this.marker.done || 0) + dt;
      if (this.marker.done > 0.5) this.marker = null;
    }
    for (const t of this.toasts) t.t += dt;
    this.toasts = this.toasts.filter((t) => t.t < t.dur);
  }

  /** Işıktan önce çizilen, y'ye göre sıralanan nesneler. */
  drawEntities(sc, camX, camY) {
    const list = [];
    for (const st of this.stands) {
      if (!st.hasTorch) continue;
      list.push({ y: st.ty * TILE + 28, draw: () => drawStandTorch(sc, st.x - camX, st.y - camY) });
    }
    list.push({ y: this.player.y, draw: () => this.player.draw(sc, camX, camY) });
    list.sort((a, b) => a.y - b.y);
    for (const e of list) e.draw();
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
    this.drawEntities(sc, camX, camY);
    sc.drawImage(this.over, -camX, -camY);

    if (NO_LIGHT) {
      ctx.drawImage(this.scene, 0, 0);
    } else {
      this.lighting.compute(camX, camY, [this.selfGlow, this.handTorch]);
      const img = sc.getImageData(0, 0, w, h);
      this.lighting.apply(img, camX, camY);
      ctx.putImageData(img, 0, 0);
    }

    this.drawEmissive(ctx, camX, camY, w, h);
    this.drawPathMarker(ctx, camX, camY);
    this.drawOverlay(ctx, w, h);

    if (this.fadeIn < 1) {
      ctx.fillStyle = `rgba(0,0,0,${(1 - this.fadeIn).toFixed(2)})`;
      ctx.fillRect(0, 0, w, h);
    }
    if (DEBUG) {
      drawText(ctx, `${Math.round(this.player.x)},${Math.round(this.player.y)}`, 4, h - 26, { color: '#7f7', shadow: '#000' });
    }
  }

  /** Kendi ışığı olan her şey (ışık hesabından sonra, tam parlaklıkta). */
  drawEmissive(ctx, camX, camY, w, h) {
    const light = (x, y) => (NO_LIGHT ? 1 : this.lighting.sample(x, y));
    const onScreen = (x, y, m = 40) => x > camX - m && y > camY - m && x < camX + w + m && y < camY + h + m;
    for (const tr of this.torches) if (onScreen(tr.x, tr.y)) drawFlame(ctx, tr.x - camX, tr.y - camY, this.t, tr.phase, tr.flick, 1);
    for (const st of this.stands) if (st.hasTorch && onScreen(st.x, st.y)) drawFlame(ctx, st.x - camX, st.y - camY, this.t, st.phase, st.flick, 1);
    if (this.player.hasTorch) {
      const tip = this.player.torchTip();
      drawFlame(ctx, tip.x - camX, tip.y - camY, this.t, this.handTorch.phase, this.handTorch.flick, 0.85);
    }
    // Lamba camları
    for (const lp of this.lamps) {
      if (!onScreen(lp.x, lp.y)) continue;
      const x = Math.round(lp.x - camX), y = Math.round(lp.y - camY);
      const a = 0.85 + Math.sin(this.t * 3 + lp.phase) * 0.05;
      ctx.globalAlpha = a;
      ctx.fillStyle = '#ffcf6a';
      ctx.fillRect(x - 3, y, 7, 7);
      ctx.fillStyle = '#fff3cc';
      ctx.fillRect(x - 1, y + 2, 3, 3);
      ctx.fillStyle = '#1a120a';
      ctx.fillRect(x - 1, y, 1, 7);
      ctx.fillRect(x + 1, y, 1, 7);
      ctx.globalAlpha = 1;
    }
    this.particles.drawEmbers(ctx, camX, camY);
    this.particles.drawDust(ctx, camX, camY, light);
    for (const s of this.sparkles) {
      if (!onScreen(s.x, s.y)) continue;
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
    for (const ore of this.map.ores) {
      for (const g of ore.glints || []) {
        if (!onScreen(g.x, g.y)) continue;
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
  }

  /** Bölüm adı ve mesajlar. */
  drawOverlay(ctx, w, h) {
    const bt = this.t;
    if (bt < 5) {
      const a = Math.min(1, bt / 1, (5 - bt) / 1.2);
      ctx.globalAlpha = Math.max(0, a);
      drawText(ctx, this.level.name, Math.floor(w / 2), Math.floor(h * 0.18), { color: '#cdbb98', size: 2, align: 'center', shadow: '#000' });
      ctx.globalAlpha = 1;
    }
    let y = h - 22;
    for (let i = this.toasts.length - 1; i >= 0; i--) {
      const t = this.toasts[i];
      const a = Math.min(1, t.t / 0.25, (t.dur - t.t) / 0.5);
      ctx.globalAlpha = Math.max(0, a);
      const tw = textWidth(t.text);
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(Math.floor(w / 2 - tw / 2) - 4, y - 2, tw + 8, 13);
      drawText(ctx, t.text, Math.floor(w / 2), y, { color: '#e6d2a8', align: 'center' });
      ctx.globalAlpha = 1;
      y -= 16;
    }
  }

  /** Hedefte küçük bir işaret ve yol boyunca silik noktalar. */
  drawPathMarker(ctx, camX, camY) {
    const m = this.marker;
    if (!m) return;
    const fade = m.done ? Math.max(0, 1 - m.done / 0.5) : 1;
    const p = this.player;
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

/** Alev titremesi için durum: rastgele hedefe yumuşak geçiş. */
function flickerState() {
  return { phase: Math.random() * 100, flick: 1, target: 1, timer: 0, emberTimer: Math.random() };
}

function stepFlicker(s, dt, t) {
  s.timer -= dt;
  if (s.timer <= 0) {
    s.timer = 0.05 + Math.random() * 0.12;
    s.target = 0.78 + Math.random() * 0.3;
  }
  s.flick += (s.target - s.flick) * (1 - Math.exp(-18 * dt));
  return s.flick + Math.sin(t * 7.1 + s.phase) * 0.05;
}

/** Standdaki meşalenin sapı (ışıktan önce çizilir). */
function drawStandTorch(ctx, x, y) {
  x = Math.round(x);
  y = Math.round(y);
  ctx.fillStyle = '#1a0f08';
  ctx.fillRect(x - 2, y + 1, 4, 10);
  ctx.fillStyle = '#7a5230';
  ctx.fillRect(x - 1, y + 1, 2, 9);
  ctx.fillStyle = '#2a1408';
  ctx.fillRect(x - 2, y, 4, 2);
}

/** Pixel art meşale alevi. f: titreme (0.8..1.1), s: boyut katsayısı */
export function drawFlame(ctx, x, y, t, phase, f, s = 1) {
  x = Math.round(x);
  y = Math.round(y);
  const hgt = Math.max(3, Math.round((6 + f * 3) * s));
  const sway = Math.round(Math.sin(t * 9 + phase) * 1.2);
  const cols = ['#a8341a', '#ef7d22', '#ffc94a', '#fff2b8'];
  for (let i = 0; i < hgt; i++) {
    const k = i / hgt;
    const half = k < 0.35 ? 2 : k < 0.7 ? 1 : 0;
    const sx = x + Math.round(sway * k);
    const yy = y - i;
    ctx.fillStyle = cols[0];
    ctx.fillRect(sx - half - 1, yy, half * 2 + 2, 1);
    if (k < 0.85) {
      ctx.fillStyle = cols[1];
      ctx.fillRect(sx - half, yy, half * 2 + 1, 1);
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
  if (Math.sin(t * 13 + phase) > 0.3) {
    ctx.fillStyle = cols[1];
    ctx.fillRect(x + sway, y - hgt - 1, 1, 1);
  }
}
