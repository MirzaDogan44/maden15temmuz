// Tile haritası: ayrıştırma, çarpışma ve ışık için sorgular.

import { TILE } from './config.js';

/** Işığı engelleyen ve üstünden yürünemeyen duvar karakterleri. */
const WALL_CHARS = new Set(['#', 'T', 'H', 'L', 'l', 'Z', 'X']);
/** Yürünemeyen ama ışığı engellemeyen engeller. */
const OBSTACLE_CHARS = new Set(['k', 'c', '1', '2', '3', 'P', 'W']);
const ORE_KINDS = { 1: 'gold', 2: 'crystal', 3: 'ruby' };

export class TileMap {
  constructor(level) {
    const rows = level.map;
    this.level = level;
    this.h = rows.length;
    this.w = rows[0].length;
    this.pw = this.w * TILE;
    this.ph = this.h * TILE;
    this.chars = rows.map((r) => r.split(''));

    /** 1 = duvar (ışığı keser). */
    this.opaque = new Uint8Array(this.w * this.h);
    /** 1 = üstünden yürünemez (duvar veya engel). */
    this.solid = new Uint8Array(this.w * this.h);

    this.start = { x: TILE * 1.5, y: TILE * 1.5 };
    this.grommStart = null;
    this.torches = [];
    this.lamps = [];
    this.supports = [];
    this.beams = [];
    this.rails = [];
    this.ores = [];
    this.stands = [];
    this.switches = [];
    /** Final bölümü: dinamit kurulacak patlatma noktaları (duvar yüzü) */
    this.blasts = [];
    this.signs = [];
    this.decor = [];
    this.darkZones = level.darkZones || [];
    let ex0 = Infinity, ey0 = Infinity, ex1 = -1, ey1 = -1;

    for (let y = 0; y < this.h; y++) {
      if (rows[y].length !== this.w) console.warn(`Harita satırı ${y} uzunluğu farklı`);
      for (let x = 0; x < this.w; x++) {
        const c = rows[y][x];
        const i = y * this.w + x;
        if (WALL_CHARS.has(c)) this.opaque[i] = this.solid[i] = 1;
        if (OBSTACLE_CHARS.has(c)) this.solid[i] = 1;
        switch (c) {
          case 'S': this.start = { x: (x + 0.5) * TILE, y: (y + 0.6) * TILE }; break;
          case 'M': this.grommStart = { x: (x + 0.5) * TILE, y: (y + 0.6) * TILE }; break;
          case 'E': ex0 = Math.min(ex0, x); ey0 = Math.min(ey0, y); ex1 = Math.max(ex1, x); ey1 = Math.max(ey1, y); break;
          case 'T': this.torches.push({ tx: x, ty: y }); break;
          case 'L': this.lamps.push({ tx: x, ty: y, lit: true }); break;
          case 'l': this.lamps.push({ tx: x, ty: y, lit: false }); break;
          case 'H': this.supports.push({ tx: x, ty: y }); break;
          case '=':
            // Yan yana '=' karakterleri tek bir kiriş
            if (rows[y][x - 1] === '=') this.beams[this.beams.length - 1].tx1 = x;
            else this.beams.push({ tx: x, tx1: x, ty: y });
            break;
          case 'r': this.rails.push({ tx: x, ty: y }); break;
          case '1': case '2': case '3': this.ores.push({ tx: x, ty: y, kind: ORE_KINDS[c] }); break;
          case 'P': this.stands.push({ tx: x, ty: y }); break;
          case 'Z': this.switches.push({ tx: x, ty: y }); break;
          case 'X': this.blasts.push({ tx: x, ty: y }); break;
          case 'W': this.signs.push({ tx: x, ty: y }); break;
          case 'k': case 'c': case 'g': case 'm': case 'b': case 'w': case 'x':
            this.decor.push({ type: c, tx: x, ty: y });
            break;
        }
      }
    }
    this.elevator = ex1 >= 0 ? { tx: ex0, ty: ey0, tw: ex1 - ex0 + 1, th: ey1 - ey0 + 1 } : null;

    for (const t of [...this.torches, ...this.supports, ...this.lamps, ...this.switches, ...this.blasts]) {
      if (!this.isFace(t.tx, t.ty)) console.warn('Meşale/lamba/kiriş zemine bakan bir duvar yüzünde değil:', t);
    }
  }

