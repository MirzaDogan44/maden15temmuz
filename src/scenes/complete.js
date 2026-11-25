// "Bölüm tamamlandı" ekranı (şimdilik basit).

import { drawText, LINE_HEIGHT } from '../font.js';
import * as audio from '../audio.js';

export class CompleteScene {
  constructor(game, stats) {
    this.game = game;
    this.stats = stats;
    this.t = 0;
  }

  update(dt, taps) {
    this.t += dt;
    for (const tap of taps) {
      if (this.t > 1.2) {
        audio.playUiTap();
        this.game.nextLevel(this.stats.levelIndex);
        return;
      }
    }
  }

  draw(ctx, w, h) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);
    const a = Math.min(1, this.t / 1.2);
    ctx.globalAlpha = a;
    const cx = Math.floor(w / 2);
    const size = w > 300 ? 2 : 1;
    let y = Math.floor(h * 0.32);
    drawText(ctx, 'Bölüm tamamlandı', cx, y, { color: '#e8c560', size, align: 'center', shadow: '#2a1c08' });
    y += size * LINE_HEIGHT + 14;
    const s = this.stats;
    const mm = Math.floor(s.time / 60), ss = Math.floor(s.time % 60);
    drawText(ctx, `Asansöre yüklenen cevher: ${s.loaded}`, cx, y, { color: '#cdbb98', align: 'center' });
    y += 14;
    drawText(ctx, `Süre: ${mm}:${String(ss).padStart(2, '0')}`, cx, y, { color: '#cdbb98', align: 'center' });
    y += 26;
    if (this.t > 1.2 && Math.floor(this.t * 1.6) % 2 === 0) {
      drawText(ctx, 'Devam etmek için dokun', cx, y, { color: '#8f8270', align: 'center' });
    }
    ctx.globalAlpha = 1;
  }
}
