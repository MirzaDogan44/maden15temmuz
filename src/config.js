// Oyun genelindeki sabitler.

/** Bir harita karesinin (tile) piksel boyutu. */
export const TILE = 32;

/**
 * Ekranın kısa kenarı yaklaşık bu kadar oyun pikseli gösterir.
 * Ölçek her zaman tam sayıdır, böylece pikseller keskin kalır.
 */
export const TARGET_SHORT_SIDE = 270;

/** Sabit güncelleme adımı (saniye). Oyun mantığı saniyede 60 kez çalışır. */
export const STEP = 1 / 60;

/** Bir karede en fazla bu kadar zaman işlenir (sekme arka plandan dönünce donmasın). */
export const MAX_FRAME_TIME = 0.25;

/** Dokunmatik butonların en küçük boyutu (CSS piksel). */
export const MIN_BUTTON_CSS = 48;

/** Madencinin yürüme hızı (piksel/saniye). Ekranı yaklaşık 3-4 saniyede geçer. */
export const MINER_SPEED = 115;

/** Taşınan her cevher hızı bu oranda düşürür... */
export const CARRY_SLOWDOWN = 0.1;
/** ...ama hız bu oranın altına inmez. */
export const MIN_CARRY_SPEED = 0.55;

/**
 * Seslerin Gromm'a ulaştığı yarıçaplar (piksel). Küçükten büyüğe:
 * yürüme < kazma < taş < koşu < şalter. Gromm "duyma" özelliğini alınca
 * bu yarıçapın içindeyse sese yönelir.
 */
export const NOISE = { walk: 70, dig: 170, stone: 230, run: 280, lever: 560 };

/** Adres çubuğunda ?debug varsa FPS ve ölçek bilgisi gösterilir. */
export const DEBUG = new URLSearchParams(location.search).has('debug');
