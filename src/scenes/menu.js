// Ana menü: arka planda yavaşça yaşayan karanlık bir maden sahnesi (titreyen
// meşale, toz, ara sıra karanlıkta yanıp sönen kırmızı gözler, uzaktan güm
// sesi ve hafif sarsıntı), ortada taş oyma görünümlü "GROMM" başlığı ve
// büyük butonlar: Yeni Oyun, Devam Et (kayıt varsa), Ayarlar, Nasıl Oynanır.
// Menü müziği Web Audio ile çalar; oyun başlayınca yavaşça kısılır.

import { drawText, textWidth, wrapText, LINE_HEIGHT } from '../font.js';
import { images, TERRAIN } from '../assets.js';
import { drawMenu, hitMenu, settingsRows } from '../ui.js';
import { drawFlame } from './play.js';
import * as audio from '../audio.js';
import * as save from '../save.js';
import { formatMinutes } from './death.js';

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

/** Nasıl oynanır: kısa satırlar ve küçük pixel simgeler. */
const HOWTO = [
  ['tap', 'Bir yere dokun: madenci oraya yürür.'],
  ['pick', 'Cevhere dokun: madenci kazar.'],
  ['cage', 'Elinde tek şey taşırsın: cevheri asansöre götür.'],
  ['drop', 'Kazmak için meşaleyi Bırak butonuyla yere bırak.'],
  ['lever', 'Şalterleri indir: asansöre güç gelir.'],
  ['eye', 'Meşalesiz karanlıkta Gromm seni göremez.'],
  ['food', 'Ye ve meşale yanında ısın.'],
  ['run', "Koşmak için sağ tıkla (dokunmatikte çift dokun)."],
];
const HOWTO_ICONS = {
  tap: [['..#....', '..#....', '..###..', '..####.', '#.####.', '.#####.', '..###..'], '#e6d2a8'],
  pick: [['.####..', '#...##.', '...#.#.', '..#....', '.#.....', '#......', '.......'], '#b8b0a8'],
  cage: [['#######', '#.#.#.#', '#.#.#.#', '#.#.#.#', '#######', '.#...#.', '.#...#.'], '#8dff9a'],
  lever: [['.....#.', '....#..', '...#...', '.#####.', '.#...#.', '.#####.', '.......'], '#ff9a8a'],
  drop: [['..###..', '..###..', '#######', '.#####.', '..###..', '...#...', '#######'], '#ffb040'],
  eye: [['.......', '..###..', '.#...#.', '#..#..#', '.#...#.', '..###..', '.......'], '#ff3a2a'],
  food: [['..###..', '.#####.', '#######', '#.#.#.#', '.#####.', '.......', '.......'], '#e0a860'],
  run: [['....##.', '...###.', '..###..', '.######', '...###.', '..##...', '.##....'], '#ffd970'],
};

export class MenuScene {
  constructor(game) {
    this.game = game;
    this.t = 0;
    /** 'main' | 'settings' | 'howto' | 'confirm' */
    this.view = 'main';
    this.rects = [];
    this.leaving = 0;
    this.leaveTo = null;
    this.eyes = { t: 0, next: 3 + Math.random() * 3, x: 0, y: 0, on: 0 };
    this.thud = 6 + Math.random() * 6;
    this.dust = [];
    this.bg = null;
    this.title = null;
    this.saveInfo = save.peek();
    this.flame = { phase: Math.random() * 10, flick: 1, target: 1, timer: 0 };
    audio.startMenuMusic();
  }

  // ---------- akış ----------

  newGame() {
    if (save.peek()) {
      this.view = 'confirm';
      return;
    }
    this.leave(() => this.game.newGame());
  }

  continueGame() {
    this.leave(() => this.game.continueGame());
  }

  leave(fn) {
    if (this.leaving) return;
    this.leaving = 0.001;
    this.leaveTo = fn;
    audio.stopMenuMusic(1.8);
    audio.playStartRumble();
    this.game.shake(2.5, 0.5);
  }

