// Ekran üstü butonlar. Butonlar ekranın sağ tarafında durur ve telefonda
// başparmakla rahat basılacak büyüklüktedir (en az 48 CSS piksel).

import * as audio from './audio.js';
import * as settings from './settings.js';
import { storageOk } from './save.js';
import { drawText, textWidth, LINE_HEIGHT } from './font.js';

// Piksel ikonlar ('#' dolu)
const ICONS = {
  gear: ['...###...', '.#.###.#.', '..#####..', '###...###', '###...###', '###...###', '..#####..', '.#.###.#.', '...###...'],
  // şimşek: koşu
  sprint: ['....###', '...###.', '..###..', '.######', '...###.', '..###..', '.###...', '.#.....'],
  // meşale: yanan / sönük
  torch: ['....#....', '...##....', '..####...', '..#####..', '...###...', '....#....', '....#....', '....#....', '....#....', '....#....'],
  torchOff: ['.....#...', '...#.....', '....#....', '.........', '...###...', '....#....', '....#....', '....#....', '....#....', '....#....'],
  pause: ['##..##', '##..##', '##..##', '##..##', '##..##', '##..##', '##..##'],
  soundOn: ['...#.....', '..##.#...', '####..#..', '####..#..', '####..#..', '..##.#...', '...#.....'],
  soundOff: ['...#.....', '..##.....', '####.#.#.', '####..#..', '####.#.#.', '..##.....', '...#.....'],
};

const COLORS = {
  face: '#2a2420',
  faceDown: '#3b322b',
  edgeLight: '#5a4d42',
  edgeDark: '#120f0d',
  icon: '#d9c9a8',
  activeFace: '#5a3512',
  activeEdge: '#e8a040',
  activeIcon: '#ffe6a0',
  badFace: '#3a1210',
  badIcon: '#e05040',
};

export class Button {
  constructor({ icon, onTap }) {
    this.icon = icon;
    this.onTap = onTap;
    this.x = 0;
    this.y = 0;
    this.size = 16;
    this.flash = 0;
    /** Açık (ör. sprint açık) */
    this.active = false;
    /** Kullanılamaz (ör. dayanıklılık bitti); kırmızı yanıp söner */
    this.blocked = false;
    this.t = 0;
  }

  contains(px, py) {
    return px >= this.x && py >= this.y && px < this.x + this.size && py < this.y + this.size;
  }

  draw(ctx) {
    const { x, y, size: s } = this;
    const blink = this.blocked && Math.floor(this.t * 5) % 2 === 0;
    ctx.fillStyle = this.active ? COLORS.activeEdge : COLORS.edgeDark;
    ctx.fillRect(x, y, s, s);
    ctx.fillStyle = blink ? COLORS.badFace : this.active ? COLORS.activeFace : this.flash > 0 ? COLORS.faceDown : COLORS.face;
    ctx.fillRect(x + 1, y + 1, s - 2, s - 2);
    ctx.fillStyle = this.active ? COLORS.activeEdge : COLORS.edgeLight;
    ctx.fillRect(x + 1, y + 1, s - 2, 1);
    ctx.fillRect(x + 1, y + 1, 1, s - 2);
    if (this.active) {
      ctx.fillStyle = COLORS.edgeDark;
      ctx.fillRect(x + 2, y + s - 3, s - 4, 1);
    }

    const icon = ICONS[typeof this.icon === 'function' ? this.icon() : this.icon];
    const k = Math.max(1, Math.floor((s - 4) / 12));
    const iw = icon[0].length * k;
    const ih = icon.length * k;
    const ox = x + Math.floor((s - iw) / 2);
    const oy = y + Math.floor((s - ih) / 2);
    ctx.fillStyle = this.blocked ? COLORS.badIcon : this.active ? COLORS.activeIcon : this.dim ? '#6a5e50' : COLORS.icon;
    for (let r = 0; r < icon.length; r++) {
      for (let c = 0; c < icon[r].length; c++) {
        if (icon[r][c] === '#') ctx.fillRect(ox + c * k, oy + r * k, k, k);
      }
    }
  }
}

