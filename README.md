# Gromm

Üstten bakışlı, pixel art bir maden korku oyunu. Tarayıcıda, fare veya dokunmatikle oynanır.

**Oyna:** https://mirzadogan44.github.io/maden15temmuz/

Tasarım belgesi: [CLAUDE.md](CLAUDE.md) · Asset lisansları: [assets/LICENSES.md](assets/LICENSES.md)

## Yerelde çalıştırma

ES modülleri `file://` ile açılmaz, küçük bir sunucu gerekir:

```bash
python3 -m http.server 8000
```

Sonra http://localhost:8000 adresini aç. Adresin sonuna `?debug` eklersen FPS ve ölçek bilgisi görünür.

## Klasörler

```
index.html
src/            oyun kodu (main.js, screen.js, input.js, assets.js, audio.js, ui.js, font.js, scenes/)
assets/
  madenci/      Minerman Adventure (tumas81)
  gromm/        Top-Down Boss Enemy (10KStudios)
  magara/       Creepy Cave Tileset, Cave Objects (CraftPix), Pixel Crawler (Anokolisa)
```
