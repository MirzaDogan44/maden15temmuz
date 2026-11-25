// 5. bölümden sonra: şimdilik "Final yakında" ekranı.

import { drawText, LINE_HEIGHT } from '../font.js';
import * as audio from '../audio.js';

export class FinaleScene {
  constructor(game) {
    this.game = game;
    this.t = 0;
  }

  update(dt, taps) {
    this.t += dt;
    if (this.t > 1.5 && taps.length) {
      audio.playUiTap();
      this.game.newRun();
      this.game.startLevel(0);
    }
  }

  draw(ctx, w, h) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = Math.min(1, this.t / 1.2);
    const cx = Math.floor(w / 2);
    const size = w > 300 ? 2 : 1;
    let y = Math.floor(h * 0.38);
    drawText(ctx, 'Madenden çıktın...', cx, y, { color: '#d8c8a8', size, align: 'center' });
    y += LINE_HEIGHT * size + 10;
    drawText(ctx, 'Final yakında.', cx, y, { color: '#c83a2a', size, align: 'center' });
    y += LINE_HEIGHT * size + 24;
    if (this.t > 1.5 && Math.floor(this.t * 1.6) % 2 === 0) {
      drawText(ctx, 'Baştan oynamak için dokun', cx, y, { color: '#8f8270', align: 'center' });
    }
    ctx.globalAlpha = 1;
  }
}
