// Yerden alınan eşyalar: sönük meşaleler ve erzak.
//
// Haritalarda ayrı bir karakterleri yok; bölüm açılırken bölümün tohumuyla
// (her denemede aynı yerlere) açık zemine dağıtılır. Bir kısmı Gromm'un
// dolaştığı açık alanlarda, bir kısmı karanlık bölgelerin yakınında olur.

import { TILE } from './config.js';

/**
 * Eşya yerleri seç.
 * kinds: [{ kind: 'torch', count: 5, darkBias: 0.4 }, ...]
 * Dönen liste: [{ kind, tx, ty, x, y }]
 */
export function placeItems(map, rng, kinds) {
  const reach = reachable(map);
  const blocked = new Set();
  const block = (tx, ty, r) => {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) blocked.add((ty + dy) * map.w + tx + dx);
  };
  // asansör, başlangıç ve etkileşimli nesnelerin çevresi boş kalsın
  const e = map.elevator;
  if (e) for (let y = e.ty - 3; y < e.ty + e.th + 4; y++) for (let x = e.tx - 3; x < e.tx + e.tw + 3; x++) blocked.add(y * map.w + x);
  block(Math.floor(map.start.x / TILE), Math.floor(map.start.y / TILE), 3);
  for (const o of map.ores) block(o.tx, o.ty, 1);
  for (const s of [...map.switches, ...map.stands, ...map.signs]) block(s.tx, s.ty + 1, 1);
  for (const d of map.decor) blocked.add(d.ty * map.w + d.tx);
  for (const r of map.rails) blocked.add(r.ty * map.w + r.tx);

  // aday kareler: kendisi ve 8 komşusu yürünebilir zemin
  const cand = [];
  for (let ty = 1; ty < map.h - 1; ty++) {
    for (let tx = 1; tx < map.w - 1; tx++) {
      const i = ty * map.w + tx;
      if (!reach[i] || blocked.has(i)) continue;
      let ok = true;
      for (let dy = -1; dy <= 1 && ok; dy++) for (let dx = -1; dx <= 1; dx++) if (map.isSolid(tx + dx, ty + dy)) ok = false;
      if (ok) cand.push({ tx, ty, dark: inZone(map, tx, ty) });
    }
  }
  const placed = [];
  const fixed = [{ tx: Math.floor(map.start.x / TILE), ty: Math.floor(map.start.y / TILE) }];
  if (e) fixed.push({ tx: e.tx + e.tw / 2, ty: e.ty + e.th });
  const out = [];
  for (const { kind, count, darkBias = 0.25 } of kinds) {
    for (let n = 0; n < count; n++) {
      // karanlık bölgeye mi açık alana mı?
      const wantDark = rng() < darkBias;
      let pool = cand.filter((c) => c.dark === wantDark);
      if (!pool.length) pool = cand;
      // birkaç rastgele aday içinden diğer eşyalara en uzak olanı
      let best = null, bestD = -1;
      for (let k = 0; k < 24 && pool.length; k++) {
        const c = pool[Math.floor(rng() * pool.length)];
        let d = 1e9;
        for (const p of placed) d = Math.min(d, Math.hypot(p.tx - c.tx, p.ty - c.ty));
        for (const p of fixed) d = Math.min(d, Math.hypot(p.tx - c.tx, p.ty - c.ty) * 1.4);
        d *= 0.85 + rng() * 0.3;
        if (d > bestD) {
          bestD = d;
          best = c;
        }
      }
      if (!best) break;
      placed.push(best);
      out.push({ kind, tx: best.tx, ty: best.ty, x: (best.tx + 0.5) * TILE, y: (best.ty + 0.6) * TILE });
      const i = cand.indexOf(best);
      if (i >= 0) cand.splice(i, 1);
    }
  }
  return out;
}

function inZone(map, tx, ty) {
  return map.darkZones.some((z) => tx >= z.x && ty >= z.y && tx < z.x + z.w && ty < z.y + z.h);
}

/** Başlangıçtan yürüyerek ulaşılabilen kareler. */
function reachable(map) {
  const seen = new Uint8Array(map.w * map.h);
  const sx = Math.floor(map.start.x / TILE), sy = Math.floor(map.start.y / TILE);
  const q = [sy * map.w + sx];
  seen[q[0]] = 1;
  while (q.length) {
    const i = q.pop();
    const x = i % map.w, y = (i / map.w) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= map.w || ny >= map.h) continue;
      const j = ny * map.w + nx;
      if (seen[j] || map.isSolid(nx, ny)) continue;
      seen[j] = 1;
      q.push(j);
    }
  }
  return seen;
}
