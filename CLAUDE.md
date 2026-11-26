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
- **Eski tarayıcılar** (eski iPhone/iPad Safari'leri, eski Android Chrome'ları dahil):
  - `index.html` küçük bir yükleyiciyle tarayıcıyı yoklar: modern sözdizimini (`?.`, `??`, `...`, `catch {}`) ve modülleri tanıyanlar `src/main.js`'i doğrudan modül olarak yükler; tanımayanlar ES2015'e çevrilmiş tek dosyalık **`legacy/gromm.js`**'i yükler. Hiçbiri çalışmazsa birkaç saniye sonra "tarayıcı çok eski" uyarısı çıkar.
  - **`src/` değişince `tools/build-legacy.sh` çalıştır ve `legacy/gromm.js`'i de commit'le** (esbuild ile, Node gerekir). Yoksa eski tarayıcılar eski sürümü oynar.
  - Test için `?legacy` eski sürümü zorlar.
  - Girdi Pointer Events ile; olmayan tarayıcılarda (iOS 12 ve öncesi) dokunma + fare olaylarına düşer (`onPointer`, `src/input.js`). Yeni bir dokunma dinleyicisi eklerken bunu kullan.
  - Eksik olabilecek API'ler için `src/compat.js` (ilk import) küçük tamamlayıcılar içerir; ses `webkitAudioContext`'e düşer, StereoPanner yoksa sesler ortadan çalar. Türkçe büyük harf yerel ayar verisine güvenmeden yapılır (i→İ).
  - CSS'te yeni özelliklerin (`inset`, `env()`, `max()`) yanında eski karşılığını da ver.
- Her özellikten sonra oyunu tarayıcıda açıp test et. Küçük ve anlamlı commit'ler at.

---

## Kontroller (sadece tıklama)

| Eylem | Nasıl |
|---|---|
| Yürü | Haritada bir yere tıkla. Madenci **A\* yol bulma** ile engellerin etrafından gider (LoL gibi). Tıklanan yerde küçük bir işaret çıksın. |
| Cevher kaz | Cevhere tıkla. Madenci yanına gider ve kazar. |
| Asansöre yükle | Asansöre tıkla. Taşınan cevherler yüklenir. |
| Şalter indir | Şaltere tıkla. |
| Yemek ye | Yerdeki yemeğe (ekmek, et, konserve) tıkla. |
| Meşale al | Yerdeki sönük meşaleye veya karanlık bölge girişindeki meşale standına tıkla. |
| Elindekini bırak | Sağ alttaki **Bırak butonu** (sprintin solunda). Eli boşken soluk ve basılamaz. |
| Taş topla | Yerdeki taşa tıkla (en fazla 3). |
| Taş at | Sağdaki **taş butonuna** bas, sonra hedef noktaya tıkla. |
| Koş | Sağdaki **sprint butonu**. Mouse ile hem butonu basılı tutup hem başka yere tıklamak mümkün olmadığı için **aç/kapa** şeklinde çalışsın. |

Butonlar ekranın **sağ tarafında**, telefonda başparmakla rahat basılacak büyüklükte (en az 44px) olsun.

### Arayüz yerleşimi
- **Sol üst:** küçük, yarı saydam, pixel art **minimap**. Sadece mağaranın yapısını (yollar), oyuncunun konumunu (yanıp sönen nokta) ve asansörü (belirgin simge) gösterir; karanlık bölgeler daha koyu. Cevherleri, Gromm'u ve şalterleri **göstermez**. Dokunmaları engellemez. Diğer arayüz öğeleri sol üstten uzak tutulur.
- **Üst orta:** kompakt sayaçlar (asansördeki cevher, taşınan cevher, şalterler) — sadece simge ve sayı.
- **Sağ üst:** ses ve duraklatma ("II") butonları. **Sağ alt:** sprint butonu ve solunda Bırak butonu.

---

## Oynanış

### Hedef
Her bölümde belirli sayıda cevheri asansöre yükle, şalterleri indirerek asansöre güç ver, asansöre binip bölümü geç.

