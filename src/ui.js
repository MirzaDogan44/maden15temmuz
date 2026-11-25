// Ekran üstü butonlar. Butonlar ekranın sağ tarafında durur ve telefonda
// başparmakla rahat basılacak büyüklüktedir (en az 48 CSS piksel).

import * as audio from './audio.js';

// Piksel ikonlar ('#' dolu)
const ICONS = {
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
    this.buttons = [this.soundButton];
    this.layout();
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

  /** Tap bir butona denk geldiyse işler ve true döner. */
  handleTap(tap) {
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
  }
}
