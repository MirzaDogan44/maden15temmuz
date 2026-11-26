# Gromm

Üstten bakışlı, pixel art bir maden korku oyunu. Tarayıcıda, fare veya dokunmatikle oynanır.

**Oyna:** https://mirzadogan44.github.io/maden15temmuz/

Tasarım belgesi: [CLAUDE.md](CLAUDE.md) · Asset lisansları: [assets/LICENSES.md](assets/LICENSES.md)

## Yerelde çalıştırma

ES modülleri `file://` ile açılmaz, küçük bir sunucu gerekir:

```bash
python3 -m http.server 8000
```

Sonra http://localhost:8000 adresini aç. Adres parametreleri:

- `?debug`: FPS, ölçek ve Gromm'un durumu/özellikleri görünür
- `?nolight`: ışığı kapatır (haritayı incelemek için)
- `?level=3`: menüyü atlayıp 3. bölümden başlar (`?level=6` final)
- `?abilities=duyma,gorme`: Gromm her bölümde bu özelliklerle başlar (duyma, gorme, koklama, hafiza)
- `?digdebug`: Gromm'un kazma yolu ve çıkış noktası ekranda görünür
- `?digsoon`: Gromm birkaç saniyede bir kazar
- `?survival=fast`: açlık ve sıcaklık barları 5 kat hızlı azalır
- `?legacy`: eski tarayıcılar için derlenmiş sürümü (`legacy/gromm.js`) yükler

## Eski tarayıcılar

Modern tarayıcılar `src/` kodunu doğrudan yükler. Eski tarayıcılar için kod ES2015'e çevrilip tek dosyaya paketlenir. `src/` değişince yeniden üret ve commit'le:

```bash
./tools/build-legacy.sh
```

## Klasörler

```
index.html
legacy/         eski tarayıcılar için derlenmiş tek dosya (tools/build-legacy.sh)
tools/          derleme betiği
src/            oyun kodu
  main.js         oyun döngüsü, sahneler
  compat.js       eski tarayıcılar için küçük tamamlayıcılar
  levels.js       bölüm haritaları (ASCII)
  map.js          harita, çarpışma, ışın testi
  mapRender.js    haritanın önceden çizilmesi
  pathfinding.js  A* ve yol sadeleştirme
  player.js       madenci (yürüme, sprint, kazma, taşıma, meşale)
  gromm.js        Gromm (boyama, davranış, ağırlık hissi)
  ore.js          cevherler
  items.js        yerdeki eşyalar (meşale, erzak, dinamit) ve yerleri
  save.js         Kaydet ve Çık (localStorage)
  newspaper.js    gazete görüntüleyici (assets/gazete.png)
  jumpscare.js    yakalanınca ekranı kaplayan Gromm yüzü
  settings.js     oyuncu ayarları (jumpscare vb.)
  ui.js           butonlar ve ayarlar paneli
  minimap.js      sol üstteki minimap
  abilities.js    Gromm'un özellik havuzu ve bölümlere dağıtımı
  lighting.js     ortam ışığı, lambalar, karanlık bölgeler, meşale, dithering
  particles.js    toz ve kıvılcımlar
  audio.js        Web Audio ile kodla üretilen sesler
  scenes/         başlangıç, ana menü, bölüm açılışı, oyun, bölüm sonu, ölüm ve bitiş ekranları
assets/
  madenci/      Minerman Adventure (tumas81)
  gromm/        Top-Down Boss Enemy (10KStudios)
  magara/       Creepy Cave Tileset, Cave Objects (CraftPix), Pixel Crawler (Anokolisa)
```
