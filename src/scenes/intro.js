// Bölüm açılış ekranı: siyah ekran, ortada büyük pixel yazı, altında küçük
// ipucu, üstte bölüm numarası. Arkada derin bir kükreme/gümbürtü.
// 2-3 saniye kalır, dokununca geçilir; sonra bölüm yavaşça aydınlanır.

import { drawText, wrapText, LINE_HEIGHT } from '../font.js';
import { ABILITY_INFO, FIRST_LEVEL_INTRO } from '../abilities.js';
import * as audio from '../audio.js';
import { prepareLevel } from './play.js';

const HOLD = 3.0; // yazının ekranda kalma süresi
const FADE_OUT = 0.6;

export class IntroScene {
  constructor(game, levelIndex, newAbility) {
    this.game = game;
    this.levelIndex = levelIndex;
    const info = levelIndex === 0 || !newAbility ? FIRST_LEVEL_INTRO : ABILITY_INFO[newAbility];
    this.title = info.title;
    this.hint = info.hint;
    this.t = 0;
    this.leaving = 0;
    this.sounded = false;
  }

  update(dt, taps) {
    this.t += dt;
    if (!this.sounded && this.t > 0.15) {
      this.sounded = true;
      audio.playRoar();
      audio.playStartRumble();
      this.game.shake(2, 0.6);
    }
    // yazı ekrandayken haritayı önceden çiz
    if (!this.prepared && this.t > 0.6) {
      this.prepared = true;
      prepareLevel(this.levelIndex);
    }
    if (this.leaving > 0) {
      this.leaving += dt;
      if (this.leaving > FADE_OUT) this.game.beginLevel(this.levelIndex);
      return;
    }
    if (this.t > HOLD || (taps.length && this.t > 0.4)) this.leaving = 0.001;
  }

  draw(ctx, w, h) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);
    const fadeIn = Math.min(1, this.t / 0.5);
    const fadeOut = this.leaving > 0 ? Math.max(0, 1 - this.leaving / FADE_OUT) : 1;
    const a = fadeIn * fadeOut;
    ctx.setTransform(1, 0, 0, 1, this.game.shakeX, this.game.shakeY);
    ctx.globalAlpha = a;
    const cx = Math.floor(w / 2);
    // büyük yazı: sığıyorsa 2 kat, değilse satırlara bölünür
    const size = w >= 280 ? 2 : 1;
    const lines = wrapText(this.title, w - 24, size);
    const lh = LINE_HEIGHT * size + 2;
    let y = Math.floor(h * 0.46 - (lines.length * lh) / 2);
    drawText(ctx, `Bölüm ${this.levelIndex + 1}`, cx, y - 22, { color: '#8f8270', align: 'center' });
    for (const line of lines) {
      drawText(ctx, line, cx, y, { color: '#d8c8a8', size, align: 'center', shadow: '#3a1010' });
      y += lh;
    }
    y += 10;
    const hintA = Math.min(1, Math.max(0, (this.t - 0.6) / 0.6));
    ctx.globalAlpha = a * hintA;
    for (const line of wrapText(this.hint, w - 24, 1)) {
      drawText(ctx, line, cx, y, { color: '#8a7e70', align: 'center' });
      y += LINE_HEIGHT + 1;
    }
    ctx.globalAlpha = 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
}
