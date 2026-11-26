// Sprite tanımları ve görsel yükleyici.
//
// Her sprite sayfası için kare boyutu, kare sayısı ve (birden çok satır varsa)
// hangi satırın hangi yöne baktığı burada tutulur. Bir asset'i değiştirmek
// için genelde sadece bu dosyadaki yolu ve kare bilgisini güncellemek yeter.
//
// Yön adları: 'down' (kameraya doğru), 'up', 'left', 'right'.

const MINER = 'assets/madenci/minerman-adventure/character/';
const GROMM = 'assets/gromm/rockboss/';

/**
 * Madenci (Minerman Adventure, tumas81). Her yön ayrı dosyada, 32x32 kareler.
 * Not: Lisans CC BY-ND, sprite'lar değiştirilmeden kullanılmalı.
 */
export const MINER_SPRITES = {
  frame: 32,
  anims: {
    idle: { fps: 6, dirs: { down: MINER + 'idle-front.png', up: MINER + 'idle-back.png', left: MINER + 'idle-left.png', right: MINER + 'idle-right.png' }, frames: 4 },
    walk: { fps: 8, dirs: { down: MINER + 'walk-front.png', up: MINER + 'walk-back.png', left: MINER + 'walk-left.png', right: MINER + 'walk-right.png' }, frames: 4 },
    death: { fps: 8, dirs: { down: MINER + 'death-front.png' }, frames: 5, loop: false },
    win: { fps: 6, dirs: { down: MINER + 'win-front.png' }, frames: 2 },
    takeOff: { fps: 6, dirs: { down: MINER + 'take-off-front.png' }, frames: 2 },
  },
};

/**
 * Gromm (10KStudios "Top-Down Boss Enemy, Animated"). 64x64 kareler,
 * her dosyada 4 satır (4 yön). Satır sırası animasyondan animasyona DEĞİŞİYOR,
 * bu yüzden her animasyon için ayrı yazıldı.
 */
export const GROMM_SPRITES = {
  frame: 64,
  anims: {
    idle: { fps: 8, src: GROMM + 'idle.png', frames: 7, rows: { down: 0, up: 1, left: 2, right: 3 } },
    walk: { fps: 10, src: GROMM + 'walk.png', frames: 10, rows: { up: 0, left: 1, right: 2, down: 3 } },
    stomp: { fps: 12, src: GROMM + 'stomp.png', frames: 13, rows: { up: 0, left: 1, right: 2, down: 3 }, loop: false },
    swipe: { fps: 12, src: GROMM + 'swipe.png', frames: 10, rows: { down: 0, up: 1, left: 2, right: 3 }, loop: false },
  },
};

/**
 * Zemin ve duvar dokuları (Minerman Adventure). Her dosyada 32x32 varyantlar
 * yan yana duruyor; `x` hangi varyantın kullanılacağını söyler.
 *   ground.png: 0 = kahverengi parke taşı, 32 = yosunlu taş, 64 = dalgalı toprak
 *   rock.png:   0 = gri kaya, 32 = yosunlu kaya, 64 = toprakta kaya
 */
const TERRAIN_DIR = 'assets/madenci/minerman-adventure/terrain/';
export const TERRAIN = {
  floor: { src: TERRAIN_DIR + 'ground.png', x: 64 },
  wallFace: { src: TERRAIN_DIR + 'rock.png', x: 0 },
};

/** Süs objeleri (CraftPix "Cave Objects"), gölgeli ("dark_shadow") sürümler. */
const OBJ = 'assets/magara/cave-objects/Objects_separately/';
export const DECOR = {
  crystalBig: OBJ + '32/Blue-green_crystal_dark_shadow3.png',
  crystalCluster: OBJ + '32/crystal_blue-green_vertical2.png',
  crystalSmall: OBJ + '16/Blue-green_crystal_dark_shadow4.png',
  crystalSmallWhite: OBJ + '16/white_crystal_dark_shadow4.png',
  mushroomRed: OBJ + '32/mushroom1_dark_shadow3.png',
  mushroomTeal: OBJ + '32/mushroom4_dark_shadow3.png',
  skeleton: OBJ + '32/Human_skeleton_dark_shadow.png',
};

