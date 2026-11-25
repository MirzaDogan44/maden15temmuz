// A* yol bulma ve yol sadeleştirme.
//
// 1) Hedef kare yürünemiyorsa (duvar, engel, harita dışı) madencinin
//    ulaşabildiği en yakın kare seçilir.
// 2) 8 yönlü A* ile kare kare yol bulunur. Çapraz adım, iki yanındaki kare de
//    boşsa yapılır (duvar köşesinden geçilmez).
// 3) Kare merkezlerinden oluşan zikzaklı yol, madencinin gövdesi sığacak
//    şekilde düz çizgilerle sadeleştirilir.

import { TILE } from './config.js';

/** Sadeleştirmede duvarlardan bırakılacak pay (madencinin ayak kutusundan biraz geniş). */
const DEFAULT_BOX = [6, 5, 4];

const SQRT2 = Math.SQRT2;
const DIRS = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, SQRT2], [1, -1, SQRT2], [-1, 1, SQRT2], [-1, -1, SQRT2],
];

class MinHeap {
  constructor() {
    this.items = [];
    this.keys = [];
  }
  get size() {
    return this.items.length;
  }
  push(item, key) {
    const a = this.items, k = this.keys;
    let i = a.length;
    a.push(item);
    k.push(key);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (k[p] <= key) break;
      a[i] = a[p];
      k[i] = k[p];
      i = p;
    }
    a[i] = item;
    k[i] = key;
  }
  pop() {
    const a = this.items, k = this.keys;
    const top = a[0];
    const lastItem = a.pop(), lastKey = k.pop();
    if (a.length) {
      let i = 0;
      const n = a.length;
      for (;;) {
        let c = 2 * i + 1;
        if (c >= n) break;
        if (c + 1 < n && k[c + 1] < k[c]) c++;
        if (k[c] >= lastKey) break;
        a[i] = a[c];
        k[i] = k[c];
        i = c;
      }
      a[i] = lastItem;
      k[i] = lastKey;
    }
    return top;
  }
}

/** Başlangıç karesinden ulaşılabilen kareler (4 komşuluk yeterli). */
function reachable(map, start) {
  const seen = new Uint8Array(map.w * map.h);
  const q = [start];
  seen[start] = 1;
  while (q.length) {
    const i = q.pop();
    const x = i % map.w, y = (i / map.w) | 0;
    for (const [dx, dy] of DIRS.slice(0, 4)) {
      const nx = x + dx, ny = y + dy;
      if (!map.isWalkable(nx, ny)) continue;
      const j = ny * map.w + nx;
      if (!seen[j]) {
        seen[j] = 1;
        q.push(j);
      }
    }
  }
  return seen;
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Bir kare içinde (gx, gy)'ye en yakın, madencinin sığdığı nokta. */
function settlePoint(map, tx, ty, gx, gy, box) {
  const m = 7;
  let x = clamp(gx, tx * TILE + (map.isSolid(tx - 1, ty) ? m : 0), (tx + 1) * TILE - (map.isSolid(tx + 1, ty) ? m : 0.01));
  let y = clamp(gy, ty * TILE + (map.isSolid(tx, ty - 1) ? m : 0), (ty + 1) * TILE - (map.isSolid(tx, ty + 1) ? 6 : 0.01));
  const cx = (tx + 0.5) * TILE, cy = (ty + 0.5) * TILE;
  for (let k = 0; k < 12 && map.boxBlocked(x, y, box[0], box[1], box[2]); k++) {
    x += (cx - x) * 0.35;
    y += (cy - y) * 0.35;
  }
  return { x, y };
}

/** (a -> b) doğrusu boyunca madencinin gövdesi duvara değmeden geçebilir mi? */
export function segmentClear(map, ax, ay, bx, by, box = DEFAULT_BOX) {
  const len = Math.hypot(bx - ax, by - ay);
  const steps = Math.max(1, Math.ceil(len / 3));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    if (map.boxBlocked(ax + (bx - ax) * t, ay + (by - ay) * t, box[0], box[1], box[2])) return false;
  }
  return true;
}

