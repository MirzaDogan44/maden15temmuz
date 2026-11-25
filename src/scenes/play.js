// Oyun sahnesi. Şimdilik (yol haritası 1. adım) sadece iskeleti test eder:
// geçici bir zemin, madencinin bekleme animasyonu ve tıklanan yerde işaret.
// Harita, yol bulma ve diğer sistemler sonraki adımlarda buraya eklenecek.

import { TILE } from '../config.js';
import { drawMiner } from '../assets.js';
import { drawText } from '../font.js';
import * as audio from '../audio.js';

export class PlayScene {
  constructor(game) {
    this.game = game;
    this.t = 0;
    this.dir = 'down';
    this.markers = [];
    this.fadeIn = 0;
  }

  update(dt, taps) {
    this.t += dt;
    this.fadeIn = Math.min(1, this.fadeIn + dt / 0.8);

    for (const tap of taps) {
      if (this.game.hud.handleTap(tap)) continue;
      this.markers.push({ x: tap.x, y: tap.y, t: 0 });
      this.faceToward(tap.x, tap.y);
      audio.playUiTap();
    }
    for (const m of this.markers) m.t += dt;
    this.markers = this.markers.filter((m) => m.t < 0.6);
  }

  faceToward(x, y) {
    const { width: w, height: h } = this.game.screen;
    const dx = x - w / 2;
    const dy = y - (h / 2 - 12);
    if (Math.abs(dx) > Math.abs(dy)) this.dir = dx < 0 ? 'left' : 'right';
    else this.dir = dy < 0 ? 'up' : 'down';
  }

  draw(ctx, w, h) {
    // Geçici zemin: koyu taş kareler (2. adımda gerçek tileset gelecek).
    for (let ty = 0; ty * TILE < h; ty++) {
      for (let tx = 0; tx * TILE < w; tx++) {
        const n = (tx * 73856093) ^ (ty * 19349663);
        const v = 18 + (Math.abs(n) % 6);
        ctx.fillStyle = `rgb(${v + 6}, ${v + 2}, ${v})`;
        ctx.fillRect(tx * TILE, ty * TILE, TILE, TILE);
        ctx.fillStyle = `rgb(${v - 4}, ${v - 6}, ${v - 8})`;
        ctx.fillRect(tx * TILE, ty * TILE, TILE, 1);
        ctx.fillRect(tx * TILE, ty * TILE, 1, TILE);
      }
    }

    // Tıklama işaretleri: küçülen bir elmas.
    for (const m of this.markers) {
      const k = 1 - m.t / 0.6;
      const r = Math.round(2 + 4 * k);
      ctx.fillStyle = '#e8c560';
      const x = Math.round(m.x);
      const y = Math.round(m.y);
      for (let i = -r; i <= r; i++) {
        const j = r - Math.abs(i);
        ctx.fillRect(x + i, y - j, 1, 1);
        ctx.fillRect(x + i, y + j, 1, 1);
      }
    }

    // Madenci ekranın ortasında.
    const mx = Math.floor(w / 2);
    const my = Math.floor(h / 2) + 4;
    if (!drawMiner(ctx, 'idle', this.dir, this.t, mx, my)) {
      // Görsel yoksa geçici şekil.
      ctx.fillStyle = '#c98a3a';
      ctx.fillRect(mx - 6, my - 20, 12, 20);
    }

    drawText(ctx, 'Bölüm 1', 6, 4, { color: '#d9c9a8', shadow: '#000' });
    drawText(ctx, 'İskelet hazır. Bir yere dokun.', 6, 16, { color: '#7d7368', shadow: '#000' });

    if (this.fadeIn < 1) {
      ctx.fillStyle = `rgba(0,0,0,${1 - this.fadeIn})`;
      ctx.fillRect(0, 0, w, h);
    }
  }
}