/**
 * Ekranın ortasında, oyunun kendi çizdiği bir menü paneli.
 * rows: [{ label, value?, on?, tap?, kind: 'button' | 'toggle' | 'note' | 'title' }]
 * Dönen dizi dokunma alanlarıdır (hitMenu ile kullanılır).
 */
export function drawMenu(ctx, screen, { title = '', subtitle = '', rows, dim = 0.7 }) {
  const W = screen.width, H = screen.height;
  if (dim) {
    ctx.fillStyle = `rgba(0,0,0,${dim})`;
    ctx.fillRect(0, 0, W, H);
  }
  const rowH = Math.max(screen.buttonSize, 18);
  const noteH = LINE_HEIGHT + 2;
  const textW = Math.max(...rows.map((r) => textWidth(r.label + (r.value ? '   ' + r.value : '')) + 28), title ? textWidth(title) + 20 : 0, subtitle ? textWidth(subtitle) + 20 : 0);
  const pw = Math.min(W - 16, Math.max(170, textW));
  const heights = rows.map((r) => (r.kind === 'note' ? noteH : rowH));
  const ph = (title ? 24 : 8) + (subtitle ? 12 : 0) + heights.reduce((a, b) => a + b + 4, 0) + 4;
  const px = Math.floor(W / 2 - pw / 2), py = Math.max(4, Math.floor(H / 2 - ph / 2));
  ctx.fillStyle = '#0d0a09';
  ctx.fillRect(px - 2, py - 2, pw + 4, ph + 4);
  ctx.fillStyle = '#211b17';
  ctx.fillRect(px, py, pw, ph);
  ctx.fillStyle = '#5a4d42';
  ctx.fillRect(px, py, pw, 1);
  let y = py + 6;
  if (title) {
    drawText(ctx, title, px + pw / 2, y, { color: '#e8c560', align: 'center', shadow: '#000' });
    y += 16;
  }
  if (subtitle) {
    drawText(ctx, subtitle, px + pw / 2, y - 2, { color: '#8a7e70', align: 'center' });
    y += 12;
  }
  const rects = [];
  rows.forEach((r, i) => {
    const h = heights[i];
    if (r.kind === 'note') {
      for (const line of [r.label]) drawText(ctx, line, px + pw / 2, y + 1, { color: r.color || '#a08a70', align: 'center' });
      y += h + 4;
      return;
    }
    const rr = { x: px + 6, y, w: pw - 12, h, tap: r.tap };
    rects.push(rr);
    ctx.fillStyle = '#0f0c0a';
    ctx.fillRect(rr.x - 1, rr.y - 1, rr.w + 2, rr.h + 2);
    ctx.fillStyle = r.primary ? '#4a2e14' : '#2f2722';
    ctx.fillRect(rr.x, rr.y, rr.w, rr.h);
    ctx.fillStyle = r.primary ? '#a8743a' : '#4a3f36';
    ctx.fillRect(rr.x, rr.y, rr.w, 1);
    const ty = y + Math.floor((h - LINE_HEIGHT) / 2) + 1;
    if (r.kind === 'toggle') {
      drawText(ctx, r.label, rr.x + 8, ty, { color: '#e6d2a8' });
      drawText(ctx, r.value, rr.x + rr.w - 8, ty, { color: r.on ? '#8dff9a' : '#ff7a6a', align: 'right' });
    } else {
      drawText(ctx, r.label, rr.x + rr.w / 2, ty, { color: r.disabled ? '#6a5e50' : r.primary ? '#ffe0a0' : '#e6d2a8', align: 'center', shadow: '#000' });
    }
    y += h + 4;
  });
  return rects;
}

/** Bir dokunuş menü satırına geldiyse işler ve true döner. */
export function hitMenu(rects, tap) {
  for (const r of rects) {
    if (tap.x >= r.x && tap.x < r.x + r.w && tap.y >= r.y && tap.y < r.y + r.h) {
      audio.playUiTap();
      if (r.tap) r.tap();
      return true;
    }
  }
  return false;
}