/**
 * (sx, sy) noktasından (gx, gy)'ye giden yolu bulur.
 * Dönen değer: { points: [{x,y}, ...], target: {x,y}, exact: bool } veya null.
 * points başlangıç noktasını içermez, son eleman hedeftir.
 *
 * opts.box: sadeleştirmede kullanılan gövde payı [rx, yukarı, aşağı]
 * opts.wallCost: duvara bitişik karelere eklenen maliyet (büyük yaratıklar
 *   tünelin ortasından yürüsün diye)
 */
export function findPath(map, sx, sy, gx, gy, opts = {}) {
  const box = opts.box || DEFAULT_BOX;
  const wallCost = opts.wallCost || 0;
  const W = map.w, H = map.h;
  let stx = Math.floor(sx / TILE), sty = Math.floor(sy / TILE);
  if (!map.isWalkable(stx, sty)) return null;
  const start = sty * W + stx;
  const reach = reachable(map, start);

  // Hedef kareyi seç.
  let gtx = Math.floor(gx / TILE), gty = Math.floor(gy / TILE);
  let exact = map.inBounds(gtx, gty) && reach[gty * W + gtx] === 1;
  if (!exact) {
    let best = -1, bestD = Infinity;
    for (let i = 0; i < W * H; i++) {
      if (!reach[i]) continue;
      const x = i % W, y = (i / W) | 0;
      const nx = clamp(gx, x * TILE, (x + 1) * TILE), ny = clamp(gy, y * TILE, (y + 1) * TILE);
      const dd = (nx - gx) ** 2 + (ny - gy) ** 2;
      if (dd < bestD) {
        bestD = dd;
        best = i;
      }
    }
    if (best < 0) return null;
    gtx = best % W;
    gty = (best / W) | 0;
  }
  const target = settlePoint(map, gtx, gty, gx, gy, box);
  const goal = gty * W + gtx;

  // A*
  const gScore = new Float32Array(W * H).fill(Infinity);
  const came = new Int32Array(W * H).fill(-1);
  const closed = new Uint8Array(W * H);
  const h = (i) => {
    const dx = Math.abs((i % W) - gtx), dy = Math.abs(((i / W) | 0) - gty);
    return dx + dy + (SQRT2 - 2) * Math.min(dx, dy);
  };
  const open = new MinHeap();
  gScore[start] = 0;
  open.push(start, h(start));
  let found = start === goal;
  while (open.size && !found) {
    const cur = open.pop();
    if (closed[cur]) continue;
    closed[cur] = 1;
    if (cur === goal) {
      found = true;
      break;
    }
    const x = cur % W, y = (cur / W) | 0;
    for (const [dx, dy, cost] of DIRS) {
      const nx = x + dx, ny = y + dy;
      if (!map.isWalkable(nx, ny)) continue;
      if (dx && dy && (!map.isWalkable(x + dx, y) || !map.isWalkable(x, y + dy))) continue;
      const j = ny * W + nx;
      if (closed[j]) continue;
      let ng = gScore[cur] + cost;
      if (wallCost) {
        let near = 0;
        for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) if (map.isSolid(nx + ox, ny + oy)) near = 1;
        ng += near * wallCost;
      }
      if (ng < gScore[j]) {
        gScore[j] = ng;
        came[j] = cur;
        open.push(j, ng + h(j));
      }
    }
  }
  if (!found) return null;

  // Kare merkezlerinden nokta listesi
  const tiles = [];
  for (let i = goal; i !== -1 && i !== start; i = came[i]) tiles.push(i);
  tiles.reverse();
  const pts = [{ x: sx, y: sy }];
  for (let k = 0; k < tiles.length - 1; k++) {
    const i = tiles[k];
    pts.push({ x: ((i % W) + 0.5) * TILE, y: (((i / W) | 0) + 0.55) * TILE });
  }
  pts.push(target);

  // Sadeleştirme (string pulling): görülebilen en uzak noktaya düz git.
  const out = [];
  let a = pts[0];
  let i = 1;
  while (i < pts.length) {
    let j = pts.length - 1;
    while (j > i && !segmentClear(map, a.x, a.y, pts[j].x, pts[j].y, box)) j--;
    out.push(pts[j]);
    a = pts[j];
    i = j + 1;
  }
  return { points: out, target, exact };
}
