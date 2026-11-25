# Asset Lisansları

Bu klasördeki tüm görseller üçüncü taraf ücretsiz paketlerden gelir. Sesler kodla
üretildiği için ses dosyası yoktur.

> **Not:** Lisans bilgileri itch.io sayfalarının arama özetlerinden ve paketlerin
> içindeki lisans dosyalarından derlendi. Bu sayfalar doğrudan açılıp
> okunamadı. Yayınlamadan önce her sayfadaki "More information → License"
> alanını kontrol et. ⚠️ ile işaretli satırlar özellikle kontrol edilmeli.

| Klasör | Paket | Yapan | Link | Lisans | Ticari kullanım | Atıf |
|---|---|---|---|---|---|---|
| `madenci/minerman-adventure/` | Minerman Adventure (Bombermanlike asset pack 32x32) | tumas81 | https://tumas81.itch.io/minerman-adventure | **CC BY-ND 4.0** | Evet | **Zorunlu** |
| `gromm/rockboss/` | Top-Down Boss Enemy, Animated (zip adı: `TopDown_RockBoss_EBrosAssets`) | 10KStudios | https://10kstudios.itch.io/top-down-boss-enemy-animated | ⚠️ Lisans belirtilmemiş / doğrulanamadı | ⚠️ Belirsiz | Önerilir |
| `magara/creepy-cave/` | Creepy Cave Tileset (`spr_cave.png`) | smallmak | https://smallmak.itch.io/creepy-cave-tileset | ⚠️ Lisans belirtilmemiş / doğrulanamadı | ⚠️ Belirsiz | Önerilir |
| `magara/cave-objects/` | Free Top-Down Pixel Art Cave Objects | CraftPix.net (free-game-assets) | https://free-game-assets.itch.io/free-top-down-pixel-art-cave-objects | CraftPix lisansı: https://craftpix.net/file-licenses/ (paketteki `License.txt`) | Evet | Gerekmiyor (takdir edilir) |
| `magara/pixel-crawler/` | Pixel Crawler – Free Pack (Exterior 0.1) | Anokolisa | https://anokolisa.itch.io/free-pixel-art-asset-pack-topdown-tileset-rpg-16x16-sprites | Yazarın kendi şartları (`magara/pixel-crawler/Terms.txt`) | Evet (asset'ler tek başına satılamaz) | Gerekmiyor (takdir edilir) |

## Dikkat edilmesi gerekenler

- **Minerman Adventure – CC BY-ND 4.0 (NoDerivatives):** Sprite'lar **değiştirilmeden**
  kullanılabilir. Renk değiştirme, yeniden çizme gibi değişikliklerin dağıtılması
  lisansa aykırı olabilir. Oyunda bir "Krediler" ekranında tumas81'e atıf yapılmalı.
  Oyunda madenci sprite'ları, zemin/duvar dokuları ve `fxs/sparks.png` dosyaları
  değiştirilmeden çiziliyor; üstlerine sadece ışık/gölge uygulanıyor.
  Madenciyi değiştirmek gerekirse alternatif: Pixel Crawler'daki `Body_A` karakteri
  (değiştirilebilir) veya schwarnhild'in "Pixel Art Explorer Top-Down 32x32" paketi.
- **10KStudios Rock Boss:** Gromm olarak kullanılıyor; dosya değiştirilmiyor, oyun açılırken
  bellekte koyu mor/griye boyanıyor (`src/gromm.js`).
  Sayfada açık bir lisans görülemedi. Yazar yorumlarda başka bir boss paketi için
  "oyununda kullanabilirsin" demiş, ama bu paket için yazılı izin yok. Ticari
  yayından önce sayfayı kontrol et ya da yazara sor.
- **Creepy Cave Tileset:** Sayfada lisans görülemedi. Ticari yayından önce kontrol et.
- **Pixel Crawler:** Değiştirilebilir, ticari projede kullanılabilir. Ama asset'ler
  tek başına (oyun dışında) satılamaz ve yeniden dağıtılamaz.
- **CraftPix:** Ticari kullanım serbest. Asset'lerin kendisi tek başına
  satılamaz/dağıtılamaz.

## Pakete dahil edilmeyenler

Depoyu küçük tutmak için şunlar alınmadı: `Objects.psd` (30 MB), CraftPix kupon
dosyaları (`COUPON.*`), Pixel Crawler `.aseprite` kaynak dosyaları, macOS
`__MACOSX` / `._*` dosyaları. Orijinal zip'ler git geçmişinde (`assets3/`) duruyor.
