// Kodla çizilen 5x7 pixel yazı tipi (Türkçe harflerle).
//
// Harici font dosyası gerekmez ve düşük çözünürlüklü canvas'ta her zaman
// keskin görünür. Sadece büyük harf vardır; küçük harfler Türkçe kurallarıyla
// büyütülür (i -> İ, ı -> I).

const G = {
  A: '.###.|#...#|#...#|#####|#...#|#...#|#...#',
  B: '####.|#...#|#...#|####.|#...#|#...#|####.',
  C: '.###.|#...#|#....|#....|#....|#...#|.###.',
  D: '####.|#...#|#...#|#...#|#...#|#...#|####.',
  E: '#####|#....|#....|####.|#....|#....|#####',
  F: '#####|#....|#....|####.|#....|#....|#....',
  G: '.###.|#...#|#....|#.###|#...#|#...#|.####',
  H: '#...#|#...#|#...#|#####|#...#|#...#|#...#',
  I: '.###.|..#..|..#..|..#..|..#..|..#..|.###.',
  J: '..###|...#.|...#.|...#.|#..#.|#..#.|.##..',
  K: '#...#|#..#.|#.#..|##...|#.#..|#..#.|#...#',
  L: '#....|#....|#....|#....|#....|#....|#####',
  M: '#...#|##.##|#.#.#|#.#.#|#...#|#...#|#...#',
  N: '#...#|##..#|#.#.#|#..##|#...#|#...#|#...#',
  O: '.###.|#...#|#...#|#...#|#...#|#...#|.###.',
  P: '####.|#...#|#...#|####.|#....|#....|#....',
  Q: '.###.|#...#|#...#|#...#|#.#.#|#..#.|.##.#',
  R: '####.|#...#|#...#|####.|#.#..|#..#.|#...#',
  S: '.####|#....|#....|.###.|....#|....#|####.',
  T: '#####|..#..|..#..|..#..|..#..|..#..|..#..',
  U: '#...#|#...#|#...#|#...#|#...#|#...#|.###.',
  V: '#...#|#...#|#...#|#...#|#...#|.#.#.|..#..',
  W: '#...#|#...#|#...#|#.#.#|#.#.#|##.##|#...#',
  X: '#...#|#...#|.#.#.|..#..|.#.#.|#...#|#...#',
  Y: '#...#|#...#|.#.#.|..#..|..#..|..#..|..#..',
  Z: '#####|....#|...#.|..#..|.#...|#....|#####',
  0: '.###.|#...#|#..##|#.#.#|##..#|#...#|.###.',
  1: '..#..|.##..|..#..|..#..|..#..|..#..|.###.',
  2: '.###.|#...#|....#|...#.|..#..|.#...|#####',
  3: '####.|....#|....#|.###.|....#|....#|####.',
  4: '...#.|..##.|.#.#.|#..#.|#####|...#.|...#.',
  5: '#####|#....|####.|....#|....#|#...#|.###.',
  6: '.###.|#....|#....|####.|#...#|#...#|.###.',
  7: '#####|....#|...#.|..#..|.#...|.#...|.#...',
  8: '.###.|#...#|#...#|.###.|#...#|#...#|.###.',
  9: '.###.|#...#|#...#|.####|....#|....#|.###.',
  '.': '.....|.....|.....|.....|.....|..#..|..#..',
  ',': '.....|.....|.....|.....|..#..|..#..|.#...',
  '!': '..#..|..#..|..#..|..#..|..#..|.....|..#..',
  '?': '.###.|#...#|....#|...#.|..#..|.....|..#..',
  ':': '.....|..#..|..#..|.....|..#..|..#..|.....',
  '-': '.....|.....|.....|.###.|.....|.....|.....',
  '+': '.....|..#..|..#..|#####|..#..|..#..|.....',
  "'": '..#..|..#..|.....|.....|.....|.....|.....',
  '"': '.#.#.|.#.#.|.....|.....|.....|.....|.....',
  '(': '...#.|..#..|.#...|.#...|.#...|..#..|...#.',
  ')': '.#...|..#..|...#.|...#.|...#.|..#..|.#...',
  '/': '....#|...#.|...#.|..#..|.#...|.#...|#....',
  '%': '##..#|##.#.|...#.|..#..|.#...|.#.##|#..##',
};

// Türkçe harfler: temel harf + işaret. Satır numarası gövdeye göredir
// (0 = gövdenin ilk satırı, -2 = gövdenin iki satır üstü).
const MARKS = {
  dot: [[-2, '..#..']],
  dots: [[-2, '.#.#.']],
  breve: [[-3, '#...#'], [-2, '.###.']],
  cedilla: [[7, '..#..'], [8, '.##..']],
};
const TURKISH = { 'İ': ['I', 'dot'], 'Ö': ['O', 'dots'], 'Ü': ['U', 'dots'], 'Ğ': ['G', 'breve'], 'Ç': ['C', 'cedilla'], 'Ş': ['S', 'cedilla'] };

const TOP = 3; // işaretler için gövdenin üstünde bırakılan satır
export const LINE_HEIGHT = TOP + 7 + 2;

/** Her karakter için doldurulacak pikseller ve genişlik. */
const glyphs = new Map();

function build(ch) {
  let base = ch;
  let mark = null;
  if (TURKISH[ch]) [base, mark] = TURKISH[ch];
  const src = G[base] ?? G['?'];
  const rows = src.split('|').map((r, i) => [i, r]);
  if (mark) rows.push(...MARKS[mark]);

  const px = [];
  let minX = 5;
  let maxX = -1;
  for (const [ry, row] of rows) {
    for (let x = 0; x < 5; x++) {
      if (row[x] === '#') {
        px.push([x, ry + TOP]);
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
      }
    }
  }
  // Orantılı genişlik: boş sütunları kırp.
  for (const p of px) p[0] -= minX;
  return { px, w: maxX - minX + 1 };
}

function glyph(ch) {
  let g = glyphs.get(ch);
  if (!g) {
    g = ch === ' ' ? { px: [], w: 3 } : build(ch);
    glyphs.set(ch, g);
  }
  return g;
}

function upper(text) {
  return String(text).toLocaleUpperCase('tr-TR');
}

/** Yazının piksel genişliği (ölçek 1). */
export function textWidth(text) {
  let w = 0;
  for (const ch of upper(text)) w += glyph(ch).w + 1;
  return Math.max(0, w - 1);
}

/**
 * Yazı çizer. align: 'left' | 'center' | 'right'. (x, y) yazının sol/orta/sağ
 * üst köşesidir. size tam sayı büyütme katıdır.
 */
export function drawText(ctx, text, x, y, { color = '#fff', size = 1, align = 'left', shadow = null } = {}) {
  const s = upper(text);
  const w = textWidth(s) * size;
  let cx = Math.round(align === 'center' ? x - w / 2 : align === 'right' ? x - w : x);
  const cy = Math.round(y);
  if (shadow) drawRun(ctx, s, cx + size, cy + size, shadow, size);
  drawRun(ctx, s, cx, cy, color, size);
}

function drawRun(ctx, s, x, y, color, size) {
  ctx.fillStyle = color;
  for (const ch of s) {
    const g = glyph(ch);
    for (const [px, py] of g.px) ctx.fillRect(x + px * size, y + py * size, size, size);
    x += (g.w + 1) * size;
  }
}

/** Metni verilen genişliğe sığacak satırlara böler (kelime kelime). */
export function wrapText(text, maxWidth, size = 1) {
  const words = String(text).split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (textWidth(test) * size <= maxWidth || !line) line = test;
    else {
      lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
}
