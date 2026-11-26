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
| Meşale al | Karanlık bölge girişindeki meşale standına tıkla. |
| Taş topla | Yerdeki taşa tıkla (en fazla 3). |
| Taş at | Sağdaki **taş butonuna** bas, sonra hedef noktaya tıkla. |
| Koş | Sağdaki **sprint butonu**. Mouse ile hem butonu basılı tutup hem başka yere tıklamak mümkün olmadığı için **aç/kapa** şeklinde çalışsın. |

Butonlar ekranın **sağ tarafında**, telefonda başparmakla rahat basılacak büyüklükte (en az 44px) olsun.

### Arayüz yerleşimi
- **Sol üst:** küçük, yarı saydam, pixel art **minimap**. Sadece mağaranın yapısını (yollar), oyuncunun konumunu (yanıp sönen nokta) ve asansörü (belirgin simge) gösterir; karanlık bölgeler daha koyu. Cevherleri, Gromm'u ve şalterleri **göstermez**. Dokunmaları engellemez. Diğer arayüz öğeleri sol üstten uzak tutulur.
- **Üst orta:** kompakt sayaçlar (asansördeki cevher, taşınan cevher, şalterler) — sadece simge ve sayı.
- **Sağ üst:** ses ve ayarlar butonları. **Sağ alt:** sprint butonu.

---

## Oynanış

### Hedef
Her bölümde belirli sayıda cevheri asansöre yükle, şalterleri indirerek asansöre güç ver, asansöre binip bölümü geç.

