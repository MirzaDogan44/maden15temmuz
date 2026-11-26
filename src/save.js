// "Kaydet ve Çık": ulaşılan bölüm, Gromm'un özellik sırası ve toplam süre.
// Bölüm içindeki konum kaydedilmez; kayıt yüklenince o bölümün başından
// başlanır. Kayıt YÜKLENDİĞİ ANDA silinir (kayıttan devam edip ölen oyuncu
// yine 1. bölümden başlar). localStorage yoksa oyun çökmez: kayıt devre dışı.

const KEY = 'gromm.save';

/** localStorage kullanılabiliyor mu? (gizli sekme, kapalı çerez vb.) */
export const storageOk = (() => {
  try {
    const k = '__gromm_test__';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
})();

/** Kayıtlı oyun: { level (0 tabanlı), order: [...], time (sn) } veya null */
export function peek() {
  if (!storageOk) return null;
  try {
    const d = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!d || typeof d.level !== 'number' || !Array.isArray(d.order)) return null;
    return d;
  } catch {
    return null;
  }
}

export function write(data) {
  if (!storageOk) return false;
  try {
    localStorage.setItem(KEY, JSON.stringify({ level: data.level, order: data.order, time: Math.round(data.time || 0) }));
    return true;
  } catch {
    return false;
  }
}

export function clear() {
  if (!storageOk) return;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* önemli değil */
  }
}

/** Kaydı oku ve hemen sil. */
export function take() {
  const d = peek();
  clear();
  return d;
}