### Harita
- Haritalar büyük olsun (en az 60x45 tile). Labirent değil, okunabilir bir yapı: **birkaç büyük oda** ve onları bağlayan **geniş tüneller (en az 4 tile)**.
- Ölü uç az olsun. Madencinin Gromm'un etrafından dolaşıp kaçabilmesi için **en az 2-3 büyük döngü** olsun.
- Odalarda etrafında dönülebilen büyük **kaya adacıkları/sütunlar** olsun (Gromm'un önünü kesmek ve kaçmak için).
- Oyuncu haritanın genel yapısını kısa sürede kavrayabilmeli: asansör salonu, karanlık bölge ve cevher odaları kolay ayırt edilsin (raylar, kristaller, uyarı tabelası gibi belirgin işaretler).

### Tek el kuralı (elde taşıma)
- Madencinin elinde aynı anda **sadece bir şey** olabilir: **meşale**, **cevher** ya da **dinamit** (finalde).
- Elinde bir şey varken başka bir taşınabilir eşyaya (meşale, cevher, dinamit, dolu stand) dokunursa almaz; kısa bir uyarı çıkar ("Elin dolu, önce bırak.") ve **Bırak** butonu kısa süre parlar.
- **Kazmak iki el ister:** elinde bir şey varken cevher kazamaz, aynı uyarı çıkar. Kazılan cevher eline geçer.
- **Yemek elde taşınmaz:** dokununca anında yenir, el doluyken de yenebilir.
- Elinde ne olduğu sprite'ta açıkça görünür: meşale alevi, göğüs hizasında tutulan cevher (renkli, hafif parıltılı), dinamit.
- **Bırak butonu** elindekini ayaklarının dibine bırakır; yere bırakılan her şey sonra tekrar alınabilir. Cevher ve dinamit olduğu yerde kalır; meşale yanmaya devam eder (bkz. aşağıda).
- Cevher taşırken **hafifçe yavaşlar (~%15)**. Her cevher için asansöre gidip gelmek gerekir; bu yolculuklar Gromm'la karşılaşma riskini oluşturur.
- Değerler `src/config.js` içinde (MAX_CARRY, CARRY_SLOWDOWN). Uygulama: `src/player.js` (`held`, `handFull`), `src/scenes/play.js` > Elde taşıma.

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

### Karanlık, meşale ve saklanma
- **Genel karanlık:** Normal bölgeler karanlık ve tehlikeli hissettirir ama yol görülebilir. Lambaların ve meşalelerin arası karanlık, köşeler ve duvar dipleri daha da karanlık. Işık havuzları sıcak, titrek ve belirgin; ışıklı/karanlık sınırı dithering ile keskin.
- **Karanlık bölgeler:** Haritada sınırları belli, meşalesiz zifiri karanlık alanlar. Girişleri belli olur: söndürülmüş lambalar, uyarı tabelası ve kararan bir geçiş. Girişte bir **meşale standı** vardır.
- **Meşale bir eşyadır** (envanter özelliği değil; söndürme/yakma butonu yok). Sadece yerde bulunur: yerdeki sönük meşalelere (bölüm başına 4-5, bölümün tohumuyla her denemede aynı yerlerde; `src/items.js`) ve karanlık bölge girişlerindeki standlara dokununca madenci gidip alır ve yakar. Karanlıkta hafifçe parlarlar.
- Meşalenin iki işi var:
  - **Işık:** etrafı aydınlatır; karanlık bölgede yolu görmenin tek yolu.
  - **Isı:** yanan meşaleye yakın olan madenci ısınır (elinde de olsa, yanında yerde de dursa).
- Her meşalenin kendi yanma süresi var (~**2 dk**, `TORCH_BURN_TIME`). Son ~20 sn titreyip kararır, sonra söner ve yok olur (kısa süre duman ve kararmış bir çubuk kalır). Kullanılmamış yerdeki meşalelerin süresi azalmaz. Elindeyken başının üstünde küçük bir süre göstergesi görünür.
- **Yere bırakılan meşale yanmaya devam eder** (süresi azalır): etrafını aydınlatır ve ısıtır; madenci onu bir cevherin yanına bırakıp ışığında kazabilir. Görme özelliği varsa Gromm yerdeki meşalenin ışığını uzaktan fark edip oraya gider (yem olarak kullanılabilir; aynı meşaleye bir kez bakar).
- **Saklanma:** Madenci karanlık bir bölgedeyse ve yakınında yanan bir meşale (elinde ya da yerde) yoksa Gromm onu **göremez** (sadece neredeyse dibine gelirse fark eder). Yani saklanmak için meşaleyi bırakıp karanlığa uzaklaşmak gerekir. Kovalıyorsa karanlığa girdiği noktaya kadar gelir, 2-3 sn bakınır, vazgeçer. Karanlıkta madencinin çevresinde zar zor seçilen çok küçük bir alan görünür.
- Özellikler saklanmayı zorlaştırır: **duyma** varsa karanlıkta koşmak/kazmak Gromm'u çeker; **koklama** izi karanlıkta da takip eder; **hafıza** madenciyi en son gördüğü yerleri (ör. karanlık bir girişi) sonra tekrar kontrol eder.
- **Tipik akış:** karanlık bölge girişinde meşale al → karanlıkta yolunu bul → cevherin yanında Bırak'a bas → meşale yerde yanarken kaz → cevheri al → asansöre taşı (meşale geride yanar, süresi varsa dönüp alınabilir). Karanlıkta meşaleyle bir cevhere yaklaşınca bir kez: "Kazmak için meşaleyi bırak."
- Gromm karanlık bölgelere girebilir; orada sadece kırmızı gözleri, güm sesleri ve ekran sarsıntısıyla anlaşılır.
- 1. bölümde bir karanlık bölgenin girişinde bir kez: "Meşaleni bırak ve karanlığa saklan. Gromm seni göremez."

### Açlık ve soğuk (hafif bir baskı; asıl tehlike Gromm)
- **Barlar:** Sol üstte, minimap'in hemen altında, aynı genişlikte iki küçük pixel art bar ve simgeleri. Açlık: ekmek simgesi, turuncu-kahverengi. Sıcaklık: alev/kar tanesi simgesi, ısındıkça turuncu, soğudukça buz mavisi. %25'in altında yavaşça yanıp söner. Dokunmayı engellemez.
- **Açlık:** Dolu bardan sıfıra ~6 dk, koşarken biraz daha hızlı. Yerdeki yemeklere dokununca madenci gidip yer (ekmek +%35, et/konserve +%60), kısa yeme animasyonu ve sesi. Yemek yemek koklama özelliği için 15 sn güçlü iz bırakır. %15'in altında hafif yavaşlama ve ara sıra mide guruldaması. Sıfırsa bayılır (ölüm).
- **Soğuk:** Sıfıra ~4 dk, karanlık bölgelerde biraz daha hızlı. Duvar meşalesi, lamba veya dolu stand yanında hızla ısınır (küçük sıcaklık parıltıları); elinde ya da yanında yerde yanan bir meşale varken yavaşça ısınır.
  - %50 altı: sprite'a hafif mavi ton. %25 altı: belirgin mavi, sprite titrer, nefesten buhar, ekran kenarlarından buz kristalleri büyür, ara sıra diş takırtısı. %10 altı: neredeyse buz rengi, hareket yavaşlar, ekran kenarları buzla kaplanır. Isınınca hepsi yumuşakça geri gider.
  - Sıfırsa donar (ölüm).
- **Yerdeki eşyalar** (`src/items.js`): bölüm başına 3-4 yemek (ekmek, et, konserve) ve 4-5 sönük meşale; bölümün tohumuyla her denemede aynı yerlerde, bir kısmı Gromm'un dolaştığı açık yerlerde. Karanlıkta hafifçe parlarlar. Yemek el doluyken de yenir; meşale tek el kuralına uyar.
- Değerler `src/config.js` içinde (HUNGER_*, COLD_*, WARM_*, FOOD). Test: `?survival=fast` barları 5 kat hızlı azaltır.

### Ölüm ve kayıt
- **Ölüm** (Gromm, açlık, donma, finalde süre bitmesi): varsa jumpscare, sonra ölüm ekranı ("Gromm seni yakaladı" / "Açlıktan bayıldın" / "Dondun" / "Mağara çöktü"), altında "Bölüm 4'e kadar geldin. Süre: 14 dk"; dokununca ana menü (`src/scenes/death.js`). Can sistemi yok.
- Ölünce oyun **tamamen sıfırlanır**: sonraki oyun 1. bölümden ve yeni bir rastgele özellik sırasıyla başlar; varsa kayıt silinir.
- **Duraklatma:** oyun içinde sağ üstte "II". Menü: Devam Et, Ayarlar, (Gazeteyi Oku), Kaydet ve Çık. Menü açıkken oyun duraklar.
- **Kaydet ve Çık** (`src/save.js`, localStorage `gromm.save`): ulaşılan bölüm, Gromm'un özellik sırası ve toplam süre. Bölüm içindeki konum kaydedilmez; kayıt yüklenince o bölümün başından başlanır. Ana menüde "Devam Et"in üstünde "Bölüm 3 · 12 dk".
- Kayıt **yüklendiği anda silinir**; kayıttan devam edip ölen oyuncu yine 1. bölümden başlar.
- Kayıt varken "Yeni Oyun": oyunun kendi çizdiği onay kutusu "Kayıtlı oyunun silinecek. Emin misin?" (tarayıcı confirm'i değil).
- localStorage yoksa oyun çökmez: "Kaydet ve Çık" yerine "Ana Menüye Dön" görünür ve ilerlemenin kaydedilmeyeceği yazar.

### Jumpscare (Gromm yakalayınca)
1. Oyun bir an donar (~0.2 sn), ekran kararır.
2. Ekranı kaplayan, önden görünen büyük bir **Gromm yüzü** belirir: kodla çizilmiş 64x64 pixel art (koyu mor/gri taşımsı deri, parlayan kırmızı gözler, açık ağız, sivri dişler), tam sayı katlarıyla büyütülür (`src/jumpscare.js`).
3. Yüz hızla yaklaşır (büyür), ekran sert sarsılır, kırmızı flaş olur.
4. Aynı anda Web Audio ile yüksek, bozuk, kısa bir çığlık/kükreme çalar (`playScream`).
5. Toplam ~1.25 sn; sonra kararır ve ölüm ekranı gelir.
- **Ayarlar** (ana menüde ve duraklatma menüsünde): "Müzik", "Ses efektleri", "Jumpscare" (Açık/Kapalı). Jumpscare kapalıysa yakalanınca sadece kararma ve ölüm ekranı olur. Ayarlar tarayıcıda saklanır (`src/settings.js`).

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
- **Kazma:** Bir duvarın içine kazarak girer, kayanın içinden ilerler ve başka bir yerden patlayarak çıkar (bkz. Gromm'un kazması aşağıda).

### Özellik havuzu
Havuzda **4 özellik** var: duyma, görme, koklama, hafıza. Sıra her yeni oyunda karıştırılır. 2, 3, 4 ve 5. bölümlerde birer özellik eklenir (eskiler kalır); 6. bölümde (final) dördü de aktiftir. Özellikler Gromm'u hızlandırmaz, **madenciyi bulmasını kolaylaştırır**.

| Özellik | Etkisi |
|---|---|
| Görme | Görüş hattı varsa madenciyi ~8 tile'dan görür. Elinde yanan meşale olanı daha uzaktan (~12 tile) fark eder; yerde yanan meşalelerin ışığına da gider. Karanlıkta, yakınında yanan meşale olmayan madenciyi göremez. |
| Duyma | Seslerin geldiği yere gider. Yarıçaplar: yürüme < kazma < koşu < dinamit kurma < şalter. |
| Koklama | Madencinin bıraktığı görünmez izi takip eder. Yemek yedikten sonra 15 sn iz 2 kat güçlüdür. |
| Hafıza | Madenciyi en son gördüğü birkaç yeri ve asansör çevresini düzenli kontrol eder. |

Uygulama ayrıntıları (`src/gromm.js`, `src/abilities.js`):
- Sıra oyun başında karıştırılır ve oyun boyunca sabittir; ölüp bölümü tekrar oynamak sırayı değiştirmez.
- **Duyma:** Ses olaylarının yarıçapı içindeyse sesin geldiği yere gider (yürüme 70 < kazma 170 < koşu 280 < dinamit 420 < şalter 560 px; `NOISE` in `src/config.js`).
- **Görme:** Görüş hattıyla 8 tile, elinde yanan meşale olan madenciyi 12 tile. Yerde yanan bir meşalenin ışığını 12 tile'dan (görüş hattıyla) fark edip oraya gider, her meşaleye bir kez. Saklanan (karanlıkta, yakınında yanan meşale yok) madenciyi görmez.
- **Koklama:** İz ~25 sn kalır (güçlü izde 2 kat süre ve menzil). Bir kovalamayı bıraktıktan sonra birkaç saniye koku almaz. ~5 tile içindeki izin en taze noktasına gider (iz koklarken yavaş yürür).
- **Hafıza:** Son 3 görülme yerini hatırlar. Kaybedince son görüldüğü yere, sonra asansörün çevresine bakar; dolaşırken ~35 sn'de bir sırayla asansörü ve bu yerleri kontrol eder.
- Test için: `?abilities=duyma,gorme` (her bölümde bu özellikler), `?level=3` (3. bölümden başla).

### Gromm'un kazması (her bölümde)
Gromm'un imza hareketi. Gerilimli ama **adil**: oyuncu her zaman uyarı alır ve kaçma şansı olur. (`src/gromm.js` > kazma, efektler `src/scenes/play.js` > Gromm'un kazması)
- **Ne zaman:** Dolaşırken 20-30 sn'de bir, yakındaki bir duvarın öbür tarafındaki başka bir bölgeye geçmek için (yürüyerek gitmek zaten kısaysa kazmaz). Bir hedefe giderken (kovalama, ses, iz, son görülen yer) duvarın içinden giden yol yürüme yolunun yarısından kısaysa. İki kazma arası en az 15 sn. Duvarın içinden en fazla ~10 tile.
- **Çıkış:** Her zaman yürünebilir zemin (ve yürüyerek ulaşılabilir). Asansörün çevresine (3 tile) ve madencinin 3 tile yakınına çıkamaz. Uyarı bittiğinde madenci çıkış yerine gelmişse Gromm üstüne çıkmaz, yeraltında başka bir yere geçer.
- **Aşamalar:**
  1. Dalış (~1 sn): duvara döner, kazar (stomp animasyonu), taş ve toz saçılır, kazma sesi; içine dalınca girişte çatlak bir oyuk kalır.
  2. Yeraltı: görünmez; ilerleyen bir çatlak çizgisi ve kabaran toprak, toz ve zıplayan taşlar, konuma göre (stereo + uzaklık) sürekli gümbürtü, yakınsa ekran titrer. Karanlık bölgede çatlak görünmez, sadece ses ve titreşim. Yeraltında yakalayamaz; hızı yürüyüşüne yakın.
  3. Çıkış uyarısı (~1.15 sn): zemin kabarır, çatlaklar yıldız gibi yayılır, taşlar titrer, gümbürtü yükselir.
  4. Patlayarak çıkış: kaya parçaları, büyük toz bulutu, güçlü sarsıntı, kükreme; bir süre kalan krater.
  5. Toparlanma (~1 sn): sersemler, silkelenir; bu sırada yakalayamaz.
- Yeraltında görme hariç özellikler çalışır: duyma ve koklama çıkış yerini belirler (yeraltındayken duyduğu sese/tazelenen ize yönelir), hafıza son görüldüğü yerin yakınını tercih eder.
- Harita ve yollar değişmez. Oyuk ve kraterler solup kaybolur. Minimap kazmayı göstermez.
- Test: `?digdebug` (kazma yolu, çıkış noktası, bekleme süreleri), `?digsoon` (birkaç saniyede bir kazar).

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

## Ana menü (`src/scenes/menu.js`)
- Akış: "Başlamak için dokun" → ana menü (müzik başlar) → Yeni Oyun → bölüm açılış ekranı.
- Arka planda yavaşça yaşayan karanlık bir maden: titreyen meşale ve dithering'li ışık havuzu, toz, karanlıkta ara sıra yanıp sönen kırmızı gözler, ara sıra hafif sarsıntı ve uzaktan güm sesi.
- Ortada taş oyma görünümlü pixel art "GROMM" başlığı.
- Büyük butonlar: Yeni Oyun, Devam Et (sadece kayıt varsa), Ayarlar, Nasıl Oynanır (kısa satırlar ve küçük pixel simgeler).
- Test: `?level=N` menüyü atlayıp doğrudan o bölümden yeni oyun başlatır.

## Bölümler

| Bölüm | Cevher | Şalter | Gromm |
|---|---|---|---|
| 1 | 3 | 0 | Dolaşma + kazma |
| 2 | 5 | 1 | + 1 rastgele özellik |
| 3 | 5 | 2 | + 1 rastgele özellik |
| 4 | 5 | 3 | + 1 rastgele özellik |
| 5 | 6 | 4 | + 1 rastgele özellik |
| 6 (final) | - (4 dinamit) | - | Dört özellik de aktif |

Haritalar (`src/levels.js`; hepsi en az 72x52, geniş tüneller ve kaçış döngüleri):
- **1. Eski Maden** (72x52): asansör salonu KB'de, raylı kuzey galeri, adacıklı orta salon, tek girişli karanlık Derin Damar.
- **2. Yarık** (76x52): ortada üç adacıklı uzun bir yarık, güneyde asansör salonu, köşelerde odalar, KD'de iki girişli karanlık oda.
- **3. Kuyular** (72x56): ortada asansörlü merkez, halka koridor ve dört oda; GD'de iki girişli karanlık oda.
- **4. Derin Galeriler** (72x60): üstte asansör, iki uzun dikey galeri ve üç yatay salon; sol alt galeri iki girişli karanlık tünel.
- **5. Gromm'un İni** (80x58): kuzeyde asansör, üç adacıklı büyük orta salon, dört köşede birer şalter; KD ve GB'de iki girişli karanlık odalar.
- **6. Çöküş** (92x64, en büyük): güneyde asansör salonu, ortada üç adacıklı büyük salon, kuzeyde galeri, dört köşede birer oda ve patlatma noktası; KD ve GB'de iki girişli karanlık odalar. Harita karakteri `X` patlatma noktası (zemine bakan duvar yüzü).
- Haritada hedefin ~2-2.5 katı cevher var (1. bölüm 8, 2-4. bölüm 12-13, 5. bölüm 14); bir kısmı 2-3'lük damarlar halinde. Asansöre yakın olanlar az (9 tile içinde yok), uzakta ve karanlık bölgelerde olanlar çok. Oyuncu cevher aramakla vakit kaybetmez; asıl gerilim onları Gromm'a yakalanmadan taşımak. Tek cevher taşıma kuralı aynen geçerli; finalde cevher yok. Şalterler asansörden uzakta ve farklı yönlerde, en az biri karanlık bölgede.
- **Şalter içeren karanlık bölgeler iki girişli olmalı:** şalter sesi Gromm'u çeker, tek girişli bir odada madenci kapana kısılır.
- Bölüm bitince açılış ekranıyla sonraki bölüme geçilir; 5. bölümden sonra final (6. bölüm).

### Final bölümü (6. bölüm)
- Gromm'un dört özelliği de aktif. Cevher yok. Görev: haritaya dağılmış **dinamitleri** bulup işaretli **4 patlatma noktasına** kurmak.
  - Dinamit görselleri: `assets/madenci/minerman-adventure/items/dynamite.png` (yerde ve sırtta) ve `dynamite-pack.png` (kurulmuş paket); değiştirilmeden çizilir.
  - Patlatma noktası: duvarda çatlak, üstünde kırmızı X ve tahta destek. En az biri karanlık bölgede (karanlık bölgeler iki girişli).
  - Madenci dinamiti elinde taşır (tek el kuralı: aynı anda 1, elinde meşale varken alamaz; Bırak ile yere bırakılabilir). Dinamitler (patlatma noktası + 1 adet) bazen karanlık bölgelerde, bazen Gromm'un yolunda.
  - Dinamit kurmak ~3 sn sürer (animasyon ve ses) ve ses çıkarır (duyma yarıçapı: dinamit). Başka yere dokunmak kurmayı yarıda keser.
  - Üst ortada "Dinamit: 2/4" sayacı. Minimap patlatma noktalarını gösterir (kırmızı X, kurulunca yeşil), dinamitleri göstermez.
- 4. dinamit kurulunca fitiller yanar, **60 sn** geri sayım başlar (üst ortada büyük sayı), asansörün kilidi açılır. Mağara sallanır, tavandan taşlar düşer, Gromm öfkeyle kükreyip kovalar: madencinin yerini bilir, biraz hızlanır (yine sprintin %90'ını geçmez).
- Asansöre zamanında binersen: asansör yükselirken aşağıda dev patlama, ekran beyaza döner, Gromm'un son kükremesi, sessizlik. Bitiş ekranı: "Kurtuldun." ve toplam süre; ardından jenerik (asset sahipleri, `assets/LICENSES.md`'den; `src/scenes/end.js`) ve ana menü.
- Süre biterse patlama içeride olur: ölüm ("Mağara çöktü").
- Test: `?level=6`.
- Test için `?level=3` ile istenen bölümden başlanabilir.

### Gazete (hikâye girişi)
- Sadece **yeni oyunda** ve **1. bölümde**, başlangıcın birkaç adım yakınında yerde buruşuk eski bir gazete (kodla çizilmiş sarımsı kâğıt, silik satırlar). Karanlıkta hafifçe parlar, üstünde ara sıra "!" veya parıltı belirir.
- Dokununca madenci yürür, eğilip alır, kâğıt hışırtısı çalar (`playPaperRustle`), sonra gazete açılır (`src/newspaper.js`):
  - Arka plan kararır; `assets/gazete.png` oranı bozulmadan ekrana sığan en büyük boyutta, **yumuşak ölçeklemeyle** (pixel art değil, okunaklı) gösterilir. Oyunun canvas'ı yerine üstüne açılan bir HTML katmanında çizilir.
  - Açılış: aşağıdan kayarak gelir, hafif dönerek düzelir.
  - Dokununca dokunulan yere 2 kat yakınlaşır, parmakla kaydırılır; tekrar dokununca uzaklaşır.
  - Köşede "KAPAT" butonu; gazete dışındaki karanlığa dokunmak da kapatır. Açıkken oyun durur.
  - Görsel yoksa "Gazete görseli bulunamadı" uyarısı çıkar.
- Sonra gazete madencide kalır: duraklatma menüsünde "Gazeteyi Oku". Okumak zorunlu değil.

### Bölüm açılış ekranları
Her bölümün başında sade bir ekran (`src/scenes/intro.js`):
- Tamamen siyah, her şey ortada. Üstte küçük gri "Bölüm N/6".
- Ortada büyük beyaz pixel yazıyla Gromm'un kuralları; anahtar kelime kırmızı:
  - Bölüm 1: "GROMM **HAREKET EDEBİLİR**"
  - Duyma: "GROMM **DUYABİLİR**", Görme: "GROMM **GÖREBİLİR**", Koklama: "GROMM **KOKLAYABİLİR**", Hafıza: "GROMM **HATIRLAYABİLİR**"
  - Bölüm 6: önceki kuralların altına "MAĞARAYI **PATLAT**"
- Önceki bölümlerin kuralları alt alta ve soluk; yeni kural en altta, parlak, titreyerek belirir (kısa kükreme).
- Her kuralın solunda kodla çizilmiş küçük, kırmızı gözlü bir Gromm kafası.
- Altta gri "Devam etmek için dokun." Dokununca derin bir gümbürtüyle bölüm yavaşça aydınlanır.
- Oyunun kendi pixel yazı tipi (`src/font.js`, Türkçe karakterli). Sığmazsa yazı küçülür.

---

## Ses

**Bütün sesler kodla, Web Audio API ile üretilecek.** Ses dosyası kullanma. Ayrı bir `audio.js` modülünde, her ses için bir fonksiyon olsun (`playStep()`, `playThud(distance, pan)` gibi).

- **Başlangıç:** Tarayıcılar dokunmadan ses çalmaya izin vermez. Oyun "Başlamak için dokun" ekranıyla açılır, ses sistemi o dokunuşla başlar, sonra ana menüye geçilip müzik başlar.
- **Kanallar:** efektler `sfxBus`, müzik `musicBus` üzerinden (ayarlardan ayrı ayrı kapanır); sağ üstteki ses butonu hepsini susturur.
- **Menü müziği** (`startMenuMusic`/`stopMenuMusic`): yavaş, gizemli; derin bir drone, üstünde seyrek ve yankılı La minör notalar, arada maden sesleri. Kesintisiz döner; oyun başlayınca yavaşça kısılır, oyun içinde sadece ambiyans kalır.
- **Madencinin adımları:** Yürürken hafif çakıl sesi, koşarken daha sert ve sık. Her adımda biraz farklı olsun (perde ve ses seviyesi hafif rastgele).
- **Gromm'un adımları:** Derin, ağır "GÜM" sesleri. Uzaklığa göre ses seviyesi ve boğukluk (low-pass filtre) değişsin. Sağda mı solda mı olduğuna göre stereo kaydırma (pan) yapılsın.
- **Gromm kazarken:** Yerin altından gelen gümbürtü. Çıkarken patlama gibi bir kaya sesi.
- **Ambiyans katmanları:**
  - Arkada sürekli çalan alçak, boğuk bir uğultu (korku ambiyansının temeli).
  - Rastgele aralıklarla su damlası, tahta gıcırtısı, uzaktan taş düşmesi. Tekrar ediyormuş gibi gelmesin.
- **Gerilim:** Gromm yaklaştıkça hızlanan bir kalp atışı sesi.
- **Oyun sesleri:** Kazma vuruşu, cevher toplama, asansöre yükleme, şalter "KLANK!", taş "tak!", yemek yeme, meşale çıtırtısı.
- **Bölüm geçişi:** Derin bir kükreme.
- Oyun içinde sağ üstte bir ses aç/kapa butonu var.

---

## Görsel tarz

- **Pixel art, üstten bakış.** Karanlık ve ürkütücü bir atmosfer.
- **Işık:** Madenin tamamı karanlık **değil**.
  - **Normal bölgeler:** Karanlık ama yol görülebilir. Lambaların ve meşalelerin çevresinde sıcak, titrek turuncu ışık havuzları; aralarda soğuk tonlu karanlık; köşeler ve duvar dipleri daha karanlık.
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
4. Karanlık ve meşaleler (meşale bir eşya; tek el kuralı, Bırak butonu).
5. Cevher kazma, taşıma ve yavaşlama. Asansör ve sayaç.
6. Gromm: dolaşma, yakına gelince kovalama, yakalama.
7. Gromm'un kazma hareketi (çatlaklar, çıkış uyarısı ve efekti).
8. Arayüz: açlık, sıcaklık ve dayanıklılık barları, cevher sayacı, sprint ve taş butonları.
9. Açlık/soğuk, erzak sandıkları, meşalede ısınma.
10. Sprint ve ses sistemi.
11. Şalterler.
12. Taş toplama ve atma.
13. Rastgele özellik havuzu ve 4 özelliğin yapay zekası.
14. Bölüm geçiş ekranları ve 2–5. bölüm haritaları.
15. Sesler ve son cilalar.
16. Final bölümü (dinamitler, geri sayım, kaçış, jenerik).

---

## Açık konular (sonra karar verilecek)
- Cevher türleri farklı olsun mu (ağır/değerli/gürültülü)?