  update(dt, taps) {
    this.t += dt;
    if (this.leaving) {
      this.leaving += dt;
      if (this.leaving > 1.2) this.leaveTo();
      return;
    }
    for (const tap of taps) hitMenu(this.rects, tap);
    // titreyen meşale
    const f = this.flame;
    f.timer -= dt;
    if (f.timer <= 0) {
      f.timer = 0.05 + Math.random() * 0.12;
      f.target = 0.8 + Math.random() * 0.25;
    }
    f.flick += (f.target - f.flick) * (1 - Math.exp(-18 * dt));
    // karanlıkta ara sıra beliren gözler
    const e = this.eyes;
    e.next -= dt;
    if (e.on > 0) {
      e.on -= dt;
    } else if (e.next <= 0) {
      e.on = 1.8 + Math.random() * 1.8;
      e.next = 5 + Math.random() * 6;
      e.x = 0.62 + Math.random() * 0.3;
      e.y = 0.45 + Math.random() * 0.4;
    }
    // uzaktan güm ve hafif sarsıntı
    this.thud -= dt;
    if (this.thud <= 0) {
      this.thud = 8 + Math.random() * 9;
      audio.playThud(650 + Math.random() * 200, Math.random() * 1.6 - 0.8);
      this.game.shake(1, 0.3);
    }
    // toz
    if (this.dust.length < 40 && Math.random() < dt * 12) this.dust.push({ x: Math.random(), y: Math.random(), vx: (Math.random() - 0.5) * 0.01, vy: -0.004 - Math.random() * 0.006, t: 0 });
    for (const d of this.dust) {
      d.t += dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
    }
    this.dust = this.dust.filter((d) => d.t < 8 && d.y > 0);
  }

  // ---------- çizim ----------

  draw(ctx, w, h) {
    ctx.setTransform(1, 0, 0, 1, this.game.shakeX, this.game.shakeY);
    this.drawBackdrop(ctx, w, h);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (this.view === 'main') this.drawMain(ctx, w, h);
    else if (this.view === 'settings') this.rects = drawMenu(ctx, this.game.screen, { title: 'Ayarlar', rows: settingsRows(() => (this.view = 'main')) });
    else if (this.view === 'howto') this.drawHowto(ctx, w, h);
    else if (this.view === 'confirm') {
      this.rects = drawMenu(ctx, this.game.screen, {
        title: 'Yeni Oyun',
        rows: [
          { kind: 'note', label: 'Kayıtlı oyunun silinecek. Emin misin?', color: '#e6d2a8' },
          { label: 'Evet, yeni oyun', primary: true, tap: () => { save.clear(); this.saveInfo = null; this.view = 'main'; this.leave(() => this.game.newGame()); } },
          { label: 'Vazgeç', tap: () => (this.view = 'main') },
        ],
      });
    }
    if (this.leaving) {
      ctx.fillStyle = `rgba(0,0,0,${Math.min(1, this.leaving / 1.1).toFixed(2)})`;
      ctx.fillRect(0, 0, w, h);
    }
  }

  drawMain(ctx, w, h) {
    const scr = this.game.screen;
    const bh = Math.max(scr.buttonSize, 18);
    const rows = [{ label: 'Yeni Oyun', primary: true, tap: () => this.newGame() }];
    if (this.saveInfo) rows.push({ label: 'Devam Et', tap: () => this.continueGame(), info: `Bölüm ${this.saveInfo.level + 1} · ${formatMinutes(this.saveInfo.time)}` });
    rows.push({ label: 'Ayarlar', tap: () => (this.view = 'settings') });
    rows.push({ label: 'Nasıl Oynanır', tap: () => (this.view = 'howto') });
    // butonlar altta, başlık üstte kalan boşluğun ortasında
    const listH = rows.length * (bh + 5) - 5 + (this.saveInfo ? 11 : 0);
    let y = h - listH - Math.max(8, Math.floor((h - listH) * 0.08));
    const title = this.titleCanvas(w, y - 12);
    const ty = Math.max(4, Math.floor((y - title.height) / 2) - 2);
    ctx.drawImage(title, Math.floor(w / 2 - title.width / 2), ty);
    const bw = Math.min(w - 32, 200);
    const x = Math.floor(w / 2 - bw / 2);
    this.rects = [];
    for (const r of rows) {
      if (r.info) {
        drawText(ctx, r.info, w / 2, y, { color: '#a89a84', align: 'center', shadow: '#000' });
        y += 11;
      }
      const rr = { x, y, w: bw, h: bh, tap: r.tap };
      this.rects.push(rr);
      ctx.fillStyle = 'rgba(8,6,6,0.85)';
      ctx.fillRect(x - 1, y - 1, bw + 2, bh + 2);
      ctx.fillStyle = r.primary ? 'rgba(74,46,20,0.92)' : 'rgba(40,33,28,0.9)';
      ctx.fillRect(x, y, bw, bh);
      ctx.fillStyle = r.primary ? '#a8743a' : '#5a4d42';
      ctx.fillRect(x, y, bw, 1);
      drawText(ctx, r.label, w / 2, y + Math.floor((bh - LINE_HEIGHT) / 2) + 1, { color: r.primary ? '#ffe0a0' : '#e6d2a8', align: 'center', shadow: '#000' });
      y += bh + 5;
    }
  }