### Harita
- Haritalar büyük olsun (en az 60x45 tile). Labirent değil, okunabilir bir yapı: **birkaç büyük oda** ve onları bağlayan **geniş tüneller (en az 4 tile)**.
- Ölü uç az olsun. Madencinin Gromm'un etrafından dolaşıp kaçabilmesi için **en az 2-3 büyük döngü** olsun.
- Odalarda etrafında dönülebilen büyük **kaya adacıkları/sütunlar** olsun (Gromm'un önünü kesmek ve kaçmak için).
- Oyuncu haritanın genel yapısını kısa sürede kavrayabilmeli: asansör salonu, karanlık bölge ve cevher odaları kolay ayırt edilsin (raylar, kristaller, uyarı tabelası gibi belirgin işaretler).

### Taşıma
- Madenci aynı anda **sadece 1 cevher** taşıyabilir. Taşıdığı cevher sırtında görünür.
- Elinde cevher varken başka bir cevhere dokunursa kazmaz; ekranda kısa bir uyarı çıkar: "Önce bunu asansöre götür."
- Cevher taşırken **hafifçe yavaşlar (~%15)**. Her cevher için asansöre gidip gelmek gerekir; bu yolculuklar Gromm'la karşılaşma riskini oluşturur.
- Değerler `src/config.js` içinde (MAX_CARRY, CARRY_SLOWDOWN).

### Şalterler
- Asansör elektriksizdir. Bölümdeki **tüm şalterler** indirilince çalışır (yük de tamamsa).
- Şalter, zemine bakan bir duvar yüzündeki metal kutudur (harita karakteri `Z`). Dokununca madenci yanına gidip kolu indirir.
- Şalter indirmek **çok büyük bir ses** çıkarır ("KLANK!"), ekran sarsılır, kıvılcım çıkar; şalterin lambası kırmızıdan yeşile döner. Ses yarıçapı en büyüğüdür (Gromm duyma özelliğiyle uzaktan gelir).
- Asansörün yanındaki küçük panoda her şalter için bir lamba vardır (ör. 1/2); üst ortadaki sayaçta da gösterilir.
- Şalterler asansörden uzakta ve farklı yönlerde olur; en az biri karanlık bölgededir.
- 1. bölümde şalter yok, asansör baştan çalışır.

### Sprint
- Sağ alttaki **sprint butonu** aç/kapa çalışır (en az 48px).
- Sprint açıkken madenci yürüyüşünün **1.6 katı** hızla koşar (taşıma yavaşlaması bunun üstüne uygulanır). Koşu animasyonu daha hızlı oynar, adımlar daha sert ve sık duyulur.
- Hızlı koşarsın ama **çok daha fazla ses** çıkarırsın (koşu ses yarıçapı).
- **Dayanıklılık barı** (madencinin başının üstünde, küçük pixel art bar):
  - Koşarken azalır, dolu bar yaklaşık **4.5 saniyede** biter.
  - Koşmayınca kısa bir beklemeden (~0.9 sn) sonra yavaşça dolar (boştan doluya ~6 sn).
  - Bitince sprint otomatik kapanır, bar ve buton kırmızı yanıp söner, madenci nefes nefese kalır (ses). Bar **%35**'e dolana kadar tekrar koşulamaz.
  - Bar doluyken solup kaybolur; sadece kullanılırken görünür.
- Koşmak açlığı daha hızlı düşürür.
- Değerler `src/config.js` içinde (SPRINT_MULT, STAMINA_*).

### Taş atma
- Atılan taş düştüğü yerde ses çıkarır ve Gromm'u oraya çeker (duyma özelliği varsa).
- Gromm'da **hafıza** özelliği varsa aynı numaraya iki kere kanmaz.

### Karanlık bölgeler ve meşale
- Madenin çoğu duvar lambaları ve meşalelerle **loş ama görülebilir**. Oyuncu yolları, cevherleri ve çevreyi görebilir.
- Haritada belirli **karanlık bölgeler** var (en derin tüneller, değerli cevherlerin olduğu odalar). Buralar zifiri karanlıktır.
- Karanlık bölgelerin girişi belli olur: söndürülmüş lambalar, uyarı tabelası ve karanlığa doğru kararan bir geçiş.
- Girişte bir **meşale standı** vardır. Standa tıklayan madenci meşaleyi eline alır. Elinde meşale varken **boş bir standa** dokunursa meşaleyi geri bırakır (görme özelliği olan Gromm'dan saklanmak için). Elinde meşale varken etrafında titreyen, sıcak bir ışık dairesi olur; karanlık bölgede ancak o kadarını görür.
- Meşalesiz karanlık bölgeye giren madenci neredeyse hiçbir şey göremez.
- Meşalenin ışığı Gromm'un **görme** özelliğiyle bağlantılıdır (ışık taşıyan madenci uzaktan fark edilir).

### Açlık ve soğuk
- **Açlık barı** zamanla düşer. Erzak sandıklarından yemek yiyerek doldurulur.
- **Sıcaklık barı** zamanla düşer. Duvardaki **meşalelerin** yanında durunca dolar.
- Bar sıfıra yaklaşınca madenci yavaşlar. Sıfırlanırsa ölür.
- Gromm **görme** özelliğini aldıysa meşalenin ışığında durmak tehlikelidir. Gromm **koklama** özelliğini aldıysa yemek yemek iz bırakır.

### Ölüm
- Gromm yakalarsa veya açlık/soğuk sıfırlanırsa **bölüm baştan başlar.** Can sistemi yok.

### Jumpscare (Gromm yakalayınca)
1. Oyun bir an donar (~0.2 sn), ekran kararır.
2. Ekranı kaplayan, önden görünen büyük bir **Gromm yüzü** belirir: kodla çizilmiş 64x64 pixel art (koyu mor/gri taşımsı deri, parlayan kırmızı gözler, açık ağız, sivri dişler), tam sayı katlarıyla büyütülür (`src/jumpscare.js`).
3. Yüz hızla yaklaşır (büyür), ekran sert sarsılır, kırmızı flaş olur.
4. Aynı anda Web Audio ile yüksek, bozuk, kısa bir çığlık/kükreme çalar (`playScream`).
5. Toplam ~1.25 sn; sonra kararır, "Gromm seni yakaladı" yazısıyla bölüm baştan başlar.
- **Ayarlar** (sağ üstteki dişli): "Ses: Açık/Kapalı" ve "Jumpscare: Açık/Kapalı". Jumpscare kapalıysa yakalanınca sadece kararma ve yazı olur. Ayarlar tarayıcıda saklanır; panel açıkken oyun duraklar.

---

## Gromm

Dev bir yaratık. Madenciden kat kat büyük. Karanlıkta önce **parlayan gözleri** fark edilir.

### Temel davranış (her bölümde var)
- **Temel algı (1. bölüm, özelliksiz):** Neredeyse kör ve sağır. Madenciyi sadece **çok yakınındaysa (~2 tile)** fark eder; bu mesafede **arada duvar olsa bile** fark eder. Aksi halde rastgele dolaşır.
- **Kovalama:** Fark edince **her zaman koşarak** kovalar. Kovalarken görüş hattı olan madenciyi ~8 tile'a kadar izleyebilir.
- **Vazgeçme:**
  - Görüş kesilince madencinin **en son görüldüğü yere** gider; orada bulamazsa **2-3 saniye etrafına bakınır**, sonra dolaşmaya döner.
  - Madenci yaklaşık **8 tile** uzaklaşırsa kovalamayı bırakır.
- **Hız dengesi:** Dolaşırken madencinin yürüyüşünden yavaş (%75); kovalarken yürüyüşünden hızlı (%106) ama **sprintten belirgin şekilde yavaş**. Özellikler ve bölümler Gromm'u **hızlandırmaz** (sadece final kaçışında biraz hızlanır, yine de sprintin %90'ını geçmez).
- **Hantallık:** Keskin dönüşlerde yavaşlar, köşelerde savrulur.
- **Yakalama:** Sadece sprite'lar değdiğinde değil, gerçekten yakaladığında (ayaklar arası ~14 px) öldürür.
- Değerler `src/gromm.js` içindeki `GROMM` nesnesinde.
- **Kazma:** Bir duvarın içine kazarak girer, kayanın içinden ilerler ve başka bir yerden patlayarak çıkar (bkz. Gromm'un kazması).

### Özellik havuzu
Havuzda **4 özellik** var: duyma, görme, koklama, hafıza. Sıra her yeni oyunda karıştırılır. 2, 3, 4 ve 5. bölümlerde birer özellik eklenir (eskiler kalır); 6. bölümde (final) dördü de aktiftir. Özellikler Gromm'u hızlandırmaz, **madenciyi bulmasını kolaylaştırır**.

| Özellik | Etkisi |
|---|---|
| Görme | Görüş hattı varsa madenciyi ~8 tile'dan görür. Yanan meşaleyi daha uzaktan (~12 tile) fark eder. Karanlık bölgede meşalesi sönük madenciyi göremez. |
| Duyma | Seslerin geldiği yere gider. Yarıçaplar: yürüme < kazma < koşu < dinamit kurma < şalter. |
| Koklama | Madencinin bıraktığı görünmez izi takip eder. Yemek yedikten sonra 15 sn iz 2 kat güçlüdür. |
| Hafıza | Madenciyi en son gördüğü birkaç yeri ve asansör çevresini düzenli kontrol eder. |

Uygulama ayrıntıları (`src/gromm.js`, `src/abilities.js`):
- Sıra oyun başında karıştırılır ve oyun boyunca sabittir; ölüp bölümü tekrar oynamak sırayı değiştirmez.
- **Duyma:** Ses olaylarının yarıçapı içindeyse sesin geldiği yere gider (yürüme 70 < kazma 170 < koşu 280 < dinamit 420 < şalter 560 px; `NOISE` in `src/config.js`).
- **Görme:** Görüş hattıyla 8 tile, yanan meşaleli madenciyi 12 tile. Saklanan (karanlıkta, meşalesi sönük) madenciyi görmez.
- **Koklama:** İz ~25 sn kalır (güçlü izde 2 kat süre ve menzil). Bir kovalamayı bıraktıktan sonra birkaç saniye koku almaz. ~5 tile içindeki izin en taze noktasına gider (iz koklarken yavaş yürür).
- **Hafıza:** Son 3 görülme yerini hatırlar. Kaybedince son görüldüğü yere, sonra asansörün çevresine bakar; dolaşırken ~35 sn'de bir sırayla asansörü ve bu yerleri kontrol eder.
- Test için: `?abilities=duyma,gorme` (her bölümde bu özellikler), `?level=3` (3. bölümden başla).

### Ağırlık hissi ("güm güm")
Gromm çok ağır bir yaratık. Oyuncu onu görmeden önce **duymalı ve hissetmeli.**
- **Ses:** Her el yere değdiğinde derin bir "GÜM". Uzaktayken boğuk ve kısık, yaklaştıkça sert ve yüksek (bkz. Ses bölümü).
- **Ekran sarsıntısı:** Her adımda ekran hafifçe titrer. Sarsıntı Gromm'a olan mesafeyle artar.
- **Toz ve taş:** Bastığı yerden toz kalkar. Yakındaysa tavandan küçük taşlar düşer, meşale ışıkları titrer.
- **İz:** Geçtiği yerde bir süre kalıp sonra kaybolan çatlaklar ve el izleri.
- **Hareket:** Hızlı ama hantal. Ani dönemez, dururken ve kalkarken ivmesi hissedilir. Keskin dönüşlerde yavaşlar, köşelerde savrulur (yana ivmesi düşük). Oyuncu keskin dönüşlerle kaçabilmeli.

### Oyun içi ses yarıçapları (Gromm'un duyması için)
Her ses kaynağının bir yarıçapı olsun (küçükten büyüğe): yürüme < kazma < koşu < dinamit kurma < şalter. Gromm duyma özelliğine sahipse yarıçapın içindeyse sese yönelir.

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

Haritalar (`src/levels.js`; hepsi en az 72x52, geniş tüneller ve kaçış döngüleri):
- **1. Eski Maden** (72x52): asansör salonu KB'de, raylı kuzey galeri, adacıklı orta salon, tek girişli karanlık Derin Damar.
- **2. Yarık** (76x52): ortada üç adacıklı uzun bir yarık, güneyde asansör salonu, köşelerde odalar, KD'de iki girişli karanlık oda.
- **3. Kuyular** (72x56): ortada asansörlü merkez, halka koridor ve dört oda; GD'de iki girişli karanlık oda.
- **4. Derin Galeriler** (72x60): üstte asansör, iki uzun dikey galeri ve üç yatay salon; sol alt galeri iki girişli karanlık tünel.
- **5. Gromm'un İni** (80x58): kuzeyde asansör, üç adacıklı büyük orta salon, dört köşede birer şalter; KD ve GB'de iki girişli karanlık odalar.
- Her haritada hedeften 1-2 fazla cevher var. Şalterler asansörden uzakta ve farklı yönlerde, en az biri karanlık bölgede.
- **Şalter içeren karanlık bölgeler iki girişli olmalı:** şalter sesi Gromm'u çeker, tek girişli bir odada madenci kapana kısılır.
- Bölüm bitince açılış ekranıyla sonraki bölüme geçilir; 5. bölümden sonra şimdilik "Final yakında" ekranı. Ölünce sadece o bölüm baştan başlar.
- Test için `?level=3` ile istenen bölümden başlanabilir.

### Bölüm geçiş ekranları
Oyun başlayınca ve her bölümün başında: siyah ekran, ortada büyük pixel yazı (sığmazsa satırlara bölünür), üstte küçük harflerle bölüm numarası ("BÖLÜM 2"), altında küçük bir ipucu, arkada derin bir kükreme/gümbürtü. Yazı ~3 saniye kalır, dokununca geçilebilir; sonra bölüm yavaşça aydınlanarak başlar. Ölünce açılış ekranı gösterilmez, bölüm doğrudan baştan başlar (`src/scenes/intro.js`).

- Bölüm 1: "GROMM HAREKET EDEBİLİR" / İpucu: "Cevherleri asansöre taşı. Yakalanma."
- Sonraki bölümler, gelen özelliğe göre:
  - Duyma: "Gromm artık seni DUYABİLİYOR." / İpucu: "Koşmak ve şalterler ses çıkarır."
  - Görme: "Gromm artık ışığı GÖREBİLİYOR." / İpucu: "Meşaleler seni ele verir."
  - Koklama: "Gromm artık seni KOKLAYABİLİYOR." / İpucu: "Yemek yemek iz bırakır."
  - Hafıza: "Gromm seni HATIRLIYOR." / İpucu: "Aynı numara iki kere işlemez."

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
- **Işık:** Madenin tamamı karanlık **değil**.
  - **Normal bölgeler:** Duvar lambaları ve meşalelerle loş ama rahat görülebilir. Lambaların çevresinde sıcak turuncu ışık havuzları, aralarda soğuk tonlu gölgeler, köşeler ve dar yerler daha karanlık.
  - **Karanlık bölgeler:** Haritada sınırları belli, zifiri karanlık özel alanlar. Orada tek ışık madencinin elindeki meşaledir (bkz. Oynanış > Karanlık bölgeler ve meşale).
  - Madencinin fener konisi yok; asıl ışık kaynakları ortam lambaları ve meşaledir. Madencinin etrafında sadece çok küçük bir hale var.
  - Duvarlar ışığı keser. Işık kenarlarında **dithering** (piksel desenli geçiş) kullan, yumuşak gradyan değil. Işıklı yerler sıcak sarı-turuncu, karanlık yerler soğuk koyu mavi-mor.
- **Kendi ışığı olanlar:** Gromm'un gözleri, meşale alevleri, lamba camları ve kristal parıltıları karanlıkta da görünür.
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
13. Rastgele özellik havuzu ve 4 özelliğin yapay zekası.
14. Bölüm geçiş ekranları ve 2–5. bölüm haritaları.
15. Sesler ve son cilalar.
16. Final bölümü (tasarımı sonra yapılacak).

---

## Açık konular (sonra karar verilecek)
- Final bölümünün tasarımı.
- Meşalenin bir süre sonra sönmesi (yakıt) eklensin mi? (Şimdilik meşale sadece bir standa geri bırakılabiliyor; yere bırakma yok.)
- Cevher türleri farklı olsun mu (ağır/değerli/gürültülü)?