/** Ayarlar: müzik, ses efektleri, jumpscare (her zaman hatırlanır). */
export function settingsRows(onBack) {
  const toggle = (name, label, apply) => ({
    kind: 'toggle',
    label,
    value: settings.get(name) ? 'Açık' : 'Kapalı',
    on: settings.get(name),
    tap: () => {
      settings.set(name, !settings.get(name));
      if (apply) apply(settings.get(name));
    },
  });
  return [
    toggle('music', 'Müzik', (v) => audio.setBus('music', v)),
    toggle('sfx', 'Ses efektleri', (v) => audio.setBus('sfx', v)),
    toggle('jumpscare', 'Jumpscare'),
    { label: 'Geri', tap: onBack },
  ];
}

/**
 * Oyun içi arayüz: sağ üstte ses ve duraklatma ("II") butonları.
 * Duraklatma menüsü: Devam Et, Ayarlar, (Gazeteyi Oku), Kaydet ve Çık.
 * Menü açıkken oyun duraklar.
 */
export class Hud {
  constructor(game) {
    this.game = game;
    this.screen = game.screen;
    this.soundButton = new Button({
      icon: () => (audio.isMuted() ? 'soundOff' : 'soundOn'),
      onTap: () => {
        audio.toggleMute();
        audio.playUiTap();
      },
    });
    this.pauseButton = new Button({ icon: 'pause', onTap: () => this.open('pause') });
    this.buttons = [this.soundButton, this.pauseButton];
    /** null | 'pause' | 'settings' */
    this.panel = null;
    this.rects = [];
    this.layout();
  }

  get panelOpen() {
    return !!this.panel;
  }

  open(panel) {
    this.panel = panel;
    audio.playUiTap();
    const sc = this.game.scene;
    if (panel && sc.onPause) sc.onPause();
  }

  close() {
    this.panel = null;
  }

  rows() {
    const g = this.game;
    if (this.panel === 'settings') return { title: 'Ayarlar', rows: settingsRows(() => (this.panel = 'pause')) };
    const rows = [
      { label: 'Devam Et', primary: true, tap: () => this.close() },
      { label: 'Ayarlar', tap: () => (this.panel = 'settings') },
    ];
    if (g.run && g.run.newspaper && g.scene.openNewspaper) rows.push({ label: 'Gazeteyi Oku', tap: () => { this.close(); g.scene.openNewspaper(); } });
    if (storageOk) rows.push({ label: 'Kaydet ve Çık', tap: () => { this.close(); g.saveAndQuit(); } });
    else {
      rows.push({ label: 'Ana Menüye Dön', tap: () => { this.close(); g.quitToMenu(); } });
      rows.push({ kind: 'note', label: 'İlerleme bu tarayıcıda kaydedilemiyor.' });
    }
    return { title: 'Duraklatıldı', rows };
  }

  layout() {
    const s = this.screen.buttonSize;
    const m = Math.max(4, Math.round(s / 4));
    let y = m;
    for (const b of this.buttons) {
      b.size = s;
      b.x = this.screen.width - s - m;
      b.y = y;
      y += s + m;
    }
  }

  /** Tap bir butona denk geldiyse işler ve true döner. Panel açıksa her tap'i alır. */
  handleTap(tap) {
    if (this.panel) {
      hitMenu(this.rects, tap);
      return true;
    }
    for (const b of this.buttons) {
      if (b.contains(tap.x, tap.y)) {
        b.flash = 0.12;
        b.onTap();
        return true;
      }
    }
    return false;
  }

  update(dt) {
    for (const b of this.buttons) {
      b.flash = Math.max(0, b.flash - dt);
      b.t += dt;
    }
  }

  draw(ctx) {
    this.layout();
    for (const b of this.buttons) b.draw(ctx);
    if (this.panel) this.rects = drawMenu(ctx, this.screen, this.rows());
  }
}