  /** Bir kareyi yürünebilir/yürünemez yapar (ör. kırılan cevher). */
  setSolid(tx, ty, solid) {
    if (this.inBounds(tx, ty)) this.solid[ty * this.w + tx] = solid ? 1 : 0;
  }

  /** Piksel noktası bir karanlık bölgenin içinde mi? */
  inDarkZone(px, py) {
    const tx = px / TILE, ty = py / TILE;
    return this.darkZones.some((z) => tx >= z.x && ty >= z.y && tx < z.x + z.w && ty < z.y + z.h);
  }

  inBounds(tx, ty) {
    return tx >= 0 && ty >= 0 && tx < this.w && ty < this.h;
  }

  isOpaque(tx, ty) {
    return !this.inBounds(tx, ty) || this.opaque[ty * this.w + tx] === 1;
  }

  isSolid(tx, ty) {
    return !this.inBounds(tx, ty) || this.solid[ty * this.w + tx] === 1;
  }

  isWalkable(tx, ty) {
    return !this.isSolid(tx, ty);
  }

  /** Zemine bakan duvar yüzü: duvar ve hemen altı duvar değil. */
  isFace(tx, ty) {
    return this.isOpaque(tx, ty) && !this.isOpaque(tx, ty + 1);
  }

  char(tx, ty) {
    return this.inBounds(tx, ty) ? this.chars[ty][tx] : '#';
  }

  /** Piksel noktası yürünemez bir karede mi? */
  solidAt(px, py) {
    return this.isSolid(Math.floor(px / TILE), Math.floor(py / TILE));
  }

  /**
   * Madencinin ayak kutusu (merkez x,y; yarım genişlik rx, yukarı ry1, aşağı ry2)
   * bir engele değiyor mu?
   */
  boxBlocked(x, y, rx = 5, ry1 = 4, ry2 = 3) {
    return (
      this.solidAt(x - rx, y - ry1) ||
      this.solidAt(x + rx, y - ry1) ||
      this.solidAt(x - rx, y + ry2) ||
      this.solidAt(x + rx, y + ry2)
    );
  }

  /**
   * Işın (x0,y0) -> (x1,y1) bir duvardan geçiyor mu? Başlangıç karesi sayılmaz.
   * Amanatides-Woo kare yürüyüşü.
   */
  rayBlocked(x0, y0, x1, y1) {
    let tx = Math.floor(x0 / TILE);
    let ty = Math.floor(y0 / TILE);
    const ex = Math.floor(x1 / TILE);
    const ey = Math.floor(y1 / TILE);
    if (tx === ex && ty === ey) return false;
    const dx = x1 - x0;
    const dy = y1 - y0;
    const sx = dx > 0 ? 1 : -1;
    const sy = dy > 0 ? 1 : -1;
    const tdx = dx !== 0 ? Math.abs(TILE / dx) : Infinity;
    const tdy = dy !== 0 ? Math.abs(TILE / dy) : Infinity;
    let tmx = dx !== 0 ? ((sx > 0 ? (tx + 1) * TILE - x0 : x0 - tx * TILE) / Math.abs(dx)) : Infinity;
    let tmy = dy !== 0 ? ((sy > 0 ? (ty + 1) * TILE - y0 : y0 - ty * TILE) / Math.abs(dy)) : Infinity;
    const w = this.w;
    for (let guard = 0; guard < 128; guard++) {
      if (tmx < tmy) {
        tmx += tdx;
        tx += sx;
      } else {
        tmy += tdy;
        ty += sy;
      }
      if (tx < 0 || ty < 0 || tx >= w || ty >= this.h) return true;
      if (this.opaque[ty * w + tx]) return true;
      if (tx === ex && ty === ey) return false;
    }
    return false;
  }
}
