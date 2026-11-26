// Gromm'un rastgele özellik havuzu ve bölümlere dağıtımı.
//
// Oyun başında 4 özellik karıştırılır. 2-5. bölümlerde her bölüm sıradaki
// özelliği ekler, eskiler kalır; final (6.) bölümde dördü de vardır.
// Özellikler Gromm'u hızlandırmaz, madenciyi bulmasını kolaylaştırır.
// Oyuncu ölüp bölümü tekrar oynarsa sıra değişmez (sıra oyun boyunca saklanır).
//
// Test için adres çubuğu:
//   ?abilities=duyma,gorme   -> her bölümde tam olarak bu özellikler
//   ?level=3                  -> 3. bölümden başla

export const ABILITY_IDS = ['duyma', 'gorme', 'koklama', 'hafiza'];

/** Bölüm açılış ekranındaki kurallar: "GROMM [ANAHTAR]" (anahtar kırmızı). */
export const ABILITY_INFO = {
  duyma: { name: 'Duyma', subject: 'GROMM', key: 'DUYABİLİR' },
  gorme: { name: 'Görme', subject: 'GROMM', key: 'GÖREBİLİR' },
  koklama: { name: 'Koklama', subject: 'GROMM', key: 'KOKLAYABİLİR' },
  hafiza: { name: 'Hafıza', subject: 'GROMM', key: 'HATIRLAYABİLİR' },
};

/** Her bölümde geçerli temel kural ve final kuralı. */
export const BASE_RULE = { subject: 'GROMM', key: 'HAREKET EDEBİLİR' };
export const FINAL_RULE = { subject: 'MAĞARAYI', key: 'PATLAT' };

// Türkçe karakterli yazımları da kabul et
const ALIASES = { görme: 'gorme', hafıza: 'hafiza', koku: 'koklama', ses: 'duyma' };

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
