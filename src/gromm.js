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

import { TILE, MINER_SPEED, SPRINT_MULT } from './config.js';
import { images, GROMM_SPRITES } from './assets.js';
import { findPath } from './pathfinding.js';

const SCALE = 2;
const PARAMS = new URLSearchParams(location.search);
/** ?digsoon: Gromm birkaç saniyede bir kazar (test için) */
export const DIG_SOON = PARAMS.has('digsoon');
/** ?digdebug: kazma yolu ve çıkış noktası ekranda görünür */
export const DIG_DEBUG = PARAMS.has('digdebug');
const FEET = 57; // karede ayakların olduğu satır
export const GROMM = {
  /** Dolaşırken: madencinin yürüyüşünden yavaş */
  wanderSpeed: MINER_SPEED * 0.75,
  /** Kovalarken (her zaman koşar): madencinin yürüyüşünden hızlı, sprintinden belirgin yavaş */
  chaseSpeed: MINER_SPEED * 1.06,
  /** İleri/geri ivme (px/sn²) */
  accel: 240,
  /** Yana ivme (px/sn²): düşük olduğu için köşelerde savrulur */
  turnAccel: 120,
  /** Keskin dönüşte (180°) hızın düşeceği oran */
  turnSlowdown: 0.55,
  /** Temel algı: bu mesafedeki madenciyi duvar arkasında bile fark eder (neredeyse kör ve sağır) */
  feelRange: 2 * TILE,
  /** Madenci karanlıkta ve meşalesi sönükken (saklanırken) fark etme mesafesi */
  hiddenFeelRange: 1 * TILE,
  /** Kovalarken görüş hattıyla izleyebildiği mesafe; daha uzaklaşan madenciyi bırakır */
  loseRange: 8 * TILE,
  /** Son görülen yerde etrafına bakınma süresi (sn) */
  lookTime: 2.5,
  /** Ayaklar arası bu mesafeye inince yakalar (gerçekten üstüne basınca) */
  catchRange: 14,
  /** Ayak kutusu */
  box: [12, 7, 4],
  /** Hiçbir durumda geçemeyeceği hız: madencinin sprint hızının %90'ı */
  maxSpeed: MINER_SPEED * SPRINT_MULT * 0.9,

  // --- Özellikler (Gromm'u hızlandırmaz, madenciyi bulmasını kolaylaştırır) ---
  /** Görme: görüş hattı varsa madenciyi bu uzaklıktan görür */
  sight: 8 * TILE,
  /** Görme: yanan meşaleyi bu uzaklıktan fark eder */
  torchSight: 12 * TILE,
  /** Koklama: bu mesafedeki izi alır (güçlü izde 2 katı) */
  smellRange: 5 * TILE,
  /** Koklama: bu kadar eski iz artık kokmaz (sn; güçlü izde 2 katı) */
  trailLife: 25,
  /** Koklama: bir kovalamayı bıraktıktan sonra bu kadar süre koku almaz (sn) */
  smellCooldown: 6,
  /** Hafıza: dolaşırken asansörü ve son görülen yerleri kontrol etme aralığı (sn) */
  patrolEvery: 35,
  /** Hafıza: hatırladığı son görülme yeri sayısı */
  memorySize: 3,

  // --- Kazma (her bölümde) ---
  /** Duvarın içinden en fazla bu kadar ilerler */
  digMaxDist: 10 * TILE,
  /** Duvara bu kadar uzaktan yönelip kazmaya başlayabilir */
  digReach: 3 * TILE,
  /** İki kazma arası en az bekleme (sn) */
  digCooldown: DIG_SOON ? 4 : 15,
  /** Dolaşırken kazma aralığı (sn) */
  wanderDigMin: DIG_SOON ? 3 : 20,
  wanderDigMax: DIG_SOON ? 5 : 30,
  /** Yeraltındaki hızı: normal yürüyüşüne yakın */
  digSpeed: MINER_SPEED * 0.9,
  /** Aşama süreleri (sn) */
  digDive: 1.0,
  digWarn: 1.15,
  digEmerge: 0.45,
  digRecover: 1.0,
  /** Madencinin bu kadar yakınına çıkamaz */
  digPlayerGap: 3 * TILE,
  /** Asansörün çevresinde bu kadar tile'a çıkamaz */
  digElevatorGap: 3,
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
    /** Bir sesi duyup oraya yöneldiğinde */
    this.onHear = null;
    // Özellikler (bkz. setAbilities)
    this.abilities = new Set();
    this.levelIndex = 0;
    /** Oyun sahnesinin her karede doldurduğu algı bilgisi */
    this.senses = { noises: [], hidden: false, torchLit: false, trail: [], elevator: null, time: 0 };
    /** Hafıza: madencinin görüldüğü son yerler (en yenisi başta) */
    this.memory = [];
    this.patrolIndex = 0;
    /** Final bölümü: öfkeli (biraz daha hızlı, madencinin yerini bilir) */
    this.rage = false;
    /** Kazma: null veya { phase, t, ex, ey (giriş), tx, ty (çıkış), resume } */
    this.dig = null;
    this.digCooldown = DIG_SOON ? 2 : 10;
    this.wanderDigTimer = GROMM.wanderDigMin + Math.random() * (GROMM.wanderDigMax - GROMM.wanderDigMin);
    this.digCheck = 0;
    /** Kazma olayları: onDig(olay, veri) — 'dive' | 'vanish' | 'warn' | 'emerge' | 'done' */
    this.onDig = null;
    this.smellTimer = 0;
    this.trackT = -1;
    this.checkedElevator = false;
    this.patrolTimer = GROMM.patrolEvery;
    sheets();
  }

  /** Bu bölümdeki özellikler: 'duyma' | 'gorme' | 'koklama' | 'hafiza' */
  setAbilities(list, levelIndex = 0) {
    this.abilities = new Set(list);
    this.levelIndex = levelIndex;
  }

  has(a) {
    return this.abilities.has(a);
  }

  /** Kovalama hızı: yürüyüşten hızlı, sprintten hep yavaş (öfkeliyken biraz daha hızlı). */
  get chaseSpeed() {
    return Math.min(GROMM.chaseSpeed * (this.rage ? 1.06 : 1), GROMM.maxSpeed);
  }

  get wanderSpeed() {
    return GROMM.wanderSpeed;
  }

  /**
   * Madenciyi fark ediyor/görüyor mu?
   * - Temel: çok yakındaysa (duvar arkasında bile) fark eder.
   * - Görme özelliği ya da kovalama sırasında: görüş hattı varsa menzil içinde görür.
   * - Karanlıkta meşalesi sönük madenci görülemez (sadece dibine gelirse fark edilir).
   */
  perceives(player, map, chasing) {
    const d = Math.hypot(player.x - this.x, player.y - this.y);
    const hidden = this.senses.hidden;
    if (d <= (hidden ? GROMM.hiddenFeelRange : GROMM.feelRange)) return true;
    if (hidden) return false;
    let range = 0;
    if (chasing) range = GROMM.loseRange;
    if (this.has('gorme')) range = Math.max(range, this.senses.torchLit ? GROMM.torchSight : GROMM.sight);
    if (d > range) return false;
    return !map.rayBlocked(this.x, this.y - 10, player.x, player.y - 8);
  }

  /** Hafıza: görüldüğü yeri hatırla. */
  remember(x, y) {
    if (!this.has('hafiza')) return;
    const m = this.memory;
    if (m.length && Math.hypot(m[0].x - x, m[0].y - y) < 3 * TILE) {
      m[0] = { x, y };
      return;
    }
    m.unshift({ x, y });
    if (m.length > GROMM.memorySize) m.pop();
  }

  /** Duyma: yarıçapının içinde kaldığı en güçlü yeni sese yönel. */
  hear(map) {
    if (!this.has('duyma')) return false;
    let best = null, bestScore = 0;
    for (const n of this.senses.noises) {
      const d = Math.hypot(n.x - this.x, n.y - this.y);
      if (d > n.r) continue;
      const score = n.r - d;
      if (score > bestScore) {
        bestScore = score;
        best = n;
      }
    }
    if (!best) return false;
    this.setState('search');
    this.lastSeen = { x: best.x, y: best.y };
    this.goTo(map, best.x, best.y);
    if (this.onHear) this.onHear(best);
    return true;
  }

  /** Koklama: yakındaki izin daha taze bir noktasını bul. */
  freshTrailPoint() {
    const now = this.senses.time;
    let best = null;
    for (const pt of this.senses.trail) {
      const k = pt.s || 1; // yemekten sonra iz 2 kat güçlü
      if (pt.t <= this.trackT || now - pt.t > GROMM.trailLife * k) continue;
      if (Math.hypot(pt.x - this.x, pt.y - this.y) > GROMM.smellRange * k) continue;
      if (!best || pt.t > best.t) best = pt;
    }
    return best;
  }

  smell(map, dt) {
    if (!this.has('koklama')) return false;
    this.smellTimer -= dt;
    if (this.smellTimer > 0) return false;
    this.smellTimer = 0.5;
    const pt = this.freshTrailPoint();
    if (!pt) return false;
    this.setState('track');
    this.trackT = pt.t;
    this.goTo(map, pt.x, pt.y);
    return true;
  }

  /** Hafıza: asansörün çevresini kontrol etmeye git. */
  patrol(map, preferMemory = false) {
    if (!this.has('hafiza')) return false;
    // sırayla: asansörün çevresi ve madencinin görüldüğü son yerler
    const spots = [];
    if (this.senses.elevator) spots.push(this.senses.elevator);
    spots.push(...this.memory);
    if (!spots.length) return false;
    let spot;
    if (preferMemory && this.memory.length) spot = this.memory[0];
    else spot = spots[this.patrolIndex++ % spots.length];
    this.setState('patrol');
    this.patrolTimer = GROMM.patrolEvery;
    this.checkedElevator = true;
    return this.goTo(map, spot.x, spot.y);
  }

  get speed() {
    return Math.hypot(this.vx, this.vy);
  }

  setState(s) {
    this.state = s;
    this.stateTime = 0;
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
    this.digCooldown -= dt;
    if (this.dig) {
      this.updateDig(dt, map, player);
      return;
    }
    const alive = !player.dead;
    const dist = Math.hypot(player.x - this.x, player.y - this.y);

    // Sakin durumlar: önce gör, sonra duy, sonra kokla
    const calm = this.state !== 'chase' && this.state !== 'attack';
    // final: öfkeli, madencinin yerini her zaman bilir
    if (calm && alive && this.rage) this.startChase(player);
    else if (calm && alive) {
      if (this.perceives(player, map, false)) this.startChase(player);
      else if (this.hear(map)) { /* sese yöneldi */ }
      else if ((this.state === 'idle' || this.state === 'wander' || this.state === 'look') && this.smell(map, dt)) { /* ize düştü */ }
    }

    switch (this.state) {
      case 'idle':
        this.path = [];
        this.patrolTimer -= dt;
        if (this.stateTime > this.idleFor) {
          if (this.patrolTimer <= 0 && this.patrol(map)) break;
          if (this.pickWanderTarget(map, player)) this.setState('wander');
          else this.stateTime = 0;
        }
        break;
      case 'wander':
        this.patrolTimer -= dt;
        if (!this.path.length) this.rest();
        else if (this.patrolTimer <= 0) this.patrol(map);
        break;
      case 'chase': {
        if (this.rage) {
          // Final: öfkeli, madencinin yerini her zaman bilir
          this.lastSeen = { x: player.x, y: player.y };
          this.repath -= dt;
          if (this.repath <= 0) {
            this.repath = 0.3;
            this.goTo(map, player.x, player.y);
          }
          break;
        }
        const maxRange = this.has('gorme') && this.senses.torchLit ? GROMM.torchSight : GROMM.loseRange;
        if (dist > maxRange && !this.senses.hidden) {
          // Yeterince uzaklaştı: bırak, etrafına bakın
          this.lookAround();
          break;
        }
        if (alive && this.perceives(player, map, true)) {
          this.lastSeen = { x: player.x, y: player.y };
          this.remember(player.x, player.y);
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
        if (!this.path.length || this.stateTime > 10) this.lookAround();
        break;
      case 'track': {
        // Koklama: izin daha taze noktasına geç
        if (!this.path.length || this.stateTime > 6) {
          const pt = this.freshTrailPoint();
          if (pt) {
            this.trackT = pt.t;
            this.goTo(map, pt.x, pt.y);
            this.stateTime = 0;
          } else this.lookAround();
        }
        break;
      }
      case 'patrol':
        if (!this.path.length || this.stateTime > 15) this.lookAround();
        break;
      case 'look':
        // Durup etrafına bakınır: yönünü değiştirir
        this.path = [];
        {
          const k = Math.floor(this.stateTime / 0.6);
          if (k !== this.lookStep) {
            this.lookStep = k;
            const dirs = ['left', 'up', 'right', 'down'];
            this.dir = dirs[(dirs.indexOf(this.dir) + 1 + (Math.random() < 0.5 ? 0 : 2)) % 4];
          }
          if (this.stateTime > this.lookFor) {
            // Hafıza: son gördüğü yerden sonra asansörün çevresine bakar
            if (!this.checkedElevator && this.patrol(map)) break;
            this.rest(0.3);
          }
        }
        break;
      case 'attack':
        this.path = [];
        break;
    }

    // Kazma: dolaşırken arada bir başka bölgeye, hedefe giderken kestirmeden
    if (alive && !this.rage && this.considerDig(dt, map, player)) return;

    // Hareket: hedef hız; keskin dönüşte yavaşlar
    const st = this.state;
    // kovalarken en hızlı; sese/son görülen yere giderken orta; iz koklarken yavaş
    const maxV = st === 'chase' ? this.chaseSpeed : st === 'search' || st === 'patrol' ? (this.chaseSpeed + this.wanderSpeed) / 2 : st === 'track' ? this.wanderSpeed * 1.05 : this.wanderSpeed;
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

  // ---------------- Kazma ----------------

  /** Gromm şu an görünmüyor mu (duvarın içinde)? */
  get underground() {
    const d = this.dig;
    return !!d && (d.phase === 'under' || d.phase === 'warn' || (d.phase === 'dive' && d.t >= GROMM.digDive * 0.75));
  }

  /** Çıkış noktası uygun mu: yürünebilir, asansörün dibi değil, madenciden uzak. */
  canExit(map, x, y, player) {
    const [rx, ry1, ry2] = GROMM.box;
    if (map.boxBlocked(x, y, rx + 4, ry1 + 2, ry2 + 2)) return false;
    const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (map.isSolid(tx + dx, ty + dy)) return false;
    const eb = this.senses.elevatorBox;
    if (eb) {
      const g = GROMM.digElevatorGap * TILE;
      if (x > eb.x0 - g && x < eb.x1 + g && y > eb.y0 - g && y < eb.y1 + g) return false;
    }
    if (player && !player.dead && Math.hypot(x - player.x, y - player.y) < GROMM.digPlayerGap) return false;
    return true;
  }

  /** Gromm'dan (x, y) yönüne giden çizgide ilk duvar; yakındaysa giriş noktası. */
  entryToward(map, x, y) {
    const dx = x - this.x, dy = y - this.y;
    const d = Math.hypot(dx, dy);
    if (d < 1) return null;
    const ux = dx / d, uy = dy / d;
    for (let s = 4; s <= GROMM.digReach + 4; s += 4) {
      const px = this.x + ux * s, py = this.y - 6 + uy * s;
      if (map.isOpaque(Math.floor(px / TILE), Math.floor(py / TILE))) {
        return { x: this.x + ux * Math.max(0, s - 6), y: this.y + uy * Math.max(0, s - 6), wx: px, wy: py, ux, uy };
      }
    }
    return null;
  }

  /**
   * Hedef noktasının çevresinde uygun bir çıkış ve ona giden duvar girişi bul.
   * near: çıkışın yakın olması tercih edilen nokta.
   */
  planDig(map, near, player) {
    const cands = [{ x: near.x, y: near.y }];
    for (const r of [1, 2, 3, 4]) {
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2 + r;
        cands.push({ x: near.x + Math.cos(a) * r * TILE, y: near.y + Math.sin(a) * r * TILE });
      }
    }
    for (const c of cands) {
      const entry = this.entryToward(map, c.x, c.y);
      if (!entry) continue;
      const under = Math.hypot(c.x - entry.x, c.y - entry.y);
      if (under > GROMM.digMaxDist || under < 2.5 * TILE) continue;
      if (!this.canExit(map, c.x, c.y, player)) continue;
      // çıkışa yürüyerek de ulaşılabilmeli (kapalı bir cebe çıkmasın)
      if (!findPath(map, c.x, c.y, this.x, this.y, { box: GROMM.box, wallCost: 2.5 })) continue;
      return { entry, exit: { x: c.x, y: c.y } };
    }
    return null;
  }

  /** Bir yöndeki duvara dalıp aynı doğrultuda en uzak uygun çıkış. */
  planAlong(map, ang, player) {
    const far = { x: this.x + Math.cos(ang) * GROMM.digMaxDist, y: this.y + Math.sin(ang) * GROMM.digMaxDist };
    const entry = this.entryToward(map, far.x, far.y);
    if (!entry) return null;
    for (let dd = GROMM.digMaxDist - 0.5 * TILE; dd >= 3 * TILE; dd -= TILE / 2) {
      const x = entry.x + entry.ux * dd, y = entry.y + entry.uy * dd;
      if (!this.canExit(map, x, y, player)) continue;
      if (!findPath(map, x, y, this.x, this.y, { box: GROMM.box, wallCost: 2.5 })) continue;
      return { entry, exit: { x, y } };
    }
    return null;
  }

  pathLength() {
    let len = 0, px = this.x, py = this.y;
    for (const p of this.path) {
      len += Math.hypot(p.x - px, p.y - py);
      px = p.x;
      py = p.y;
    }
    return len;
  }

  /** Kazmalı mı? Kazmaya başladıysa true döner. */
  considerDig(dt, map, player) {
    if (this.digCooldown > 0) return false;
    const st = this.state;
    if (st === 'idle' || st === 'wander') {
      this.wanderDigTimer -= dt;
      if (this.wanderDigTimer > 0) return false;
      // uygun duvar yoksa dolaşırken her saniye tekrar dener
      this.wanderDigTimer = 1;
      // özellikler çıkış yerini etkiler (duyma, koklama, hafıza)
      const pref = this.preferredExit(map);
      const tries = [];
      if (pref) tries.push(() => this.planDig(map, pref, player));
      // haritanın başka bir bölgesine: yakındaki bir duvarın öbür tarafı
      const a0 = Math.random() * Math.PI * 2;
      for (let k = 0; k < 16; k++) tries.push(() => this.planAlong(map, a0 + (k * Math.PI * 2) / 16, player));
      for (const tr of tries) {
        const plan = tr();
        if (!plan) continue;
        const walk = findPath(map, this.x, this.y, plan.exit.x, plan.exit.y, { box: GROMM.box, wallCost: 2.5 });
        const under = Math.hypot(plan.exit.x - plan.entry.x, plan.exit.y - plan.entry.y);
        if (walk && walk.points.length && this.lengthOf(walk.points) < under * 1.4) continue; // yürümek zaten kısa
        this.startDig(plan, { state: 'wander' });
        return true;
      }
      return false;
    }
    if (st !== 'chase' && st !== 'search' && st !== 'track' && st !== 'patrol') return false;
    this.digCheck -= dt;
    if (this.digCheck > 0 || !this.path.length) return false;
    this.digCheck = 1;
    const goal = st === 'chase' ? { x: player.x, y: player.y } : this.path[this.path.length - 1];
    const straight = Math.hypot(goal.x - this.x, goal.y - this.y);
    if (straight > GROMM.digMaxDist + GROMM.digReach) return false;
    const walk = this.pathLength();
    if (straight * 2 >= walk) return false;
    if (!map.rayBlocked(this.x, this.y - 10, goal.x, goal.y - 10)) return false;
    const plan = this.planDig(map, goal, player);
    if (!plan) return false;
    const under = Math.hypot(plan.exit.x - plan.entry.x, plan.exit.y - plan.entry.y);
    if (under * 2 >= walk) return false;
    this.startDig(plan, { state: st });
    return true;
  }

  lengthOf(points) {
    let len = 0, px = this.x, py = this.y;
    for (const p of points) {
      len += Math.hypot(p.x - px, p.y - py);
      px = p.x;
      py = p.y;
    }
    return len;
  }

  /** Özelliklere göre tercih edilen çıkış yakını (yoksa null). */
  preferredExit() {
    // duyma: son duyulan ses; koklama: en taze iz; hafıza: son görüldüğü yer
    if (this.has('duyma')) {
      let best = null;
      for (const n of this.senses.noises) if (Math.hypot(n.x - this.x, n.y - this.y) <= Math.max(n.r, GROMM.digMaxDist)) best = n;
      if (best) return best;
    }
    if (this.has('koklama')) {
      const now = this.senses.time;
      let best = null;
      for (const pt of this.senses.trail) {
        if (now - pt.t > GROMM.trailLife * (pt.s || 1)) continue;
        if (Math.hypot(pt.x - this.x, pt.y - this.y) > GROMM.digMaxDist) continue;
        if (!best || pt.t > best.t) best = pt;
      }
      if (best) return best;
    }
    if (this.has('hafiza') && this.memory.length) {
      const m = this.memory[0];
      if (Math.hypot(m.x - this.x, m.y - this.y) < GROMM.digMaxDist + GROMM.digReach) return m;
    }
    return null;
  }

  startDig(plan, resume) {
    const { entry, exit } = plan;
    this.dig = {
      phase: 'dive', t: 0,
      ex: entry.wx, ey: entry.wy, // duvardaki giriş noktası
      sx: entry.x, sy: entry.y, // dalmadan önce durduğu yer
      tx: exit.x, ty: exit.y,
      resume, retargets: 0, wait: 0,
    };
    this.path = [];
    this.setDirToward(entry.ux, entry.uy);
    this.anim = 'stomp';
    this.animT = 0;
    if (this.onDig) this.onDig('dive', { x: entry.wx, y: entry.wy, ux: entry.ux, uy: entry.uy });
  }

  setDirToward(dx, dy) {
    if (Math.abs(dx) > Math.abs(dy)) this.dir = dx < 0 ? 'left' : 'right';
    else this.dir = dy < 0 ? 'up' : 'down';
  }

  updateDig(dt, map, player) {
    const d = this.dig;
    d.t += dt;
    this.vx = this.vy = 0;
    switch (d.phase) {
      case 'dive': {
        // duvara yürüyüp kazar, sonra içine dalar
        const k = 1 - Math.exp(-6 * dt);
        this.x += (d.sx - this.x) * k;
        this.y += (d.sy - this.y) * k;
        this.animT += dt;
        if (d.t >= GROMM.digDive * 0.75 && !d.vanished) {
          d.vanished = true;
          if (this.onDig) this.onDig('vanish', { x: d.ex, y: d.ey });
        }
        if (d.t >= GROMM.digDive) {
          d.phase = 'under';
          d.t = 0;
          this.x = d.ex;
          this.y = d.ey;
        }
        break;
      }
      case 'under': {
        // özellikler yeraltında da çalışır (görme hariç)
        if (d.retargets < 2) {
          let near = null;
          if (this.has('duyma')) {
            for (const n of this.senses.noises) if (Math.hypot(n.x - this.x, n.y - this.y) <= n.r) near = n;
          }
          if (!near && this.has('koklama') && Math.floor((d.t - dt) / 1.5) !== Math.floor(d.t / 1.5)) {
            const pt = this.freshTrailPoint();
            if (pt && Math.hypot(pt.x - d.tx, pt.y - d.ty) > 2 * TILE) near = pt;
          }
          if (near) {
            const c = this.exitNear(map, near, player, d);
            if (c) {
              d.tx = c.x;
              d.ty = c.y;
              d.retargets++;
            }
          }
        }
        const dx = d.tx - this.x, dy = d.ty - this.y;
        const dist = Math.hypot(dx, dy);
        const step = GROMM.digSpeed * dt;
        if (dist > step) {
          this.x += (dx / dist) * step;
          this.y += (dy / dist) * step;
          this.setDirToward(dx, dy);
        } else {
          this.x = d.tx;
          this.y = d.ty;
          // çıkmadan önce son kontrol: madenci çok yakınsa başka yer seç ya da bekle
          if (!this.canExit(map, d.tx, d.ty, player)) {
            d.wait += dt;
            const c = this.exitNear(map, { x: d.tx, y: d.ty }, player, d);
            if (c) {
              d.tx = c.x;
              d.ty = c.y;
            }
            if (d.wait < 4) break;
            if (!this.canExit(map, d.tx, d.ty, null)) break;
          }
          d.phase = 'warn';
          d.t = 0;
          if (this.onDig) this.onDig('warn', { x: d.tx, y: d.ty });
        }
        break;
      }
      case 'warn':
        if (d.t >= GROMM.digWarn && !this.canExit(map, d.tx, d.ty, player)) {
          // madenci tam çıkış yerine geldi: üstüne çıkma, başka yerden çık
          const c = this.exitNear(map, { x: d.tx + (d.tx - player.x), y: d.ty + (d.ty - player.y) }, player, d);
          if (c) {
            d.tx = c.x;
            d.ty = c.y;
          }
          d.phase = 'under';
          d.t = 0;
          if (this.onDig) this.onDig('cancel', { x: this.x, y: this.y });
          break;
        }
        if (d.t >= GROMM.digWarn) {
          d.phase = 'emerge';
          d.t = 0;
          this.anim = 'swipe';
          this.animT = 0;
          this.dir = 'down';
          if (this.onDig) this.onDig('emerge', { x: this.x, y: this.y });
        }
        break;
      case 'emerge':
        this.animT += dt;
        if (d.t >= GROMM.digEmerge) {
          d.phase = 'recover';
          d.t = 0;
          this.anim = 'idle';
          this.animT = 0;
        }
        break;
      case 'recover': {
        // sersemler, silkelenir
        this.animT += dt;
        this.frame = Math.floor(this.animT * GROMM_SPRITES.anims.idle.fps) % GROMM_SPRITES.anims.idle.frames;
        if (Math.floor(d.t / 0.25) !== Math.floor((d.t - dt) / 0.25)) this.dir = ['left', 'right'][Math.floor(d.t / 0.25) % 2];
        if (d.t >= GROMM.digRecover) this.finishDig(map);
        break;
      }
    }
  }

  /** Bir noktanın yakınında, şu anki yerden çok uzak olmayan uygun çıkış. */
  exitNear(map, near, player, d) {
    for (const r of [0, 1, 2, 3]) {
      for (let k = 0; k < (r ? 8 : 1); k++) {
        const a = (k / 8) * Math.PI * 2;
        const x = near.x + Math.cos(a) * r * TILE, y = near.y + Math.sin(a) * r * TILE;
        if (Math.hypot(x - d.ex, y - d.ey) > GROMM.digMaxDist) continue;
        if (this.canExit(map, x, y, player)) return { x, y };
      }
    }
    return null;
  }

  finishDig(map) {
    const resume = this.dig.resume;
    this.dig = null;
    this.digCooldown = GROMM.digCooldown;
    this.wanderDigTimer = GROMM.wanderDigMin + Math.random() * (GROMM.wanderDigMax - GROMM.wanderDigMin);
    this.anim = 'idle';
    if (this.onDig) this.onDig('done', { x: this.x, y: this.y });
    if (resume.state === 'wander') {
      this.rest(0.4);
      return;
    }
    // hedefine devam et (kovalıyorsa son görülen yere)
    const target = this.lastSeen || null;
    this.setState('search');
    if (!target || !this.goTo(map, target.x, target.y)) this.lookAround();
  }

  startChase(player) {
    const was = this.state;
    this.checkedElevator = false;
    this.setState('chase');
    this.repath = 0;
    this.unseen = 0;
    this.lastSeen = { x: player.x, y: player.y };
    if (was !== 'chase' && this.onSpot) this.onSpot();
  }

  /** Son görülen yerde durup 2-3 sn etrafına bakın, sonra dolaşmaya dön. */
  lookAround() {
    const wasChasing = this.state === 'chase' || this.state === 'search';
    this.setState('look');
    if (wasChasing) this.smellTimer = GROMM.smellCooldown;
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
    if (this.underground) return;
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
    if (this.underground) return;
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
