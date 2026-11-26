// Bölüm açılış ekranı (CLAUDE.md > Bölüm açılış ekranları):
// tamamen siyah, her şey ortada. Üstte "Bölüm N/6", ortada Gromm'un kuralları
// ("GROMM [DUYABİLİR]", anahtar kelime kırmızı). Eski kurallar soluk, yeni kural
// en altta titreyerek belirir. Solunda kırmızı gözlü küçük bir Gromm kafası.
// Altta "Devam etmek için dokun."; dokununca gümbürtüyle bölüm aydınlanır.

import { drawText, textWidth, LINE_HEIGHT } from '../font.js';
import { ABILITY_INFO, BASE_RULE, FINAL_RULE } from '../abilities.js';
import * as audio from '../audio.js';
import { prepareLevel } from './play.js';

/** Toplam bölüm sayısı (final dahil). */
export const TOTAL_LEVELS = 6;
const FADE_OUT = 0.7;
/** Yeni kuralın belirmeye başladığı ve tamamlandığı an (sn) */
const APPEAR_START = 0.9;
const APPEAR_END = 1.7;

// Gromm kafası: 11x9 pixel art. b gövde, d koyu, l açık, e göz, t diş
const HEAD = [
  '.d.......d.',
  '.dd.d.d.dd.',
  '..bbbbbbb..',
  '.bllbbbllb.',
  'bbeebbbeebb',
  'bbbbbdbbbbb',
  '.bdtdtdtdb.',
  '..bdddddb..',
  '...bbbbb...',
];
const HEAD_COLORS = { b: '#4e4060', d: '#2c2238', l: '#6c5c80', e: '#ff2a1a', t: '#d8d0c0' };

function drawHead(ctx, x, y, size, alpha, eyeGlow) {
  for (let r = 0; r < HEAD.length; r++) {
    for (let c = 0; c < HEAD[r].length; c++) {
      const ch = HEAD[r][c];
      if (ch === '.') continue;
      ctx.globalAlpha = ch === 'e' ? Math.min(1, alpha * eyeGlow) : alpha;
      ctx.fillStyle = HEAD_COLORS[ch];
      ctx.fillRect(x + c * size, y + r * size, size, size);
    }
  }
  // göz parıltısı
  ctx.globalAlpha = alpha * 0.25 * eyeGlow;
  ctx.fillStyle = '#ff3020';
  ctx.fillRect(x + 1 * size, y + 3 * size, 4 * size, 3 * size);
  ctx.fillRect(x + 6 * size, y + 3 * size, 4 * size, 3 * size);
  ctx.globalAlpha = 1;
}

/** Bu bölümün kural listesi (son eleman yeni kural). */
export function rulesFor(levelIndex, abilities) {
  const rules = [BASE_RULE];
  for (const a of abilities) if (ABILITY_INFO[a]) rules.push(ABILITY_INFO[a]);
  if (levelIndex >= TOTAL_LEVELS - 1) rules.push(FINAL_RULE);
  return rules;
}

export class IntroScene {
  constructor(game, levelIndex) {
    this.game = game;
    this.levelIndex = levelIndex;
    this.rules = rulesFor(levelIndex, game.abilities(levelIndex));
    this.t = 0;
    this.leaving = 0;
    this.sounded = false;
    this.flick = 1;
  }

  update(dt, taps) {
    this.t += dt;
    if (!this.sounded && this.t > APPEAR_START) {
      this.sounded = true;
      audio.playRoar();
      this.game.shake(1.5, 0.4);
    }
    // yeni kural titreyerek belirir
    if (this.t < APPEAR_END) this.flick = this.t < APPEAR_START ? 0 : Math.random() < 0.35 + 0.65 * ((this.t - APPEAR_START) / (APPEAR_END - APPEAR_START)) ? 1 : 0.15;
    else this.flick = 1;
    // yazı ekrandayken haritayı önceden çiz
    if (!this.prepared && this.t > 0.4) {
      this.prepared = true;
      prepareLevel(this.levelIndex);
    }
    if (this.leaving > 0) {
      this.leaving += dt;
      if (this.leaving > FADE_OUT) this.game.beginLevel(this.levelIndex);
      return;
    }
    if (taps.length && this.t > 0.6) {
      this.leaving = 0.001;
      if (!this.prepared) {
        this.prepared = true;
        prepareLevel(this.levelIndex);
      }
      audio.playStartRumble();
      this.game.shake(3, 0.7);
    }
  }

  draw(ctx, w, h) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);
    const fadeIn = Math.min(1, this.t / 0.5);
    const fadeOut = this.leaving > 0 ? Math.max(0, 1 - this.leaving / FADE_OUT) : 1;
    const a = fadeIn * fadeOut;
    ctx.setTransform(1, 0, 0, 1, this.game.shakeX, this.game.shakeY);
    const cx = Math.floor(w / 2);

    // ölçek: en uzun kural sığıyorsa 2 kat
    const lineW = (r, s) => HEAD[0].length * s + 6 * s + textWidth(r.subject + ' ' + r.key) * s;
    let size = 2;
    const fits = (s) => Math.max(...this.rules.map((r) => lineW(r, s))) <= w - 16 && this.rules.length * (LINE_HEIGHT * s + 6) <= h - 70;
    if (!fits(2)) size = 1;
    const lh = LINE_HEIGHT * size + 6 * size;
    const blockW = Math.max(...this.rules.map((r) => lineW(r, size)));
    const blockH = this.rules.length * lh - 6 * size;
    const x0 = Math.round(cx - blockW / 2);
    let y = Math.round(h * 0.5 - blockH / 2);

    ctx.globalAlpha = a;
    drawText(ctx, `Bölüm ${this.levelIndex + 1}/${TOTAL_LEVELS}`, cx, y - 16 - 4 * size, { color: '#7a7a7a', align: 'center' });

    const last = this.rules.length - 1;
    this.rules.forEach((r, i) => {
      const isNew = i === last;
      const alpha = isNew ? a * this.flick : a * 0.38;
      if (alpha <= 0.01) {
        y += lh;
        return;
      }
      // yeni kural belirirken hafifçe titrer
      const jitter = isNew && this.t < APPEAR_END ? Math.round((Math.random() - 0.5) * 2 * size) : 0;
      const hx = x0 + jitter;
      const glow = isNew ? 0.8 + 0.2 * Math.sin(this.t * 5) : 0.5;
      drawHead(ctx, hx, y + (LINE_HEIGHT * size - HEAD.length * size) / 2 + size, size, alpha, glow);
      const tx = hx + HEAD[0].length * size + 6 * size;
      const subj = r.subject + ' ';
      ctx.globalAlpha = alpha;
      drawText(ctx, subj, tx, y, { color: isNew ? '#ffffff' : '#bbbbbb', size, shadow: isNew ? '#202020' : null });
      const kx = tx + (textWidth(subj) + 1) * size + size * 2;
      drawText(ctx, r.key, kx, y, { color: isNew ? '#ff2a1a' : '#8a2a22', size, shadow: isNew ? '#3a0606' : null });
      y += lh;
    });

    // altta: devam et
    if (this.t > APPEAR_END && !this.leaving) {
      const blink = 0.55 + 0.45 * Math.sin((this.t - APPEAR_END) * 3);
      ctx.globalAlpha = a * Math.min(1, (this.t - APPEAR_END) / 0.4) * blink;
      drawText(ctx, 'Devam etmek için dokun.', cx, h - 24, { color: '#7a7a7a', align: 'center' });
    }
    ctx.globalAlpha = 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
}
