# Maden Oyunu: Gromm

Üstten bakışlı (top-down), pixel art bir hayatta kalma korku oyunu. Oyuncu bir madenci. Karanlık bir madende cevher toplayıp asansöre yüklüyor, bu sırada **Gromm** adlı dev bir yaratıktan kaçıyor. Oyun **sadece fare / dokunmatik** ile oynanıyor, klavye yok.

> İlham: "Cobb Can Move" (abho). Sadece ilham. Gromm'un görünüşü, isimler ve kurallar bize ait olmalı. Uzun kollu kırmızı bir canavar yapma, Cobb'un hiçbir görselini veya metnini kopyalama.

---

## Teknik

- **Platform:** Tarayıcı. Vanilla JavaScript + HTML5 Canvas. Framework yok.
- **Yayın:** GitHub Pages. Oyun telefonda ve bilgisayarda açılabilmeli.
- **Kontrol:** `pointer` olayları (mouse ve dokunmatik aynı kod). Klavye kullanma.
- **Görüntü:** Düşük çözünürlüklü bir canvas'a çiz, büyüterek göster (`image-rendering: pixelated`, `imageSmoothingEnabled = false`).
- **Yapı önerisi:**
  ```
  index.html
  src/        (main.js, map.js, player.js, gromm.js, ai/, ui.js, audio.js, levels.js)
  assets/     (sprite'lar, tileset'ler, sesler)
  ```
- Her özellikten sonra oyunu tarayıcıda açıp test et. Küçük ve anlamlı commit'ler at.

---

## Kontroller (sadece tıklama)

| Eylem | Nasıl |
|---|---|
| Yürü | Haritada bir yere tıkla. Madenci **A\* yol bulma** ile engellerin etrafından gider (LoL gibi). Tıklanan yerde küçük bir işaret çıksın. |
| Cevher kaz | Cevhere tıkla. Madenci yanına gider ve kazar. |
| Asansöre yükle | Asansöre tıkla. Taşınan cevherler yüklenir. |
| Şalter indir | Şaltere tıkla. |
| Yemek ye | Erzak sandığına tıkla. |
| Taş topla | Yerdeki taşa tıkla (en fazla 3). |
| Taş at | Sağdaki **taş butonuna** bas, sonra hedef noktaya tıkla. |
| Koş | Sağdaki **sprint butonu**. Mouse ile hem butonu basılı tutup hem başka yere tıklamak mümkün olmadığı için **aç/kapa** şeklinde çalışsın. |

Butonlar ekranın **sağ tarafında**, telefonda başparmakla rahat basılacak büyüklükte (en az 44px) olsun.

---

## Oynanış

### Hedef
Her bölümde belirli sayıda cevheri asansöre yükle, şalterleri indirerek asansöre güç ver, asansöre binip bölümü geç.

### Taşıma
- Madenci aynı anda birden fazla cevher taşıyabilir.
- **Taşıdıkça yavaşlar.** Az alıp hızlı gitmek ile çok alıp risk almak arasında karar verirsin.

### Şalterler
- Asansör elektriksizdir. Bölümdeki **tüm şalterler** indirilince çalışır.
- Şalter indirmek **çok büyük bir ses** çıkarır ("KLANK!") ve ekran hafif sarsılır.
- 1. bölümde şalter yok, asansör baştan çalışır.

### Sprint
- Hızlı koşarsın ama **çok daha fazla ses** çıkarırsın.
- **Dayanıklılık barı** azalır, bitince koşamazsın.
- Koşmak açlığı daha hızlı düşürür.

### Taş atma
- Atılan taş düştüğü yerde ses çıkarır ve Gromm'u oraya çeker (duyma özelliği varsa).
- Gromm'da **hafıza** özelliği varsa aynı numaraya iki kere kanmaz.

### Açlık ve soğuk
- **Açlık barı** zamanla düşer. Erzak sandıklarından yemek yiyerek doldurulur.
- **Sıcaklık barı** zamanla düşer. Duvardaki **meşalelerin** yanında durunca dolar.
- Bar sıfıra yaklaşınca madenci yavaşlar. Sıfırlanırsa ölür.
- Gromm **görme** özelliğini aldıysa meşalenin ışığında durmak tehlikelidir. Gromm **koklama** özelliğini aldıysa yemek yemek iz bırakır.

### Ölüm
- Gromm yakalarsa veya açlık/soğuk sıfırlanırsa **bölüm baştan başlar.** Can sistemi yok.

---

## Gromm

Dev bir yaratık. Madenciden kat kat büyük. Karanlıkta önce **parlayan gözleri** fark edilir.

