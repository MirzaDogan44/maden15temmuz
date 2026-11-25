// Ekran üstü butonlar. Butonlar ekranın sağ tarafında durur ve telefonda
// başparmakla rahat basılacak büyüklüktedir (en az 48 CSS piksel).

import * as audio from './audio.js';
import * as settings from './settings.js';
import { drawText, textWidth, LINE_HEIGHT } from './font.js';

// Piksel ikonlar ('#' dolu)
const ICONS = {
  gear: ['...###...', '.#.###.#.', '..#####..', '###...###', '###...###', '###...###', '..#####..', '.#.###.#.', '...###...'],
  // şimşek: koşu
  sprint: ['....###', '...###.', '..###..', '.######', '...###.', '..###..', '.###...', '.#.....'],
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
    ctx.fillStyle = this.blocked ? COLORS.badIcon : this.active ? COLORS.activeIcon : COLORS.icon;
    for (let r = 0; r < icon.length; r++) {
      for (let c = 0; c < icon[r].length; c++) {
        if (icon[r][c] === '#') ctx.fillRect(ox + c * k, oy + r * k, k, k);
      }
    }
  }
}

/** Sağ kenardaki buton sütunu. */
export class Hud {
  constructor(screen) {
    this.screen = screen;
    this.soundButton = new Button({
      icon: () => (audio.isMuted() ? 'soundOff' : 'soundOn'),
      onTap: () => {
        audio.toggleMute();
        audio.playUiTap();
      },
    });
    this.settingsButton = new Button({
      icon: 'gear',
      onTap: () => {
        this.panelOpen = !this.panelOpen;
        audio.playUiTap();
      },
    });
    this.buttons = [this.soundButton, this.settingsButton];
    /** Ayarlar paneli açıkken oyun duraklar. */
    this.panelOpen = false;
    this.rows = [];
    this.layout();
  }

  /** Ayarlar panelindeki satırlar: etiket, değer, dokununca ne olacağı. */
  panelRows() {
    return [
      { label: 'Ses', value: audio.isMuted() ? 'Kapalı' : 'Açık', on: !audio.isMuted(), tap: () => audio.toggleMute() },
      { label: 'Jumpscare', value: settings.get('jumpscare') ? 'Açık' : 'Kapalı', on: settings.get('jumpscare'), tap: () => settings.set('jumpscare', !settings.get('jumpscare')) },
      { label: 'Kapat', value: '', close: true, tap: () => (this.panelOpen = false) },
    ];
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
    if (this.panelOpen) {
      for (const r of this.rows) {
        if (tap.x >= r.x && tap.x < r.x + r.w && tap.y >= r.y && tap.y < r.y + r.h) {
          r.tap();
          audio.playUiTap();
          return true;
        }
      }
      if (this.settingsButton.contains(tap.x, tap.y)) this.panelOpen = false;
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
    for (const b of this.buttons) b.draw(ctx);
    if (this.panelOpen) this.drawPanel(ctx);
  }

  drawPanel(ctx) {
    const W = this.screen.width, H = this.screen.height;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, W, H);
    const rowH = Math.max(this.screen.buttonSize, 18);
    const rows = this.panelRows();
    const pw = Math.min(W - 16, Math.max(150, ...rows.map((r) => textWidth(r.label + '  ' + r.value) + 40)));
    const ph = 26 + rows.length * (rowH + 4);
    const px = Math.floor(W / 2 - pw / 2), py = Math.floor(H / 2 - ph / 2);
    ctx.fillStyle = '#120f0d';
    ctx.fillRect(px - 1, py - 1, pw + 2, ph + 2);
    ctx.fillStyle = '#231d19';
    ctx.fillRect(px, py, pw, ph);
    ctx.fillStyle = '#5a4d42';
    ctx.fillRect(px, py, pw, 1);
    drawText(ctx, 'Ayarlar', px + pw / 2, py + 6, { color: '#e8c560', align: 'center', shadow: '#000' });
    this.rows = [];
    rows.forEach((r, i) => {
      const ry = py + 22 + i * (rowH + 4);
      const rr = { x: px + 6, y: ry, w: pw - 12, h: rowH, tap: r.tap };
      this.rows.push(rr);
      ctx.fillStyle = '#2f2722';
      ctx.fillRect(rr.x, rr.y, rr.w, rr.h);
      ctx.fillStyle = '#3d332c';
      ctx.fillRect(rr.x, rr.y, rr.w, 1);
      const ty = ry + Math.floor((rowH - LINE_HEIGHT) / 2);
      if (r.close) {
        drawText(ctx, r.label, rr.x + rr.w / 2, ty, { color: '#a89a84', align: 'center' });
        return;
      }
      drawText(ctx, r.label, rr.x + 6, ty, { color: '#e6d2a8' });
      drawText(ctx, r.value, rr.x + rr.w - 6, ty, { color: r.on ? '#8dff9a' : '#ff7a6a', align: 'right' });
    });
  }
}
