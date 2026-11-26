// Sol üst köşedeki küçük, yarı saydam minimap.
//
// Sadece mağaranın yapısını (yollar), oyuncunun konumunu (yanıp sönen nokta)
// ve asansörü (belirgin simge) gösterir. Karanlık bölgeler daha koyu.
// Cevherler, Gromm ve şalterler bilerek GÖSTERİLMEZ.
// Dokunmaları engellemez: üstüne dokunulursa dokunuş haritaya geçer.

import { TILE } from './config.js';

const FLOOR = [176, 160, 136];
const FLOOR_DARK = [70, 62, 84];
const EDGE = [96, 84, 70];

export class Minimap {
  constructor(map) {
    this.map = map;
    // 1 piksel = 1 tile
    const c = document.createElement('canvas');
    c.width = map.w + 4;
    c.height = map.h + 4;
    const g = c.getContext('2d');
    // çerçeve: koyu dış hat, ince açık iç hat, yarı saydam zemin
    g.fillStyle = 'rgba(10,8,12,0.85)';
    g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = 'rgba(120,100,80,0.6)';
    g.fillRect(1, 1, c.width - 2, 1);
    g.fillRect(1, c.height - 2, c.width - 2, 1);
    g.fillRect(1, 1, 1, c.height - 2);
    g.fillRect(c.width - 2, 1, 1, c.height - 2);
    g.fillStyle = 'rgba(14,11,16,0.9)';
    g.fillRect(2, 2, c.width - 4, c.height - 4);
    const id = g.getImageData(0, 0, c.width, c.height);
    const d = id.data;
    const inDark = (tx, ty) => map.darkZones.some((z) => tx >= z.x && ty >= z.y && tx < z.x + z.w && ty < z.y + z.h);
    for (let ty = 0; ty < map.h; ty++) {
      for (let tx = 0; tx < map.w; tx++) {
        if (map.isOpaque(tx, ty)) continue;
        // duvara komşu zemin biraz koyu: yolların kenarı belli olsun
        let edge = false;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (map.isOpaque(tx + dx, ty + dy)) edge = true;
        const col = inDark(tx, ty) ? FLOOR_DARK : edge ? EDGE : FLOOR;
        const i = ((ty + 2) * c.width + tx + 2) * 4;
        d[i] = col[0];
        d[i + 1] = col[1];
        d[i + 2] = col[2];
        d[i + 3] = 255;
      }
    }
    g.putImageData(id, 0, 0);
    this.canvas = c;
    const e = map.elevator;
    this.elevator = e ? { x: e.tx + e.tw / 2, y: e.ty + e.th / 2 } : null;
  }

  get width() {
    return this.canvas.width;
  }

  draw(ctx, x, y, player, t) {
    ctx.globalAlpha = 0.8;
    ctx.drawImage(this.canvas, x, y);
    ctx.globalAlpha = 1;
    // asansör: koyu çerçeveli yeşil kare ve yukarı ok
    if (this.elevator) {
      const ex = x + 2 + Math.round(this.elevator.x) - 3, ey = y + 2 + Math.round(this.elevator.y) - 3;
      ctx.fillStyle = '#0a1a0c';
      ctx.fillRect(ex - 1, ey - 1, 7, 7);
      ctx.fillStyle = '#5ce87a';
      ctx.fillRect(ex, ey, 5, 5);
      ctx.fillStyle = '#0a1a0c';
      ctx.fillRect(ex + 2, ey + 1, 1, 3);
      ctx.fillRect(ex + 1, ey + 2, 3, 1);
    }
    // final: patlatma noktaları (dinamitler gösterilmez)
    if (this.markers) {
      for (const m of this.markers) {
        const mx = x + 2 + m.tx, my = y + 2 + m.ty + 1;
        ctx.fillStyle = '#000';
        ctx.fillRect(mx - 2, my - 2, 5, 5);
        ctx.fillStyle = m.armed ? '#5ce87a' : '#ff3a2a';
        ctx.fillRect(mx - 1, my - 1, 1, 1);
        ctx.fillRect(mx + 1, my - 1, 1, 1);
        ctx.fillRect(mx, my, 1, 1);
        ctx.fillRect(mx - 1, my + 1, 1, 1);
        ctx.fillRect(mx + 1, my + 1, 1, 1);
      }
    }
    // oyuncu: yanıp sönen nokta
    const px = x + 2 + Math.floor(player.x / TILE), py = y + 2 + Math.floor(player.y / TILE);
    const on = Math.floor(t * 3) % 2 === 0;
    ctx.fillStyle = '#000';
    ctx.fillRect(px - 2, py - 2, 4, 4);
    ctx.fillStyle = on ? '#ffffff' : '#ffb030';
    ctx.fillRect(px - 1, py - 1, 2, 2);
  }
}
