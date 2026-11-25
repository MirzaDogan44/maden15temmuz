// "Başlamak için dokun" ekranı. Görseller burada yüklenir; ilk dokunuş ses
// sistemini başlatır ve oyuna geçer.

import { drawText, LINE_HEIGHT, textWidth } from '../font.js';
import * as audio from '../audio.js';

export class StartScene {
  constructor(game) {
    this.game = game;
    this.t = 0;
    this.loaded = 0;
    this.total = 1;
    this.ready = false;
    this.leaving = 0; // > 0 ise geçiş animasyonu sürüyor
  }

  setProgress(done, total) {
    this.loaded = done;
    this.total = total;
  }

  onPointerDown() {
    // Tarayıcının izin verdiği tek an: kullanıcı jesti.
    audio.init();
  }

  update(dt, taps) {
    this.t += dt;
    if (this.leaving > 0) {
      this.leaving += dt;
      if (this.leaving > 1.2) this.game.startPlay();
      return;
    }
    for (const tap of taps) {
      if (this.ready) {
        audio.playStartRumble();
        this.game.shake(3, 0.5);
        this.leaving = 0.001;
        break;
      }
    }
  }

  draw(ctx, w, h) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);
    ctx.setTransform(1, 0, 0, 1, this.game.shakeX, this.game.shakeY);

    const cx = Math.floor(w / 2);
    const titleSize = Math.max(2, Math.min(5, Math.floor(w / 70)));
    const titleY = Math.floor(h * 0.5) - titleSize * LINE_HEIGHT;

    this.drawEyes(ctx, cx, titleY - 18);

    const fade = this.leaving > 0 ? Math.max(0, 1 - this.leaving / 1.0) : 1;
    ctx.globalAlpha = fade;
    drawText(ctx, 'Gromm', cx, titleY, { color: '#8f7fa8', size: titleSize, align: 'center', shadow: '#1d1626' });

    const y2 = titleY + titleSize * LINE_HEIGHT + 14;
    if (!this.ready) {
      const bw = Math.min(120, w - 40);
      const p = this.total ? this.loaded / this.total : 0;
      ctx.fillStyle = '#2a2420';
      ctx.fillRect(cx - bw / 2, y2 + 4, bw, 3);
      ctx.fillStyle = '#c9a24a';
      ctx.fillRect(cx - bw / 2, y2 + 4, Math.round(bw * p), 3);
      drawText(ctx, 'Yükleniyor...', cx, y2 - 8, { color: '#6b6158', align: 'center' });
    } else if (this.leaving === 0 && Math.floor(this.t * 1.6) % 2 === 0) {
      const msg = 'Başlamak için dokun';
      const size = textWidth(msg) * 2 < w - 24 ? 2 : 1;
      drawText(ctx, msg, cx, y2, { color: '#d9c9a8', size, align: 'center' });
    }
    ctx.globalAlpha = 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  /** Karanlıkta yavaşça kırpışan iki göz. */
  drawEyes(ctx, cx, y) {
    const cycle = this.t % 4.5;
    const blink = cycle > 4.2; // kısa kırpma
    const open = this.leaving > 0 ? 1 : Math.min(1, this.t / 1.5);
    if (blink || open <= 0) return;
    const gap = 9;
    for (const side of [-1, 1]) {
      const ex = cx + side * gap;
      // Hafif parıltı (dithering): sadece dama tahtası pikselleri.
      ctx.fillStyle = `rgba(255, 170, 60, ${0.25 * open})`;
      for (let dy = -3; dy <= 3; dy++) {
        for (let dx = -4; dx <= 4; dx++) {
          if ((dx + dy) & 1) continue;
          if (dx * dx + dy * dy * 2 > 18) continue;
          ctx.fillRect(ex + dx, y + dy, 1, 1);
        }
      }
      ctx.fillStyle = `rgba(255, 214, 102, ${open})`;
      ctx.fillRect(ex - 2, y - 1, 4, 2);
      ctx.fillStyle = `rgba(255, 250, 210, ${open})`;
      ctx.fillRect(ex - 1, y - 1, 2, 1);
    }
  }
}