  drawHowto(ctx, w, h) {
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(0, 0, w, h);
    const maxW = Math.min(w - 24, 300);
    const lines = HOWTO.map(([icon, text]) => ({ icon, lines: wrapText(text, maxW - 16) }));
    const scr = this.game.screen;
    const bh = Math.max(scr.buttonSize, 18);
    const total = 20 + lines.reduce((a, l) => a + l.lines.length * (LINE_HEIGHT + 1) + 4, 0) + bh + 8;
    let y = Math.max(4, Math.floor(h / 2 - total / 2));
    const x0 = Math.floor(w / 2 - maxW / 2);
    drawText(ctx, 'Nasıl Oynanır', w / 2, y, { color: '#e8c560', align: 'center', shadow: '#000' });
    y += 18;
    for (const l of lines) {
      const [px, col] = HOWTO_ICONS[l.icon];
      ctx.fillStyle = col;
      for (let r = 0; r < px.length; r++) for (let c = 0; c < px[r].length; c++) if (px[r][c] === '#') ctx.fillRect(x0 + c, y + r + 2, 1, 1);
      for (const line of l.lines) {
        drawText(ctx, line, x0 + 14, y, { color: '#e6d2a8', shadow: '#000' });
        y += LINE_HEIGHT + 1;
      }
      y += 4;
    }
    const bw = Math.min(w - 32, 160);
    const rr = { x: Math.floor(w / 2 - bw / 2), y: y + 2, w: bw, h: bh, tap: () => (this.view = 'main') };
    this.rects = [rr];
    ctx.fillStyle = '#2f2722';
    ctx.fillRect(rr.x, rr.y, rr.w, rr.h);
    ctx.fillStyle = '#5a4d42';
    ctx.fillRect(rr.x, rr.y, rr.w, 1);
    drawText(ctx, 'Geri', w / 2, rr.y + Math.floor((bh - LINE_HEIGHT) / 2) + 1, { color: '#e6d2a8', align: 'center' });
  }

