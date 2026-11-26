// Ölüm ekranı: varsa jumpscare'den sonra. Başlık ("Gromm seni yakaladı" /
// "Açlıktan bayıldın" / "Dondun" / "Mağara çöktü"), altında ne kadar
// ilerlendiği ve süre. Ölünce oyun tamamen sıfırlanır: sonraki oyun 1.
// bölümden yeni bir özellik sırasıyla başlar, varsa kayıt silinir.

import { drawText, wrapText, LINE_HEIGHT } from '../font.js';
import * as save from '../save.js';

export const DEATH_TITLES = {
  gromm: ['Gromm seni yakaladı', '#c83a2a'],
  hunger: ['Açlıktan bayıldın', '#d8883a'],
  cold: ['Dondun', '#8ad0ff'],
  collapse: ['Mağara çöktü', '#c8a060'],
};

/** "14 dk" (1 dakikadan azsa "45 sn"). */
export function formatMinutes(sec) {
  sec = Math.max(0, sec || 0);
  return sec < 60 ? `${Math.floor(sec)} sn` : `${Math.floor(sec / 60)} dk`;
}

/** Sayıya Türkçe yönelme eki: 1'e, 2'ye, 6'ya ... */
function dative(n) {
  const last = n % 10;
  const suf = { 0: "'a", 1: "'e", 2: "'ye", 3: "'e", 4: "'e", 5: "'e", 6: "'ya", 7: "'ye", 8: "'e", 9: "'a" }[last];
  return `${n}${suf}`;
}

export class DeathScene {
  constructor(game, { cause = 'gromm', level = 0, time = 0 } = {}) {
    this.game = game;
    this.cause = cause;
    this.level = level;
    this.time = time;
    this.t = 0;
    this.leaving = 0;
    // her şey sıfırlanır
    save.clear();
    game.run = null;
  }

  update(dt, taps) {
    this.t += dt;
    if (this.leaving) {
      this.leaving += dt;
      if (this.leaving > 0.6) this.game.toMenu();
      return;
    }
    if (taps.length && this.t > 1.2) this.leaving = 0.001;
  }

  draw(ctx, w, h) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);
    const out = this.leaving ? Math.max(0, 1 - this.leaving / 0.6) : 1;
    const [title, color] = DEATH_TITLES[this.cause] || DEATH_TITLES.gromm;
    const cx = Math.floor(w / 2);
    const size = w > 300 ? 2 : 1;
    ctx.globalAlpha = Math.min(1, this.t / 0.5) * out;
    let y = Math.floor(h / 2 - 22);
    for (const line of wrapText(title, w - 16, size)) {
      drawText(ctx, line, cx, y, { color, size, align: 'center', shadow: '#1a0606' });
      y += LINE_HEIGHT * size + 2;
    }
    ctx.globalAlpha = Math.min(1, Math.max(0, (this.t - 0.5) / 0.5)) * out;
    y += 8;
    for (const line of wrapText(`Bölüm ${dative(this.level + 1)} kadar geldin. Süre: ${formatMinutes(this.time)}`, w - 20)) {
      drawText(ctx, line, cx, y, { color: '#a89a84', align: 'center' });
      y += LINE_HEIGHT + 1;
    }
    if (this.t > 1.2) {
      ctx.globalAlpha = out * (0.55 + 0.45 * Math.sin(this.t * 3));
      drawText(ctx, 'Ana menüye dönmek için dokun.', cx, h - 24, { color: '#7a7a7a', align: 'center' });
    }
    ctx.globalAlpha = 1;
  }
}