/** Efektler (Minerman Adventure). sparks.png: 2 kare, 32x32. */
export const FX = {
  sparks: 'assets/madenci/minerman-adventure/fxs/sparks.png',
};

/**
 * Eşyalar (Minerman Adventure). dynamite.png ve dynamite-pack.png: 3x3 kare,
 * her biri 32x32 (hafif sallanan animasyon). Değiştirilmeden çizilir.
 */
export const ITEMS = {
  dynamite: 'assets/madenci/minerman-adventure/items/dynamite.png',
  dynamitePack: 'assets/madenci/minerman-adventure/items/dynamite-pack.png',
};

/** Oyunun açılışta yüklediği tüm görseller. */
export function collectImagePaths() {
  const paths = new Set();
  for (const a of Object.values(MINER_SPRITES.anims)) for (const p of Object.values(a.dirs)) paths.add(p);
  for (const a of Object.values(GROMM_SPRITES.anims)) paths.add(a.src);
  for (const t of Object.values(TERRAIN)) paths.add(t.src);
  for (const p of Object.values(DECOR)) paths.add(p);
  for (const p of Object.values(FX)) paths.add(p);
  for (const p of Object.values(ITEMS)) paths.add(p);
  return [...paths];
}

/** Yüklenen görseller: yol -> HTMLImageElement */
export const images = new Map();

/**
 * Görselleri yükler. Eksik bir dosya oyunu durdurmaz; o sprite yerine
 * kodla çizilmiş geçici bir şekil gösterilir.
 */
export function loadImages(paths, onProgress) {
  let done = 0;
  return Promise.all(
    paths.map(
      (p) =>
        new Promise((resolve) => {
          const img = new Image();
          img.onload = () => {
            images.set(p, img);
            if (onProgress) onProgress(++done, paths.length);
            resolve();
          };
          img.onerror = () => {
            console.warn('Görsel yüklenemedi:', p);
            if (onProgress) onProgress(++done, paths.length);
            resolve();
          };
          img.src = p;
        }),
    ),
  );
}

/** Animasyonun t saniyesindeki kare numarası. */
export function frameAt(anim, t) {
  const f = Math.floor(t * anim.fps);
  return anim.loop === false ? Math.min(f, anim.frames - 1) : f % anim.frames;
}

/**
 * Madenci karesini çizer. (x, y) ayakların ortasıdır.
 * Görsel yoksa false döner, çağıran yer geçici şekil çizebilir.
 */
export function drawMiner(ctx, animName, dir, t, x, y) {
  const anim = MINER_SPRITES.anims[animName];
  const src = anim.dirs[dir] || anim.dirs.down;
  const img = images.get(src);
  if (!img) return false;
  const s = MINER_SPRITES.frame;
  const f = typeof t === 'number' ? frameAt(anim, t) : t.frame;
  // Sprite'ın ayakları karenin en altından 1 piksel yukarıda.
  ctx.drawImage(img, f * s, 0, s, s, Math.round(x - s / 2), Math.round(y - s + 1), s, s);
  return true;
}

/** Gromm karesini çizer. (x, y) ayakların ortasıdır. */
export function drawGromm(ctx, animName, dir, t, x, y) {
  const anim = GROMM_SPRITES.anims[animName];
  const img = images.get(anim.src);
  if (!img) return false;
  const s = GROMM_SPRITES.frame;
  const row = anim.rows[dir] ?? 0;
  const f = frameAt(anim, t);
  ctx.drawImage(img, f * s, row * s, s, s, Math.round(x - s / 2), Math.round(y - s + 4), s, s);
  return true;
}