  /** Taş oyma görünümlü büyük "GROMM" başlığı (bir kere çizilir). */
  titleCanvas(w, maxH = 999) {
    const size = Math.max(2, Math.min(10, Math.floor((w * 0.7) / textWidth('GROMM')), Math.floor((maxH - 4) / LINE_HEIGHT)));
    if (this.title && this.title.size === size) return this.title.canvas;
    const tw = textWidth('GROMM') * size, th = LINE_HEIGHT * size;
    const c = document.createElement('canvas');
    c.width = tw + size * 2;
    c.height = th + size * 2;
    const g = c.getContext('2d');
    drawText(g, 'GROMM', 0, 0, { color: '#fff', size });
    const id = g.getImageData(0, 0, c.width, c.height);
    const d = id.data, W = c.width;
    const solid = (x, y) => x >= 0 && y >= 0 && x < W && y < c.height && d[(y * W + x) * 4 + 3] > 0;
    const mask = new Uint8Array(W * c.height);
    for (let i = 0; i < mask.length; i++) mask[i] = d[i * 4 + 3] > 0 ? 1 : 0;
    const out = g.createImageData(W, c.height);
    const o = out.data;
    const hash = (x, y) => {
      let n = x * 374761393 + y * 668265263;
      n = (n ^ (n >>> 13)) * 1274126177;
      return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
    };
    const m = (x, y) => x >= 0 && y >= 0 && x < W && y < c.height && mask[y * W + x];
    for (let y = 0; y < c.height; y++) {
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        if (m(x, y)) {
          // taş dokusu: kaba gürültü + oyma kenarları
          const n = hash(x >> 1, y >> 1) * 0.6 + hash(x, y) * 0.4;
          let v = 96 + n * 50;
          if (!m(x, y - 1) || !m(x - 1, y)) v += 55; // üst/sol kenar ışık alır
          if (!m(x, y + 1) || !m(x + 1, y)) v -= 45; // alt/sağ kenar gölgede
          if (n > 0.9) v -= 40; // küçük çatlaklar
          o[i] = v * 0.92;
          o[i + 1] = v * 0.86;
          o[i + 2] = v * 0.98;
          o[i + 3] = 255;
        } else if (m(x - size / 2, y - size / 2) || m(x - 1, y - 1)) {
          // oyuk gölgesi
          o[i] = 6;
          o[i + 1] = 4;
          o[i + 2] = 8;
          o[i + 3] = 220;
        }
      }
    }
    g.clearRect(0, 0, W, c.height);
    g.putImageData(out, 0, 0);
    void solid;
    this.title = { size, canvas: c };
    return c;
  }

  /** Arka plan: duvar, meşale, karanlık ve ışık havuzu, toz, gözler. */
  drawBackdrop(ctx, w, h) {
    if (!this.bg || this.bg.w !== w || this.bg.h !== h) this.bg = this.buildBackdrop(w, h);
    const bg = this.bg;
    ctx.drawImage(bg.base, 0, 0);
    // titreyen ışık: hazır maskelerden biri
    const f = this.flame.flick;
    const k = Math.max(0, Math.min(bg.masks.length - 1, Math.round((f - 0.8) / 0.25 * (bg.masks.length - 1))));
    ctx.drawImage(bg.masks[k], 0, 0);
    drawFlame(ctx, bg.tx, bg.ty, this.t, this.flame.phase, f, 1.2);
    // toz (sadece ışığa yakın)
    for (const d of this.dust) {
      const x = d.x * w, y = d.y * h;
      const dist = Math.hypot(x - bg.tx, y - bg.ty) / bg.r;
      if (dist > 1) continue;
      ctx.fillStyle = `rgba(255,220,170,${((1 - dist) * 0.6 * Math.min(1, d.t)).toFixed(2)})`;
      ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
    // karanlıkta kırmızı gözler (arada göz kırpar)
    const e = this.eyes;
    if (e.on > 0) {
      const blink = Math.floor(e.on * 2.5) % 5 === 0;
      const a = Math.min(1, e.on / 0.4, (3.6 - e.on) / 0.4 + 1);
      if (!blink) {
        const ex = Math.round(e.x * w), ey = Math.round(e.y * h);
        ctx.fillStyle = `rgba(255,40,30,${(0.2 * a).toFixed(2)})`;
        for (let dy = -4; dy <= 4; dy++) for (let dx = -9; dx <= 9; dx++) if (!((dx + dy) & 1) && dx * dx + dy * dy * 3 < 70) ctx.fillRect(ex + dx, ey + dy, 1, 1);
        ctx.fillStyle = `rgba(255,60,40,${a.toFixed(2)})`;
        ctx.fillRect(ex - 5, ey, 3, 2);
        ctx.fillRect(ex + 3, ey, 3, 2);
        ctx.fillStyle = `rgba(255,220,190,${a.toFixed(2)})`;
        ctx.fillRect(ex - 4, ey, 1, 1);
        ctx.fillRect(ex + 4, ey, 1, 1);
      }
    }
  }

  buildBackdrop(w, h) {
    const base = document.createElement('canvas');
    base.width = w;
    base.height = h;
    const g = base.getContext('2d');
    g.imageSmoothingEnabled = false;
    const ground = images.get(TERRAIN.floor.src), rock = images.get(TERRAIN.wallFace.src);
    // dikey ekranda duvar aşağıda: başlık meşalenin üstüne binmesin
    const wallH = Math.max(64, Math.round((h * (h > w ? 0.56 : 0.34)) / 32) * 32);
    for (let y = 0; y < h; y += 32) {
      for (let x = 0; x < w; x += 32) {
        if (y < wallH) {
          if (rock) g.drawImage(rock, TERRAIN.wallFace.x, 0, 32, 32, x, y, 32, 32);
        } else if (ground) g.drawImage(ground, TERRAIN.floor.x, 0, 32, 32, x, y, 32, 32);
      }
    }
    // duvarın üstü karanlık, yüzü belirgin
    g.fillStyle = 'rgba(4,3,6,0.75)';
    g.fillRect(0, 0, w, wallH - 32);
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fillRect(0, wallH, w, 4);
    // meşale sapı
    const tx = Math.round(w * 0.12) + 8, ty = wallH - 22;
    g.fillStyle = '#1a0f08';
    g.fillRect(tx - 2, ty + 1, 4, 11);
    g.fillStyle = '#7a5230';
    g.fillRect(tx - 1, ty + 1, 2, 10);
    g.fillStyle = '#3a3a40';
    g.fillRect(tx - 3, ty + 7, 6, 2);
    // karanlık maskeleri: meşale çevresinde dithering'li ışık havuzu
    const r = Math.max(110, Math.min(w, h) * 0.55);
    const masks = [];
    for (const rk of [0.9, 0.95, 1, 1.05]) {
      const m = document.createElement('canvas');
      m.width = w;
      m.height = h;
      const mg = m.getContext('2d');
      const id = mg.createImageData(w, h);
      const d = id.data;
      const R = r * rk;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const dist = Math.hypot(x - tx, (y - ty) * 1.25);
          let v = Math.max(0, 1 - dist / R);
          v = Math.pow(v, 1.2) * 1.1 + 0.04;
          const L = 5;
          const q = Math.min(1, Math.floor(v * L + BAYER[((y & 3) << 2) | (x & 3)]) / L);
          const i = (y * w + x) * 4;
          // ışıkta sıcak ton, karanlıkta soğuk mor
          d[i] = q > 0.5 ? 40 : 6;
          d[i + 1] = q > 0.5 ? 18 : 4;
          d[i + 2] = q > 0.5 ? 0 : 14;
          d[i + 3] = Math.round(255 * (1 - q) * 0.97);
        }
      }
      mg.putImageData(id, 0, 0);
      masks.push(m);
    }
    return { w, h, base, masks, tx, ty, r };
  }
}
