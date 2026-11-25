// Oyun sahnesi: harita, madenci, kamera, ışık ve atmosfer.
//
// Çizim sırası (her kare):
//   1) Ekran dışı "sahne" canvas'ına: zemin katmanı, nesneler ve madenci
//      (y'ye göre sıralı), tavan katmanı
//   2) Sahne pikselleri ışıkla çarpılır (ortam ışığı, lambalar, meşaleler)
//   3) Ana canvas'a kendi ışığı olanlar eklenir: alevler, kıvılcımlar,
//      kristal parıltıları, toz, tıklama işareti, mesajlar

import { DEBUG, TILE, NOISE, MAX_CARRY } from '../config.js';
import { LEVELS } from '../levels.js';
import { TileMap } from '../map.js';
import { bakeMap, drawRubble } from '../mapRender.js';
import { Ore } from '../ore.js';
import { Gromm, GROMM } from '../gromm.js';
import { drawJumpscare, JUMPSCARE } from '../jumpscare.js';
import * as settings from '../settings.js';
import { images, FX } from '../assets.js';
import { makeRng } from '../rng.js';
import { CompleteScene } from './complete.js';
import { Lighting, TORCH, LAMP, HAND_TORCH, SELF_GLOW } from '../lighting.js';
import { Player } from '../player.js';
import { findPath } from '../pathfinding.js';
import { Particles } from '../particles.js';
import { drawText, textWidth } from '../font.js';
import { Button } from '../ui.js';
import * as audio from '../audio.js';

const NO_LIGHT = new URLSearchParams(location.search).has('nolight');

/**
 * Harita çizimi pahalı (~0.3 sn), bölüm başına bir kere yapılır. Yeniden
 * başlarken zemin katmanının temiz bir kopyası alınır (kırılan cevherler
 * zemine döküntü çizdiği için).
 */
const bakeCache = new Map();
function bakedLevel(levelIndex, map) {
  let b = bakeCache.get(levelIndex);
  if (!b) {
    b = bakeMap(map);
    bakeCache.set(levelIndex, b);
  }
  const ground = document.createElement('canvas');
  ground.width = b.ground.width;
  ground.height = b.ground.height;
  ground.getContext('2d').drawImage(b.ground, 0, 0);
  return { ...b, ground };
}