### Temel davranış (her bölümde var)
- **Dolaşma:** Madende rastgele dolaşır. Çok yakına gelirsen seni görür ve kovalar.
- **Kazma:** Bir duvarın içine kazarak girer, kayanın içinden ilerler ve başka bir yerden patlayarak çıkar.
  - Kayanın içindeyken üstte **çatlaklar ve sallanan taşlar** görünür. Dikkatli oyuncu nereden çıkacağını tahmin edebilir.
  - Girişte ve çıkışta toz bulutu, taş parçaları ve ekran sarsıntısı olsun.

### Rastgele özellik havuzu
2. bölümden 5. bölüme kadar her bölümde Gromm havuzdan **rastgele bir özellik daha** kazanır. Eski özellikler kalır. Sıra her oyunda farklıdır.

| Özellik | Etkisi |
|---|---|
| Duyma | Kazma, koşu, şalter ve taş seslerinin geldiği yere gider. |
| Görme | Fenerin ve meşalelerin ışığını uzaktan fark eder. |
| Koklama | Madencinin bıraktığı izi takip eder. Yemek yiyince iz güçlenir. |
| Hafıza | Seni en son gördüğü yeri ve asansör yolunu kontrol eder. Taş numarasına iki kere kanmaz. |
| Hız | Belirgin şekilde hızlanır. |

- 5 özellikten 4'ü 2–5. bölümlerde gelir. Kalan 1 özellik final bölümünde kullanılabilir.
- Ayrıca Gromm her bölümde **biraz** hızlanır, ama madencinin **koşu hızını asla geçmesin.**

### Ağırlık hissi ("güm güm")
Gromm çok ağır bir yaratık. Oyuncu onu görmeden önce **duymalı ve hissetmeli.**
- **Ses:** Her el yere değdiğinde derin bir "GÜM". Uzaktayken boğuk ve kısık, yaklaştıkça sert ve yüksek (bkz. Ses bölümü).
- **Ekran sarsıntısı:** Her adımda ekran hafifçe titrer. Sarsıntı Gromm'a olan mesafeyle artar.
- **Toz ve taş:** Bastığı yerden toz kalkar. Yakındaysa tavandan küçük taşlar düşer, meşale ışıkları titrer.
- **İz:** Geçtiği yerde bir süre kalıp sonra kaybolan çatlaklar ve el izleri.
- **Hareket:** Hızlı ama hantal. Ani dönemez, dururken ve kalkarken ivmesi hissedilir. Oyuncu keskin dönüşlerle kaçabilmeli.

### Oyun içi ses yarıçapları (Gromm'un duyması için)
Her ses kaynağının bir yarıçapı olsun (küçükten büyüğe): yürüme < kazma < taş < koşu < şalter. Gromm duyma özelliğine sahipse yarıçapın içindeyse sese yönelir.

---

## Bölümler

| Bölüm | Cevher | Şalter | Gromm |
|---|---|---|---|
| 1 | 3 | 0 | Dolaşma + kazma |
| 2 | 5 | 1 | + 1 rastgele özellik |
| 3 | 5 | 2 | + 1 rastgele özellik |
| 4 | 5 | 3 | + 1 rastgele özellik |
| 5 | 6 | 4 | + 1 rastgele özellik |
| 6 (final) | *sonra belirlenecek* | *sonra belirlenecek* | *sonra belirlenecek* |

### Bölüm geçiş ekranları
Karanlık ekran, pixel yazı tipiyle tek satır, arkada bir kükreme sesi. Altında küçük bir ipucu.

- Bölüm 1: "Madende bir şey var... Adı **Gromm**."
- Sonraki bölümler, gelen özelliğe göre:
  - Duyma: "Gromm artık seni DUYABİLİYOR." / İpucu: "Koşmak ve şalterler ses çıkarır."
  - Görme: "Gromm artık ışığı GÖREBİLİYOR." / İpucu: "Meşaleler seni ele verir."
  - Koklama: "Gromm artık seni KOKLAYABİLİYOR." / İpucu: "Yemek yemek iz bırakır."
  - Hafıza: "Gromm seni HATIRLIYOR." / İpucu: "Aynı numara iki kere işlemez."
  - Hız: "Gromm artık daha HIZLI." / İpucu: "Kaçmak için koşman gerekebilir."

---

## Ses

**Bütün sesler kodla, Web Audio API ile üretilecek.** Ses dosyası kullanma. Ayrı bir `audio.js` modülünde, her ses için bir fonksiyon olsun (`playStep()`, `playThud(distance, pan)` gibi).

