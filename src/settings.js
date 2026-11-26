// Oyuncu ayarları (tarayıcıda saklanır; saklanamazsa varsayılan kullanılır).

const KEY = 'gromm.settings';
/** music: menü müziği, sfx: ses efektleri, jumpscare: yakalanınca yüz */
const defaults = { jumpscare: true, music: true, sfx: true };
let data = { ...defaults };
try {
  data = { ...defaults, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
} catch {
  /* gizli sekme vb. */
}

export function get(name) {
  return data[name];
}

export function set(name, value) {
  data[name] = value;
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* önemli değil */
  }
}
