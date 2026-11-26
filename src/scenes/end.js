// Oyunun sonu: asansör yükselir, aşağıda patlama... beyaz ekran kararır,
// "Kurtuldun." ve toplam süre. Ardından jenerik (asset sahipleri,
// assets/LICENSES.md'den) ve ana menüye dönüş.

import { drawText, wrapText, LINE_HEIGHT } from '../font.js';
import * as audio from '../audio.js';

/** Jenerik satırları. [yazı, tür] — tür: 'h' başlık, 'n' isim, 's' küçük not, '' boşluk */
export const CREDITS = [
  ['GROMM', 'h'],
  ['', ''],
  ['Madenci, zemin, dinamit ve efektler', 's'],
  ['Minerman Adventure - tumas81', 'n'],
  ['CC BY-ND 4.0', 's'],
  ['', ''],
  ['Gromm', 's'],
  ['Top-Down Boss Enemy - 10KStudios', 'n'],
  ['', ''],
  ['Mağara', 's'],
  ['Creepy Cave Tileset - smallmak', 'n'],
  ['Cave Objects - CraftPix.net', 'n'],
  ['Pixel Crawler - Anokolisa', 'n'],
  ['', ''],
  ['Sesler ve müzik', 's'],
  ['Web Audio ile kodla üretildi', 'n'],
  ['', ''],
  ['Oynadığın için teşekkürler.', 'n'],
];

export function formatTime(sec) {
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return m > 0 ? `${m} dk ${s} sn` : `${s} sn`;
}

export class EndScene {
  constructor(game, { time = 0 } = {}) {
    this.game = game;
    this.time = time;
    this.t = 0;
    this.leaving = 0;
    this.hideHud = true;
    audio.stopAmbience();
  }

  update(dt, taps) {
    this.t += dt;
    if (this.leaving) {
      this.leaving += dt;
      if (this.leaving > 0.8) this.game.toMenu();
      return;
    }
    // önce "Kurtuldun.", sonra jenerik akar; dokununca ilerler
    if (taps.length && this.t > 2) {
      if (this.t < 6) this.t = 6;
      else if (this.creditsDone) this.leaving = 0.001;
      else this.t += 4;
    }
  }

  draw(ctx, w, h) {
    // beyazdan siyaha
    const white = Math.max(0, 1 - this.t / 1.4);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);
    if (white > 0) {
      ctx.fillStyle = `rgba(255,248,235,${white.toFixed(2)})`;
      ctx.fillRect(0, 0, w, h);
    }
    const cx = Math.floor(w / 2);
    const out = this.leaving ? Math.max(0, 1 - this.leaving / 0.8) : 1;
    // "Kurtuldun." ve süre
    const a1 = Math.min(1, Math.max(0, (this.t - 1.6) / 1)) * Math.min(1, Math.max(0, (7.5 - this.t) / 1));
    if (a1 > 0) {
      ctx.globalAlpha = a1 * out;
      drawText(ctx, 'Kurtuldun.', cx, Math.floor(h / 2 - 20), { color: '#f0e0c0', size: w > 260 ? 3 : 2, align: 'center', shadow: '#3a2a1a' });
      drawText(ctx, `Toplam süre: ${formatTime(this.time)}`, cx, Math.floor(h / 2 + 14), { color: '#8a8070', align: 'center' });
    }
    // jenerik: aşağıdan yukarı akar
    const ct = this.t - 7.5;
    if (ct > 0) {
      const speed = 16;
      let y = h - ct * speed;
      for (const [text, kind] of CREDITS) {
        const size = kind === 'h' ? 3 : 1;
        const lines = text ? wrapText(text, w - 20, size) : [''];
        for (const line of lines) {
          if (y > -20 && y < h + 10 && line) {
            ctx.globalAlpha = out * Math.min(1, Math.max(0, Math.min(y / 30, (h - y) / 30)));
            drawText(ctx, line, cx, Math.round(y), { color: kind === 'h' ? '#c83a2a' : kind === 's' ? '#7a7066' : '#d8c8a8', size, align: 'center' });
          }
          y += LINE_HEIGHT * size + 2;
        }
        y += kind === '' ? 6 : 0;
      }
      if (y < h * 0.45) this.creditsDone = true;
    }
    if (this.creditsDone) {
      ctx.globalAlpha = out * (0.55 + 0.45 * Math.sin(this.t * 3));
      drawText(ctx, 'Ana menüye dönmek için dokun.', cx, h - 24, { color: '#7a7a7a', align: 'center' });
    }
    ctx.globalAlpha = 1;
  }
}
