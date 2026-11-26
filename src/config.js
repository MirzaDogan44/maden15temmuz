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

/** Madenci aynı anda en fazla bu kadar cevher taşıyabilir. */
export const MAX_CARRY = 1;
/** Cevher taşırken hız bu oranda düşer (%15). */
export const CARRY_SLOWDOWN = 0.15;
/** Hız bu oranın altına inmez. */
export const MIN_CARRY_SPEED = 0.55;

/** Sprint: yürüme hızının bu katı. */
export const SPRINT_MULT = 1.6;
/** Dolu dayanıklılık bu kadar saniye koşunca biter. */
export const STAMINA_DRAIN_TIME = 4.5;
/** Koşmayı bırakınca dolmaya başlamadan önce beklenen süre (sn). */
export const STAMINA_REGEN_DELAY = 0.9;
/** Boştan doluya dolma süresi (sn). */
export const STAMINA_REGEN_TIME = 6;
/** Tükenince tekrar koşabilmek için gereken doluluk (0..1). */
export const STAMINA_RECOVER = 0.35;

/**
 * Seslerin Gromm'a ulaştığı yarıçaplar (piksel). Küçükten büyüğe:
 * yürüme < kazma < koşu < dinamit kurma < şalter. Gromm "duyma" özelliğini
 * alınca bu yarıçapın içindeyse sese yönelir.
 */
export const NOISE = { walk: 70, dig: 170, stone: 230, run: 280, dynamite: 420, lever: 560 };

/** Elde taşınan meşalenin yanma süresi (sn). Sönükken azalmaz. */
export const TORCH_BURN_TIME = 120;
/** Son bu kadar saniyede meşale titreyip kararır. */
export const TORCH_LOW_TIME = 20;

// ---- Açlık ve soğuk (hafif bir baskı; asıl tehlike Gromm) ----
const SURVIVAL_FAST = new URLSearchParams(location.search).get('survival') === 'fast';
/** ?survival=fast ile barlar 5 kat hızlı azalır (test için). */
export const SURVIVAL_SPEED = SURVIVAL_FAST ? 5 : 1;
/** Dolu açlık barı bu kadar saniyede biter. */
export const HUNGER_TIME = 300;
/** Koşarken açlık bu kat hızlı azalır. */
export const HUNGER_RUN_MULT = 1.3;
/** Dolu sıcaklık barı bu kadar saniyede biter. */
export const COLD_TIME = 200;
/** Karanlık bölgelerde soğuma bu kat hızlı. */
export const COLD_DARK_MULT = 1.4;
/** Duvar meşalesi/lambası yanında boştan doluya ısınma süresi (sn). */
export const WARM_FIRE_TIME = 12;
/** Elde yanan meşaleyle boştan doluya ısınma süresi (sn). */
export const WARM_TORCH_TIME = 90;
/** Yemeklerin doyurduğu miktar (0..1). */
export const FOOD = { bread: 0.35, meat: 0.6, can: 0.6 };

/** Koklama: yemek yedikten sonra bu kadar saniye iz 2 kat güçlü kalır. */
export const SCENT_BOOST_TIME = 15;

/** Adres çubuğunda ?debug varsa FPS ve ölçek bilgisi gösterilir. */
export const DEBUG = new URLSearchParams(location.search).has('debug');