- **Başlangıç:** Tarayıcılar dokunmadan ses çalmaya izin vermez. Oyun "Başlamak için dokun" ekranıyla açılsın, ses sistemi o dokunuşla başlasın.
- **Madencinin adımları:** Yürürken hafif çakıl sesi, koşarken daha sert ve sık. Her adımda biraz farklı olsun (perde ve ses seviyesi hafif rastgele).
- **Gromm'un adımları:** Derin, ağır "GÜM" sesleri. Uzaklığa göre ses seviyesi ve boğukluk (low-pass filtre) değişsin. Sağda mı solda mı olduğuna göre stereo kaydırma (pan) yapılsın.
- **Gromm kazarken:** Yerin altından gelen gümbürtü. Çıkarken patlama gibi bir kaya sesi.
- **Ambiyans katmanları:**
  - Arkada sürekli çalan alçak, boğuk bir uğultu (korku ambiyansının temeli).
  - Rastgele aralıklarla su damlası, tahta gıcırtısı, uzaktan taş düşmesi. Tekrar ediyormuş gibi gelmesin.
- **Gerilim:** Gromm yaklaştıkça hızlanan bir kalp atışı sesi.
- **Oyun sesleri:** Kazma vuruşu, cevher toplama, asansöre yükleme, şalter "KLANK!", taş "tak!", yemek yeme, meşale çıtırtısı.
- **Bölüm geçişi:** Derin bir kükreme.
- Arayüzde bir ses aç/kapa butonu olsun.

---

## Görsel tarz

- **Pixel art, üstten bakış.** Karanlık ve ürkütücü bir atmosfer.
- **Işık:** Ekranın çoğu karanlık. Madencinin fenerinin baktığı yöne doğru bir ışık konisi ve etrafında küçük bir aydınlık alan var. Duvarlarda titreyen meşaleler. Işık kenarlarında **dithering** (piksel desenli geçiş) kullan, yumuşak gradyan değil.
- **Kendi ışığı olanlar:** Gromm'un gözleri, meşale alevleri ve kristal parıltıları karanlıkta da görünür.
- **Renkler:** Kahverengi/gri taşlar, sarı altın, mavi kristal, kırmızı yakut cevherler. Gromm koyu mor/gri, sırtında dikenler.
- **Efektler:** Şalter ve Gromm'un yere çıkışında ekran sarsıntısı, kazarken toz ve taş parçacıkları.
- **Boyut tutarlılığı:** Bütün karakterler ve tile'lar aynı ölçeğe uymalı (hedef: 32x32 tile, Gromm 64x64 veya daha büyük).

### Asset'ler
Ücretsiz itch.io paketleri `assets/` klasörüne konacak. Planlanan paketler:
- **Madenci:** "Minerman Adventure" (tumas81), 32x32, 4 yön. Alternatif: "Pixel Art Explorer Top-Down 32x32" (schwarnhild).
- **Gromm:** "Top-Down Boss Enemy, Animated" (10KStudios) kaya canavarı. Rengi koyu mora çevrilecek, kazma efektleri kodla eklenecek.
- **Mağara:** "Creepy Cave Tileset", "Free Top-Down Pixel Art Cave Objects", Anokolisa "Pixel Crawler Free" madenler ve mağaralar.

Kurallar:
- `assets/` içine zip olarak yüklenmiş bir paket varsa aç, dosyaları düzenle ve hangi karenin ne olduğunu görsellere bakarak çöz.
- Her paketin lisansını `assets/LICENSES.md` dosyasına yaz (kim yaptı, link, lisans). Ticari kullanıma izin vermeyen paketleri işaretle.
- Bir asset henüz yoksa geçici olarak kodla basit bir sprite çiz. Sonradan dosyayı değiştirmek kolay olsun.

---

## Yol haritası

1. Proje iskeleti: canvas, oyun döngüsü, ölçekleme, GitHub Pages yayını.
2. Tile haritası ve 1. bölüm haritası.
3. Tıkla-yürü ve A\* yol bulma.
4. Karanlık, fener konisi ve meşaleler.
5. Cevher kazma, taşıma ve yavaşlama. Asansör ve sayaç.
6. Gromm: dolaşma, yakına gelince kovalama, yakalama ve bölümü baştan başlatma.
7. Gromm'un kazma hareketi (çatlaklar, çıkış efekti).
8. Arayüz: açlık, sıcaklık ve dayanıklılık barları, cevher sayacı, sprint ve taş butonları.
9. Açlık/soğuk, erzak sandıkları, meşalede ısınma.
10. Sprint ve ses sistemi.
11. Şalterler.
12. Taş toplama ve atma.
13. Rastgele özellik havuzu ve 5 özelliğin yapay zekası.
14. Bölüm geçiş ekranları ve 2–5. bölüm haritaları.
15. Sesler ve son cilalar.
16. Final bölümü (tasarımı sonra yapılacak).

---

## Açık konular (sonra karar verilecek)
- Final bölümünün tasarımı.
- Fenerin kapatılabilmesi (karanlıkta gizlice ilerleme) eklensin mi?
- Cevher türleri farklı olsun mu (ağır/değerli/gürültülü)?