export class PlayScene {
  constructor(game, levelIndex = 0) {
    this.game = game;
    this.levelIndex = levelIndex;
    this.t = 0;
    this.level = LEVELS[levelIndex];
    this.map = new TileMap(this.level);
    const baked = bakedLevel(levelIndex, this.map);
    this.ground = baked.ground;
    this.over = baked.over;
    this.sparkles = baked.sparkles;

    this.player = new Player(this.map.start.x, this.map.start.y);
    this.player.onStep = (run) => {
      audio.playStep(run);
      const p = this.player;
      this.emitNoise(p.x, p.y, run ? NOISE.run : NOISE.walk);
      if (run) this.particles.spawnPuff(p.x, p.y, 2, 6);
    };
    this.player.onExhausted = () => {
      audio.playBreath();
      this.toast('Nefesin kesildi!', 1.8);
    };
    // Sprint butonu (sağ alt, aç/kapa)
    this.sprintButton = new Button({
      icon: 'sprint',
      onTap: () => {
        if (this.player.dead || this.ending) return;
        if (!this.player.toggleSprint()) audio.playBreath(0.5);
        else audio.playUiTap();
      },
    });
    this.staminaAlpha = 0;

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
    this.glows = baked.glows
      .filter((gl) => !gl.lamp)
      .map((gl) => ({
        ...gl,
        light: L.addStatic({ x: gl.x, y: gl.y, radius: gl.radius, color: gl.color, intensity: gl.intensity, falloff: 1.3 }),
      }));
    // Cevherler: kendi hafif ışıkları var (karanlık bölgede sönük)
    const rng = makeRng(this.level.seed + 99);
    this.ores = this.map.ores.map((def) => {
      const ore = new Ore(def, rng);
      ore.light = L.addStatic({ x: ore.x, y: ore.y - 4, radius: 56, color: ore.type.light, intensity: 0.62, falloff: 1.4 });
      return ore;
    });
    // Asansör: lamba kırmızı (yük eksik) / yeşil (hazır)
    const e = this.map.elevator;
    this.elevator = {
      x0: e.tx * TILE, y0: e.ty * TILE, x1: (e.tx + e.tw) * TILE, y1: (e.ty + e.th) * TILE,
      loaded: [], required: this.level.ores, ready: false, loading: null,
    };
    const el = this.elevator;
    el.lampX = el.x1 - 2;
    el.lampY = el.y1 - 40;
    el.redLight = L.addStatic({ x: el.lampX, y: el.lampY, radius: 40, color: [1.0, 0.2, 0.15], intensity: 0.6, falloff: 1.3 });
    el.greenLight = L.addStatic({ x: el.lampX, y: el.lampY, radius: 70, color: [0.35, 1.0, 0.45], intensity: 0.8, falloff: 1.3 });
    el.greenLight.flicker = 0;
    /** Gromm'un "duyma" özelliği için son sesler: { x, y, r, t } */
    this.noises = [];
    this.ending = null;
    this.caught = null;
    this.stats = { time: 0 };

    // Gromm
    const gs = this.map.grommStart || { x: this.map.pw / 2, y: this.map.ph / 2 };
    this.gromm = new Gromm(gs.x, gs.y);
    this.gromm.onStomp = (x, y, side) => this.grommStomp(x, y, side);
    this.gromm.onSpot = () => {
      const p = this.player;
      audio.playGrowl(Math.hypot(this.gromm.x - p.x, this.gromm.y - p.y), panOf(this.gromm.x - p.x));
    };
    /** Gromm'un bıraktığı, zamanla kaybolan çatlak ve pençe izleri */
    this.decals = [];
    this.heartTimer = 0;
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
    for (const ore of this.ores) {
      this.targets.push({
        kind: 'ore',
        obj: ore,
        x: ore.x,
        y: ore.y,
        box: { x0: ore.x0 - 4, y0: ore.y0 + 2, x1: ore.x0 + 36, y1: ore.y0 + 42 },
        reach: 36,
        act: () => this.startDigging(ore),
      });
    }
    this.targets.push({
      kind: 'elevator',
      x: (el.x0 + el.x1) / 2,
      y: el.y0 + 40,
      box: { x0: el.x0 - 4, y0: el.y0 - TILE, x1: el.x1 + 4, y1: el.y1 + 6 },
      canAct: () => this.inElevator(),
      act: () => this.useElevator(),
    });
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

  /** Gromm'un ileride duyabileceği bir ses olayı. */
  emitNoise(x, y, r) {
    this.noises.push({ x, y, r, t: 0 });
  }

  // ---------------- Gromm ----------------

  /** Gromm'un eli/ayağı yere değdi: ses, sarsıntı, toz, iz. */
  grommStomp(x, y, side) {
    const p = this.player;
    const d = Math.hypot(x - p.x, y - p.y);
    audio.playThud(d, panOf(x - p.x));
    const amt = 3.2 * Math.pow(Math.max(0, 1 - d / 470), 1.6);
    if (amt > 0.25) this.game.shake(amt, 0.14);
    const fx = x + side * 11, fy = y - 1;
    this.particles.spawnPuff(fx, fy, 5, 16);
    this.decals.push({ x: fx, y: fy, t: 0, seed: Math.random() * 1000, hand: Math.random() < 0.5 });
    if (this.decals.length > 40) this.decals.shift();
    if (d < 270) {
      // tavandan çakıl düşer, meşaleler titrer
      const n = 1 + Math.floor(Math.random() * 3);
      for (let k = 0; k < n; k++) {
        const px = p.x + (Math.random() - 0.5) * 140, py = p.y + (Math.random() - 0.5) * 90;
        if (!this.map.solidAt(px, py)) this.particles.spawnFalling(px, py);
      }
      for (const tr of [...this.torches, ...this.stands, this.handTorch]) {
        if (Math.hypot(tr.x - x, tr.y - y) < 320) tr.flick *= 0.55;
      }
    }
  }

  /**
   * Gromm yakaladı. Oyun donar; ayarlarda jumpscare açıksa yüz ve çığlık,
   * kapalıysa sadece kararma ve yazı. Sonra bölüm baştan başlar.
   */
  onCaught() {
    const scare = settings.get('jumpscare');
    this.caught = {
      t: 0,
      scare,
      screamed: false,
      // yazı ve yeniden başlama zamanları
      textAt: scare ? JUMPSCARE.end : 0.6,
      restartAt: scare ? JUMPSCARE.end + 1.5 : 2.2,
    };
    this.player.setDead();
    this.gromm.attack(this.player);
    this.pending = null;
    this.marker = null;
  }

  /** Yakalandıktan sonra: dünya donmuş, sadece zaman ilerler. */
  updateCaught(dt) {
    const c = this.caught;
    c.t += dt;
    if (c.scare && !c.screamed && c.t >= JUMPSCARE.freeze) {
      c.screamed = true;
      audio.playScream();
    }
    if (c.t > c.restartAt) this.game.startPlay(this.levelIndex);
  }

  /** Jumpscare yüzü ekrandayken ses/ayar butonları gizlenir. */
  get hideHud() {
    const c = this.caught;
    return !!c && c.scare && c.t < JUMPSCARE.end;
  }

  updateGromm(dt) {
    const g = this.gromm, p = this.player;
    if (this.ending) return;
    g.update(dt, this.map, p);
    const d = Math.hypot(g.x - p.x, g.y - p.y);
    if (d < GROMM.catchRange && !p.dead) {
      this.onCaught();
      return;
    }
    // Kalp atışı: Gromm yaklaştıkça hızlanır
    let close = Math.max(0, 1 - d / (10 * TILE));
    if (g.state === 'chase') close = Math.max(close, 0.45);
    this.heartTimer -= dt;
    if (close > 0 && this.heartTimer <= 0) {
      audio.playHeartbeat(0.2 + 0.8 * close);
      this.heartTimer = 1.15 - 0.7 * close;
    }
    for (const dc of this.decals) dc.t += dt;
    this.decals = this.decals.filter((dc) => dc.t < 8);
  }

  /** Gromm'un izleri (ışıktan önce çizilir). */
  drawDecals(sc, camX, camY) {
    for (const dc of this.decals) {
      const a = Math.min(1, (8 - dc.t) / 3) * 0.75;
      if (a <= 0) continue;
      const x = Math.round(dc.x - camX), y = Math.round(dc.y - camY);
      if (x < -20 || y < -20 || x > this.scene.width + 20 || y > this.scene.height + 20) continue;
      let s = dc.seed;
      const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
      sc.fillStyle = `rgba(8,5,6,${a.toFixed(2)})`;
      // çatlaklar
      for (let k = 0; k < 4; k++) {
        const ang = rnd() * Math.PI * 2;
        let px = x, py = y;
        const len = 4 + Math.floor(rnd() * 6);
        for (let i = 0; i < len; i++) {
          px += Math.cos(ang + (rnd() - 0.5)) * 1.2;
          py += Math.sin(ang + (rnd() - 0.5)) * 0.8;
          sc.fillRect(Math.round(px), Math.round(py), 1, 1);
        }
      }
      if (dc.hand) {
        // üç pençe izi
        for (let k = -1; k <= 1; k++) sc.fillRect(x + k * 3, y - 4, 1, 3);
        sc.fillRect(x - 3, y - 1, 7, 2);
      }
    }
  }

  // ---------------- Cevher ----------------

  /** Elinde zaten cevher varsa yenisini kazamaz. */
  carryFull() {
    if (this.player.carried < MAX_CARRY) return false;
    this.toast('Önce bunu asansöre götür.', 2.2);
    audio.playUiTap();
    return true;
  }

  startDigging(ore) {
    if (ore.broken) return;
    const p = this.player;
    if (p.dig) return;
    if (this.carryFull()) return;
    p.startDig(ore.x, ore.y - 4, () => this.onDigHit(ore));
  }

  onDigHit(ore) {
    const p = this.player;
    if (ore.broken) {
      p.stopDig();
      return;
    }
    // Kazmanın taşa değdiği nokta: cevherin madenciye bakan yüzü
    const cx = ore.x + Math.max(-9, Math.min(9, (p.x - ore.x) * 0.45));
    const cy = ore.y - 6 + Math.max(-6, Math.min(4, (p.y - ore.y) * 0.3));
    this.particles.spawnSpark(cx, cy);
    const col = { gold: [255, 208, 74], crystal: [127, 216, 255], ruby: [255, 90, 110] }[ore.kind];
    this.particles.spawnDebris(cx, cy + 6, 6, [[92, 86, 84], [66, 61, 62], col]);
    audio.playPickHit();
    this.emitNoise(ore.x, ore.y, NOISE.dig);
    this.game.shake(1, 0.08);
    if (ore.hit()) this.breakOre(ore);
  }

  breakOre(ore) {
    const p = this.player;
    p.stopDig();
    this.map.setSolid(ore.tx, ore.ty, false);
    ore.light.flicker = 0;
    const tg = this.targets.find((t) => t.obj === ore);
    if (tg) tg.disabled = true;
    drawRubble(this.ground.getContext('2d'), ore.x, ore.y + 6, makeRng(ore.tx * 31 + ore.ty));
    const col = { gold: [255, 208, 74], crystal: [127, 216, 255], ruby: [255, 90, 110] }[ore.kind];
    this.particles.spawnDebris(ore.x, ore.y, 16, [[92, 86, 84], [118, 110, 104], col], 1.4);
    this.particles.spawnPuff(ore.x, ore.y + 6, 8, 18);
    this.game.shake(2, 0.15);
    audio.playOreBreak();
    setTimeout(() => audio.playOrePickup(ore.kind), 120);
    p.cargo.push(ore.kind);
    this.toast(`+1 ${ore.type.name}. Asansöre götür!`);
  }

  // ---------------- Asansör ----------------

  inElevator() {
    const el = this.elevator, p = this.player;
    return p.x > el.x0 + 3 && p.x < el.x1 - 3 && p.y > el.y0 + 4 && p.y < el.y1 + 2;
  }

  useElevator() {
    const el = this.elevator, p = this.player;
    if (this.ending || el.loading) return;
    if (p.carried > 0) {
      el.loading = { timer: 0.15 };
      return;
    }
    if (el.ready) this.ride();
    else this.toast(`Asansöre ${el.required} cevher yüklemelisin (${el.loaded.length}/${el.required}).`, 3);
  }

  updateElevator(dt) {
    const el = this.elevator, p = this.player;
    if (el.loading) {
      if (!this.inElevator()) {
        el.loading = null;
      } else if ((el.loading.timer -= dt) <= 0) {
        if (p.carried > 0) {
          const kind = p.cargo.pop();
          el.loaded.push(kind);
          audio.playLoad();
          const col = { gold: [255, 208, 74], crystal: [127, 216, 255], ruby: [255, 90, 110] }[kind];
          this.particles.spawnDebris((el.x0 + el.x1) / 2, el.y0 + 34, 4, [col, [92, 86, 84]], 0.6);
          el.loading.timer = 0.35;
        } else {
          el.loading = null;
          if (!el.ready && el.loaded.length >= el.required) {
            el.ready = true;
            audio.playElevatorReady();
            this.toast('Asansör hazır! Binmek için asansöre dokun.', 4.5);
          } else if (!el.ready) {
            this.toast(`Asansör: ${el.loaded.length}/${el.required}`);
          }
        }
      }
    }
    // Lamba: kırmızı yanıp söner, hazırken sabit yeşil
    el.redLight.flicker = el.ready ? 0 : 0.55 + 0.45 * Math.max(0, Math.sin(this.t * 3));
    el.greenLight.flicker = el.ready ? 0.9 + Math.sin(this.t * 2) * 0.1 : 0;
  }

  ride() {
    const el = this.elevator;
    this.ending = { t: 0 };
    this.player.stop();
    this.player.x = (el.x0 + el.x1) / 2;
    this.player.dir = 'down';
    audio.playElevatorRide();
    this.game.shake(1.5, 2.2);
  }

  clampCamera() {
    const { width: w, height: h } = this.game.screen;
    const mw = this.map.pw, mh = this.map.ph;
    this.camX = mw <= w ? (mw - w) / 2 : Math.max(0, Math.min(mw - w, this.camX));
    this.camY = mh <= h ? (mh - h) / 2 : Math.max(0, Math.min(mh - h, this.camY));
  }

  handleTap(tap) {
    if (this.ending || this.player.dead) return;
    const wx = tap.x + Math.round(this.camX), wy = tap.y + Math.round(this.camY);
    // Önce dokunulabilen bir nesneye mi dokunuldu?
    const target = this.targets.find((tg) => !tg.disabled && wx >= tg.box.x0 && wx <= tg.box.x1 && wy >= tg.box.y0 && wy <= tg.box.y1);
    if (target) {
      // Elinde cevher varken başka cevhere gitme bile, hemen uyar.
      if (target.kind === 'ore' && this.carryFull()) return;
      if (this.canAct(target)) {
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

  canAct(tg) {
    if (tg.canAct) return tg.canAct();
    return Math.hypot(this.player.x - tg.x, this.player.y - tg.y) <= tg.reach;
  }

  update(dt, taps) {
    if (this.caught) {
      this.updateCaught(dt);
      return;
    }
    this.t += dt;
    if (!this.ending) this.stats.time += dt;
    if (this.ending) {
      this.ending.t += dt;
      if (this.ending.t > 2.4) {
        this.game.scene = new CompleteScene(this.game, { levelIndex: this.levelIndex, loaded: this.elevator.loaded.length, time: this.stats.time });
        return;
      }
    }
    this.fadeIn = Math.min(1, this.fadeIn + dt / 1.5);
    for (const tap of taps) {
      if (this.sprintButton.contains(tap.x, tap.y)) {
        this.sprintButton.flash = 0.12;
        this.sprintButton.onTap();
        continue;
      }
      this.handleTap(tap);
    }

    const p = this.player;
    p.update(dt, this.map);

    // Varınca bekleyen işi yap
    if (this.pending && !p.path.length) {
      const tg = this.pending;
      this.pending = null;
      if (tg.canAct ? tg.canAct() : Math.hypot(p.x - tg.x, p.y - tg.y) <= tg.reach + 6) tg.act();
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

    this.updateGromm(dt);
    this.particles.updateDust(dt, p, (x, y) => this.map.solidAt(x, y));
    this.particles.updateEmbers(dt);
    this.particles.updateEffects(dt);
    for (const ore of this.ores) ore.update(dt);
    this.updateElevator(dt);
    // Sprint butonu ve dayanıklılık barının görünürlüğü
    const sb = this.sprintButton;
    sb.active = p.sprinting;
    sb.blocked = p.exhausted;
    sb.t += dt;
    sb.flash = Math.max(0, sb.flash - dt);
    const showBar = p.stamina < 0.999 || p.sprinting;
    this.staminaAlpha = showBar ? Math.min(1, this.staminaAlpha + dt * 6) : Math.max(0, this.staminaAlpha - dt * 1.5);
    for (const n of this.noises) n.t += dt;
    this.noises = this.noises.filter((n) => n.t < 1);

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
    for (const ore of this.ores) {
      if (!ore.broken) list.push({ y: ore.ty * TILE + 28, draw: () => ore.draw(sc, camX, camY) });
    }
    const el = this.elevator;
    if (el.loaded.length) list.push({ y: el.y0 + 20, draw: () => this.drawElevatorCargo(sc, camX, camY) });
    if (!(this.ending && this.ending.t > 1.2)) list.push({ y: this.player.y, draw: () => this.player.draw(sc, camX, camY) });
    const g = this.gromm;
    if (g.x > camX - 80 && g.x < camX + this.scene.width + 80 && g.y > camY - 20 && g.y < camY + this.scene.height + 130) {
      list.push({ y: g.y, draw: () => g.draw(sc, camX, camY) });
    }
    list.sort((a, b) => a.y - b.y);
    for (const e of list) e.draw();
  }

  /** Asansör platformundaki cevher yığını. */
  drawElevatorCargo(sc, camX, camY) {
    const el = this.elevator;
    const cx = Math.round((el.x0 + el.x1) / 2 - camX), cy = Math.round(el.y0 + 18 - camY);
    const cols = { gold: ['#8a5a14', '#ffd04a'], crystal: ['#1e5c8a', '#7fd8ff'], ruby: ['#7a1022', '#ff5a6e'] };
    el.loaded.forEach((k, i) => {
      const x = cx - 12 + (i % 4) * 7, y = cy - Math.floor(i / 4) * 4;
      sc.fillStyle = '#141012';
      sc.fillRect(x - 1, y - 1, 7, 6);
      sc.fillStyle = cols[k][0];
      sc.fillRect(x, y, 5, 4);
      sc.fillStyle = cols[k][1];
      sc.fillRect(x, y, 3, 2);
    });
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
    this.drawDecals(sc, camX, camY);
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
    this.drawStaminaBar(ctx, camX, camY);
    this.layoutSprintButton(w, h);
    this.sprintButton.draw(ctx);
    this.drawOverlay(ctx, w, h);

    if (this.fadeIn < 1 && !this.caught) {
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
    for (const ore of this.ores) {
      if (ore.broken || !onScreen(ore.x, ore.y)) continue;
      // Kristal ve yakut karanlıkta da hafifçe parıldar; altın ışık ister.
      const glow = ore.kind === 'gold' ? 0 : 0.35;
      for (const g of ore.glints) {
        const wx = ore.x0 + g.x, wy = ore.y0 + g.y;
        const Lt = Math.min(1, Math.max(glow, light(wx, wy) * 1.3));
        const v = Math.pow(Math.max(0, Math.sin(this.t * g.rate + g.phase)), 8) * Lt;
        if (v < 0.08) continue;
        ctx.globalAlpha = v;
        ctx.fillStyle = ore.type.glint;
        ctx.fillRect(wx - camX, wy - camY, 1, 1);
        if (v > 0.6) {
          ctx.globalAlpha = v * 0.5;
          ctx.fillRect(wx - camX - 1, wy - camY, 3, 1);
          ctx.fillRect(wx - camX, wy - camY - 1, 1, 3);
        }
      }
    }
    ctx.globalAlpha = 1;
    this.particles.drawEffects(ctx, camX, camY, light, images.get(FX.sparks));
    this.gromm.drawEyes(ctx, camX, camY, this.t);
    // Asansör lambası
    const el = this.elevator;
    const lx = Math.round(el.lampX - camX) - 1, ly = Math.round(el.lampY - camY);
    ctx.fillStyle = '#0c0a0a';
    ctx.fillRect(lx - 1, ly - 1, 5, 5);
    if (el.ready) {
      ctx.fillStyle = '#7dff8c';
      ctx.fillRect(lx, ly, 3, 3);
      ctx.fillStyle = '#e4ffe8';
      ctx.fillRect(lx + 1, ly + 1, 1, 1);
    } else {
      const a = el.redLight.flicker;
      ctx.fillStyle = a > 0.6 ? '#ff4a3a' : '#7a1a14';
      ctx.fillRect(lx, ly, 3, 3);
    }
  }

  /** Bölüm adı, sayaçlar ve mesajlar. */
  drawOverlay(ctx, w, h) {
    this.drawCounters(ctx);
    if (this.t < 5 && !this.caught) {
      const a = Math.min(1, this.t / 1, (5 - this.t) / 1.2);
      ctx.globalAlpha = Math.max(0, a);
      drawText(ctx, this.level.name, Math.floor(w / 2), Math.floor(h * 0.18), { color: '#cdbb98', size: 2, align: 'center', shadow: '#000' });
      ctx.globalAlpha = 1;
    }
    if (this.caught) {
      const c = this.caught;
      if (c.scare && c.t < JUMPSCARE.end) {
        drawJumpscare(ctx, w, h, c.t);
      } else {
        // kararma ve yazı
        const b = c.scare ? 1 : Math.min(1, c.t / 0.5);
        ctx.fillStyle = `rgba(0,0,0,${b.toFixed(2)})`;
        ctx.fillRect(0, 0, w, h);
        const ta = Math.min(1, (c.t - c.textAt) / 0.4);
        if (ta > 0) {
          ctx.globalAlpha = ta;
          drawText(ctx, 'Gromm seni yakaladı', Math.floor(w / 2), Math.floor(h / 2 - 8), { color: '#c83a2a', size: w > 300 ? 2 : 1, align: 'center' });
          ctx.globalAlpha = 1;
        }
      }
    }
    if (this.ending) {
      const a = Math.max(0, Math.min(1, (this.ending.t - 0.8) / 1.4));
      ctx.fillStyle = `rgba(0,0,0,${a.toFixed(2)})`;
      ctx.fillRect(0, 0, w, h);
    }
    // Mesajlar sprint butonunun üstünde kalsın (dar ekranlarda çakışmasın)
    let y = Math.min(h - 22, this.sprintButton.y - 16);
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

  /** Sprint butonu: sağ alt köşe, başparmakla rahat basılacak büyüklükte. */
  layoutSprintButton(w, h) {
    const s = Math.round(this.game.screen.buttonSize * 1.3);
    const m = Math.max(6, Math.round(s / 4));
    const b = this.sprintButton;
    b.size = s;
    b.x = w - s - m;
    b.y = h - s - m;
  }

  /** Madencinin başının üstünde küçük dayanıklılık barı (kullanılırken görünür). */
  drawStaminaBar(ctx, camX, camY) {
    const a = this.staminaAlpha;
    const p = this.player;
    if (a <= 0.01 || p.dead) return;
    const x = Math.round(p.x - camX) - 9, y = Math.round(p.y - camY) - 39;
    const W = 18, H = 4;
    ctx.globalAlpha = a;
    // şimşek ikonu
    ctx.fillStyle = '#120c08';
    ctx.fillRect(x - 5, y - 1, 4, H + 2);
    ctx.fillStyle = p.exhausted ? '#d83a2a' : '#ffd970';
    ctx.fillRect(x - 3, y, 1, 2);
    ctx.fillRect(x - 4, y + 2, 2, 1);
    ctx.fillRect(x - 3, y + 3, 1, 1);
    // çerçeve ve zemin
    ctx.fillStyle = '#120c08';
    ctx.fillRect(x - 1, y - 1, W + 2, H + 2);
    ctx.fillStyle = '#2e241c';
    ctx.fillRect(x, y, W, H);
    const blink = p.exhausted && Math.floor(this.t * 6) % 2 === 0;
    const v = p.stamina;
    const fill = Math.round(W * v);
    let c1 = '#7fcf5a', c2 = '#b4ec8a';
    if (v < 0.5) { c1 = '#e0b438'; c2 = '#f6dc7a'; }
    if (v < 0.25) { c1 = '#e0662e'; c2 = '#f6a070'; }
    if (p.exhausted) { c1 = blink ? '#ff3a2a' : '#7a1a14'; c2 = blink ? '#ff9a8a' : '#a0302a'; }
    if (fill > 0) {
      ctx.fillStyle = c1;
      ctx.fillRect(x, y, fill, H);
      ctx.fillStyle = c2;
      ctx.fillRect(x, y, fill, 1);
    }
    if (p.exhausted) {
      // tekrar koşmak için gereken eşik çizgisi
      ctx.fillStyle = '#e6d2a8';
      ctx.fillRect(x + Math.round(W * 0.35), y - 1, 1, H + 2);
    }
    ctx.globalAlpha = 1;
  }

  /** Sol üstte: asansördeki ve sırttaki cevher sayısı. */
  drawCounters(ctx) {
    const el = this.elevator, p = this.player;
    const lines = [
      { icon: 'cage', text: `Asansör ${el.loaded.length}/${el.required}`, color: el.ready ? '#8dff9a' : '#e6d2a8' },
      { icon: 'sack', text: `Taşınan ${p.carried}/${MAX_CARRY}`, color: p.carried ? '#ffd970' : '#a89a84' },
    ];
    const w = Math.max(...lines.map((l) => textWidth(l.text))) + 22;
    ctx.fillStyle = 'rgba(8,6,10,0.65)';
    ctx.fillRect(4, 4, w, 30);
    ctx.fillStyle = 'rgba(120,100,80,0.35)';
    ctx.fillRect(4, 4, w, 1);
    lines.forEach((l, i) => {
      const y = 7 + i * 13;
      drawIcon(ctx, l.icon, 8, y + 1, el.ready && l.icon === 'cage');
      drawText(ctx, l.text, 20, y, { color: l.color, shadow: '#000' });
    });
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

/** Sayaç ikonları (9x9). */
function drawIcon(ctx, kind, x, y, on) {
  if (kind === 'cage') {
    ctx.fillStyle = '#5f6772';
    ctx.fillRect(x, y, 9, 9);
    ctx.fillStyle = '#1a1c20';
    ctx.fillRect(x + 1, y + 1, 7, 7);
    ctx.fillStyle = '#5f6772';
    ctx.fillRect(x + 3, y + 1, 1, 7);
    ctx.fillRect(x + 5, y + 1, 1, 7);
    ctx.fillStyle = on ? '#7dff8c' : '#ff4a3a';
    ctx.fillRect(x + 7, y - 1, 2, 2);
  } else {
    ctx.fillStyle = '#1e140c';
    ctx.fillRect(x, y + 1, 9, 8);
    ctx.fillStyle = '#8c6c44';
    ctx.fillRect(x + 1, y + 2, 7, 6);
    ctx.fillStyle = '#ffd04a';
    ctx.fillRect(x + 2, y + 1, 2, 2);
    ctx.fillStyle = '#7fd8ff';
    ctx.fillRect(x + 5, y + 1, 2, 2);
  }
}

function panOf(dx) {
  return Math.max(-1, Math.min(1, dx / 320));
}
