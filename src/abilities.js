// Gromm'un rastgele özellik havuzu ve bölümlere dağıtımı.
//
// Oyun başında 5 özellik karıştırılır. 2-5. bölümlerde her bölüm sıradaki
// özelliği ekler, eskiler kalır (5. özellik final bölümüne ayrılır).
// Oyuncu ölüp bölümü tekrar oynarsa sıra değişmez (sıra oyun boyunca saklanır).
//
// Test için adres çubuğu:
//   ?abilities=duyma,gorme   -> her bölümde tam olarak bu özellikler
//   ?level=3                  -> 3. bölümden başla

export const ABILITY_IDS = ['duyma', 'gorme', 'koklama', 'hafiza', 'hiz'];

/** Bölüm açılış ekranı yazıları (CLAUDE.md > Bölüm geçiş ekranları). */
export const ABILITY_INFO = {
  duyma: { name: 'Duyma', title: 'Gromm artık seni DUYABİLİYOR.', hint: 'Koşmak ve şalterler ses çıkarır.' },
  gorme: { name: 'Görme', title: 'Gromm artık ışığı GÖREBİLİYOR.', hint: 'Meşaleler seni ele verir.' },
  koklama: { name: 'Koklama', title: 'Gromm artık seni KOKLAYABİLİYOR.', hint: 'Yemek yemek iz bırakır.' },
  hafiza: { name: 'Hafıza', title: 'Gromm seni HATIRLIYOR.', hint: 'Aynı numara iki kere işlemez.' },
  hiz: { name: 'Hız', title: 'Gromm artık daha HIZLI.', hint: 'Kaçmak için koşman gerekebilir.' },
};

export const FIRST_LEVEL_INTRO = { title: 'GROMM HAREKET EDEBİLİR', hint: 'Cevherleri asansöre taşı. Yakalanma.' };

// Türkçe karakterli yazımları da kabul et
const ALIASES = { görme: 'gorme', hafıza: 'hafiza', hız: 'hiz', koku: 'koklama', ses: 'duyma' };

function parseList(str) {
  return str
    .split(',')
    .map((s) => s.trim().toLocaleLowerCase('tr-TR'))
    .map((s) => ALIASES[s] || s)
    .filter((s) => ABILITY_IDS.includes(s));
}

const params = new URLSearchParams(location.search);
/** ?abilities=... ile zorlanan özellikler (yoksa null) */
export const FORCED_ABILITIES = params.has('abilities') ? parseList(params.get('abilities')) : null;
/** ?level=N ile başlangıç bölümü (0 tabanlı) */
export const START_LEVEL = Math.max(0, (parseInt(params.get('level'), 10) || 1) - 1);

/** Yeni oyun için karıştırılmış özellik sırası. */
export function shuffledOrder() {
  const a = ABILITY_IDS.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Bu bölümde Gromm'un sahip olduğu özellikler. levelIndex 0 tabanlı. */
export function abilitiesFor(order, levelIndex) {
  if (FORCED_ABILITIES) return FORCED_ABILITIES.slice();
  return order.slice(0, Math.min(levelIndex, 4));
}

/** Bu bölümde yeni gelen özellik (1. bölümde yok). */
export function newAbilityFor(order, levelIndex) {
  if (levelIndex === 0) return null;
  if (FORCED_ABILITIES) return FORCED_ABILITIES[FORCED_ABILITIES.length - 1] || null;
  return order[Math.min(levelIndex, 4) - 1] || null;
}
