Büyük bir güncelleme yapacağız. Aşağıdaki bölümleri SIRAYLA yap, her bölümü ayrı commit'le ve her bölümden sonra CLAUDE.md'yi bu kararlara göre güncelle. Önceki talimatlarımla çelişen bir yer varsa BU talimat geçerlidir. İş uzun sürerse kaldığın yeri not et, ben "devam et" deyince oradan sürdür.

Başlamadan önce kontrol et: oyunda tek cevher taşıma, minimap (sol üst), şalterler ve 2-5. bölümler var mı? Eksik olan varsa önce onları CLAUDE.md'ye uygun şekilde yap.

---

## 1. Gromm'un algısı ve özellikleri (düzeltme)

**Temel davranış (her bölümde aynı):**
- Gromm madenciyi fark ettiği anda HER ZAMAN koşarak kovalar. Kovalama hızı: madencinin yürüyüşünden hızlı, sprintinden belirgin şekilde yavaş.
- Hantal: keskin dönüşlerde yavaşlar, köşelerde savrulur.
- Kovalarken madenciyi kaybederse son gördüğü yere gider, 2-3 saniye bakınır, sonra dolaşmaya döner. Madenci yaklaşık 8 tile uzaklaşırsa kovalamayı bırakır.
- Yakalama mesafesi adil olsun: sprite'lar sadece değince değil, gerçekten yakaladığında öldürsün.

**Temel algı (1. bölüm, hiçbir özellik yokken):**
- Neredeyse kör ve sağır. Madenciyi sadece çok yakınındaysa (yaklaşık 2 tile) fark eder. Arada duvar olsa bile bu mesafede fark eder. Dışında sadece rastgele dolaşır.

**Özellik havuzu:**
- "Hız" özelliğini tamamen kaldır. Havuzda 4 özellik var: duyma, görme, koklama, hafıza.
- Yeni oyun başında sıra karıştırılır. 2, 3, 4 ve 5. bölümlerde her bölüm bir tane eklenir, eskiler kalır. 6. bölümde dördü de aktif.
- Özellikler Gromm'u hızlandırmaz, madenciyi BULMASINI kolaylaştırır:
  - **Görme:** Görüş hattı varsa madenciyi yaklaşık 8 tile'dan görür. Yanan meşale ışığını daha da uzaktan fark eder. Karanlık bölgede meşalesi sönük madenciyi göremez.
  - **Duyma:** Ses yarıçapındaki seslere gider. Yarıçaplar: yürüme < kazma < koşu < dinamit kurma < şalter.
  - **Koklama:** Madencinin geçtiği yerlerde görünmez bir iz kalır, Gromm izi takip eder. Yemek yedikten sonraki 15 saniye iz 2 kat güçlüdür.
  - **Hafıza:** Madenciyi en son gördüğü yerleri ve asansörün çevresini düzenli kontrol eder.
- Test: ?abilities=duyma,gorme parametresiyle istenen özelliklerle başlanabilsin.

---

## 2. Bölüm açılış ekranı

Her bölümün başında, şu sade düzende bir ekran:
- Tamamen siyah, her şey ortada.
- Üstte küçük gri harflerle: "Bölüm 1/6"
- Ortada büyük beyaz pixel yazıyla Gromm'un kuralları. Anahtar kelime kırmızı:
  - Bölüm 1: "GROMM [HAREKET EDEBİLİR]"
  - Duyma: "GROMM [DUYABİLİR]"
  - Görme: "GROMM [GÖREBİLİR]"
  - Koklama: "GROMM [KOKLAYABİLİR]"
  - Hafıza: "GROMM [HATIRLAYABİLİR]"
  - Bölüm 6: önceki kuralların altına "MAĞARAYI [PATLAT]"
  (Köşeli parantez içi kırmızı.)
- Önceki bölümlerde kazanılan kurallar alt alta, daha soluk görünsün. Yeni kural en altta, parlak, kısa bir titreme/belirme efektiyle gelsin.
- Kuralın solunda kodla çizilmiş küçük, kırmızı gözlü bir pixel art Gromm kafası olsun. Başka bir oyunun ikonunu kullanma.
- En altta gri: "Devam etmek için dokun."
- Dokununca derin bir gümbürtü sesiyle bölüm yavaşça aydınlanarak başlasın.
- Oyunun kendi pixel yazı tipini kullan (src/font.js). Türkçe karakterler (Ğ, Ü, Ş, İ, Ö, Ç) düzgün görünsün.

---

## 3. Karanlık, meşale ve saklanma

**Genel karanlık:**
- Normal bölgeler şu an fazla aydınlık. Ortam ışığını düşür: lambaların ve meşalelerin arası daha karanlık, köşeler ve duvar dipleri iyice kararsın. Oyuncu yolunu yine görebilsin, ama madenin karanlık ve tehlikeli olduğunu hep hissetsin.
- Işık havuzları sıcak, titrek ve belirgin olsun. Işıklı ve karanlık alan arasındaki fark keskin olsun (dithering ile).
- Karanlık bölgeler meşalesiz zifiri karanlık olsun.

**Meşaleler (hem ışık hem ısı):**
- Yerde sönük meşaleler olsun. Dokununca madenci alır ve yakar.
- Elindeki yanan meşale:
  - Etrafını aydınlatır. Karanlık bölgelerde görmenin tek yolu budur.
  - Isıtır: yanarken sıcaklık azalmaz, yavaşça artar.
  - Yaklaşık 2 dakika yanar. Bitmeye yakın titreyip kararır. Madencinin yanında küçük bir süre göstergesi olsun. Yeni meşale alınca süre yenilenir.
- Karanlık bölge girişlerindeki meşale standları da meşale verir.
- Madencinin elinde/üstünde alev görünsün, kıvılcımlar çıksın.

**Saklanma:**
- Sağ tarafa, sprint butonunun yanına bir meşale butonu ekle. Elinde meşale varken onu söndürüp yakar. Sönükken süresi azalmaz ama ısıtmaz da.
- Madenci karanlık bölgede ve meşalesi sönükken Gromm onu GÖREMEZ. Kovalıyorsa karanlığa girdiği noktaya kadar gelir, 2-3 saniye bakınır, sonra vazgeçer.
- Meşale sönükken madencinin çevresinde çok küçük, zar zor seçilen bir alan görünsün ki oyuncu tamamen kör kalmasın.
- Özellikler saklanmayı zorlaştırsın: Duyma varsa karanlıkta koşmak ya da kazmak Gromm'u çeker. Koklama varsa iz karanlıkta da takip edilir. Hafıza varsa madenciyi en son karanlık bir bölgenin girişinde gördüyse bir süre sonra orayı kontrol eder.
- Gromm karanlık bölgelere girebilir. Oradayken sadece kırmızı gözleri görünsün, yaklaştığı güm sesleri ve ekran sarsıntısından anlaşılsın.
- 1. bölümde bir karanlık bölgenin girişinde bir kez görünen ipucu: "Karanlıkta meşaleni söndür. Gromm seni göremez."

---

## 4. Gromm'un kazma özelliği

Gromm'un imza hareketi, her bölümde var. Gerilimli ama ADİL olmalı: oyuncu her zaman uyarı almalı ve kaçma şansı olmalı.

**Ne zaman kazar:**
- Dolaşırken her 20-30 saniyede bir, haritanın başka bölgesine geçmek için.
- Bir hedefe giderken (kovalama, ses, iz, son görülen yer) duvarın içinden giden yol normal yolun yarısından kısaysa.
- Bir kazmadan sonra en az 15 saniye tekrar kazamaz. Duvarın içinden en fazla yaklaşık 10 tile ilerler.
- Çıkış noktası her zaman yürünebilir zemin olmalı. Asansörün dibine ve madencinin 3 tile yakınına çıkamaz.

**Aşamalar:**
1. **Dalış (~1 sn):** Duvara döner, elleriyle kazar (rockboss stomp/swipe animasyonları). Taş parçaları saçılır, toz kalkar, kazma sesi. Duvarın içine dalıp kaybolur, girdiği yerde çatlak bir oyuk kalır.
2. **Yeraltında ilerleme:** Görünmez ama yeri belli: zeminde/duvarda ilerleyen bir çatlak çizgisi ve kabaran toprak, toz bulutları, zıplayan taşlar. Konuma göre (stereo ve uzaklık) ayarlanan sürekli gümbürtü. Yakınsa ekran titrer. Karanlık bölgelerde çatlak görünmez, sadece ses ve titreşim. Yeraltındayken yakalayamaz, hızı normal yürüyüşüne yakın.
3. **Çıkış uyarısı (~1-1.2 sn):** Çıkış noktasında zemin kabarır, çatlaklar yıldız gibi yayılır, taşlar titrer, gümbürtü yükselir.
4. **Patlayarak çıkış:** Kaya parçaları saçılır, büyük toz bulutu, güçlü ekran sarsıntısı, kükreme. Bir süre kalan krater izi.
5. **Toparlanma (~1 sn):** Kısa bir sersemleme ve silkelenme. Oyuncunun kaçma fırsatı.

**Detaylar:**
- Yeraltında da özellikleri çalışır (görme hariç): duyma ve koklama çıkış noktasını belirler, hafıza madencinin son görüldüğü yerin yakınını tercih eder.
- Haritayı ve yolları değiştirmez. Oyuk ve kraterler bir süre sonra solup kaybolur.
- Minimap Gromm'u ve kazmayı göstermez.
- Bütün efektler kodla çizilmiş pixel art. Telefonda performans sorunu yaratmasın.
- Test: ?digdebug ile kazma yolu ve çıkış noktası ekranda görünsün, ?digsoon ile birkaç saniyede bir kazsın.

---

## 5. Açlık ve soğuk (hafif bir baskı, yorucu değil)

Bu sistem oyuncuyu bunaltmamalı, asıl tehlike Gromm kalmalı.

**Barlar:** Sol üstte, minimap'in hemen altında, aynı genişlikte iki küçük pixel art bar ve simgeleri:
- Açlık: et/ekmek simgesi, turuncu-kahverengi.
- Sıcaklık: alev/kar tanesi simgesi, ısındıkça turuncu, soğudukça buz mavisi.
- %25'in altında yavaşça yanıp sönsün. Telefonda çok yer kaplamasın, dokunmayı engellemesin.

**Açlık:**
- Dolu bardan sıfıra yaklaşık 6 dakika. Koşarken biraz daha hızlı.
- Yerdeki yemeklere dokununca madenci gidip yer (ekmek +%35, et/konserve +%60), kısa yeme animasyonu ve sesi.
- %15'in altında hafif yavaşlama ve ara sıra mide guruldaması. Sıfırsa bayılır (ölüm).

**Soğuk ve donma efekti:**
- Sıfıra yaklaşık 4 dakika. Karanlık bölgelerde biraz daha hızlı.
- Duvardaki meşale ve lambaların yanında durunca hızla ısınır (küçük sıcaklık parıltıları). Elinde yanan meşale varken de ısınır.
- Soğudukça madenci yavaş yavaş MAVİLEŞSİN:
  - %50 altı: sprite'a hafif mavi ton.
  - %25 altı: belirgin mavi, sprite titrer, nefesinden buhar çıkar, ekran kenarlarından buz kristalleri büyür, ara sıra diş takırtısı.
  - %10 altı: neredeyse buz rengi, hareket yavaşlar, ekran kenarları buzla kaplanır.
  - Isınınca hepsi yumuşakça geri gider.
- Sıfırsa donar (ölüm).

**Yerdeki eşyalar:**
- Bölüm başına 3-4 yemek, 4-5 meşale. Bir kısmı Gromm'un dolaştığı açık yerlerde olsun ki risk alınsın. Karanlıkta hafifçe parlasınlar.
- Eşya toplamak cevher veya dinamit taşırken de mümkün.
- Test: ?survival=fast ile barlar 5 kat hızlı azalsın.

---

## 6. Final bölümü (6. bölüm)

- Önceki bölümlere benzer tarzda ama farklı, en büyük harita. Gromm'un dört özelliği de aktif.
- Görev: Cevher toplama yok. Haritaya dağılmış dinamitleri bulup işaretli patlatma noktalarına yerleştir.
  - assets/madenci/minerman-adventure/items/dynamite.png ve dynamite-pack.png dosyalarını kullan.
  - 4 patlatma noktası: duvarda çatlak, üstünde kırmızı X ve tahta destek. En az biri karanlık bölgede.
  - Madenci aynı anda 1 dinamit taşır. Dinamitler bazen karanlık bölgelerde, bazen Gromm'un yolunda.
  - Dinamit kurmak birkaç saniye sürer (animasyon ve ses) ve ses çıkarır.
  - Ekranda "Dinamit: 2/4" sayacı. Minimap patlatma noktalarını gösterir (dinamitleri değil).
- 4. dinamit kurulunca fitiller yanar, 60 saniyelik geri sayım başlar, asansörün kilidi açılır. Mağara sallanır, tavandan taşlar düşer, Gromm öfkeyle kükreyip kovalar. Bu sırada biraz daha hızlı olabilir, ama sprint hızını yine geçmesin.
- Asansöre zamanında binersen: asansör yükselirken aşağıda dev patlama, ekran beyaza döner, Gromm'un son kükremesi, sessizlik.
- Bitiş ekranı: "Kurtuldun." yazısı, toplam süre. Ardından jenerik (asset sahipleri dahil, LICENSES.md'den) ve ana menüye dönüş.
- Süre biterse patlama içeride olur: ölüm sayılır.
- Test: ?level=6

---

## 7. Ana menü ve müzik

- Oyunun temasına uygun, atmosferik bir menü:
  - Arka planda yavaşça hareket eden karanlık bir maden sahnesi: titreyen meşale, toz parçacıkları, karanlıkta ara sıra yanıp sönen Gromm'un kırmızı gözleri. Ara sıra hafif ekran sarsıntısı ve uzaktan güm sesi.
  - Ortada büyük, taş/oyma görünümlü pixel art "GROMM" başlığı.
  - Büyük, telefonda kolay basılan butonlar: "Yeni Oyun", "Devam Et" (sadece kayıt varsa), "Ayarlar", "Nasıl Oynanır".
  - Ayarlar: müzik açık/kapalı, ses efektleri açık/kapalı, jumpscare açık/kapalı. Bu ayarlar her zaman hatırlansın.
  - Nasıl Oynanır: kısa ve görsel bir anlatım (dokun ve yürü, kaz, asansöre taşı, şalterleri indir, karanlıkta saklan, ye ve ısın, Gromm'dan kaç).
- Menü müziği: Web Audio ile kodla üret. Yavaş, gizemli, hafif ürkütücü ama dinlemesi hoş: derin bir arka ses, üstünde seyrek ve yankılı minör notalar, arada maden sesleri. Döngüde sorunsuz dönsün. Oyun başlayınca yavaşça kısılsın, oyun içinde sadece ambiyans kalsın.
- Tarayıcılar dokunmadan ses çalmaz: oyun önce "Başlamak için dokun" ekranıyla açılsın, sonra menüye geçip müzik başlasın.

---

## 8. Ölüm ve kayıt ("Kaydet ve Çık" sistemi)

**Ölüm:**
- Madenci ölürse (Gromm, açlık, donma, finalde süre bitmesi): varsa jumpscare, sonra ölüm ekranı ("Gromm seni yakaladı" / "Açlıktan bayıldın" / "Dondun" / "Mağara çöktü"), altında "Bölüm 4'e kadar geldin. Süre: 14 dk". Sonra ana menüye dönülür.
- Ölünce oyun tamamen sıfırlanır: bir sonraki oyun 1. bölümden ve yeni bir rastgele özellik sırasıyla başlar. Varsa kayıt da silinir.

**Kaydet ve Çık:**
- Oyun içinde sağ üstte küçük bir duraklatma butonu ("II"). Duraklatma menüsü: "Devam Et", "Ayarlar", "Kaydet ve Çık".
- "Kaydet ve Çık": ulaşılan bölümü, Gromm'un özellik sırasını ve toplam süreyi kaydeder, ana menüye döner. Bölüm içindeki konum kaydedilmez, kayıt yüklenince o bölümün başından başlanır.
- Ana menüdeki "Devam Et" butonunun üstünde kayıt bilgisi: "Bölüm 3 · 12 dk".
- Kayıt YÜKLENDİĞİ ANDA silinir. Kayıttan devam edip ölen oyuncu yine 1. bölümden başlar.
- Kayıt varken "Yeni Oyun" seçilirse sayfanın kendi içinde çizilmiş bir onay kutusu: "Kayıtlı oyunun silinecek. Emin misin?" (tarayıcının confirm penceresi değil).
- localStorage kullan. Erişilemezse oyun çökmesin: "Kaydet ve Çık" yerine "Ana Menüye Dön" görünsün ve ilerlemenin kaydedilmeyeceği söylensin.

---

## 9. Daha fazla cevher

- Haritalardaki cevher sayısını belirgin şekilde artır. Oyuncu cevher aramakla vakit kaybetmesin, asıl gerilim onları Gromm'a yakalanmadan asansöre taşımak olsun.
- Her bölümde haritadaki cevher sayısı, hedef sayının yaklaşık 2-2.5 katı olsun. Örneğin 1. bölümde hedef 3 ise haritada 7-8 cevher, 5. bölümde hedef 6 ise 13-15 cevher.
- Cevherler tek tek değil, yer yer 2-3'lük küçük damarlar halinde de dursun. Odalara ve tünel kenarlarına dengeli dağılsın.
- Asansöre çok yakın olanlar az, uzakta ve karanlık bölgelerde olanlar daha çok olsun. Kolay cevherler azken zor cevherler bol olsun.
- Tek cevher taşıma kuralı aynen kalsın.
- Final bölümünde (6) cevher yok, bu kural orada geçerli değil.

---

## 10. Yerdeki gazete (hikâye girişi)

- Ben repo'ya assets/gazete.png diye bir gazete görseli yükledim. Bu oyunun hikâye girişi.
- 1. bölümde, madencinin başladığı yerin birkaç adım yakınında, yerde buruşuk eski bir gazete kâğıdı olsun. Kodla küçük pixel art olarak çiz (sarımsı kâğıt, üstünde silik satırlar). Karanlıkta da fark edilsin diye hafifçe parlasın ve üstünde ara sıra küçük bir "!" ya da parıltı belirsin.
- Gazeteye dokununca madenci yanına yürüsün, eğilip alsın, kâğıt hışırtısı sesi çalsın (Web Audio ile).
- Sonra ekranın üstüne gazete açılsın:
  - Arka plan karartılsın, assets/gazete.png ekranın ortasında, oranı bozulmadan ekrana sığacak en büyük boyutta gösterilsin. Bu görsel pixel art değil, keskin ve okunaklı görünsün (pixelated ölçekleme kullanma, yumuşak ölçekleme kullan).
  - Hafif bir açılma animasyonu olsun (aşağıdan kayarak gelip hafif dönerek düzelsin).
  - Telefonda yazılar küçük kalabilir: gazeteye dokununca dokunulan yere 2 kat yakınlaşsın, parmakla kaydırılabilsin, tekrar dokununca geri uzaklaşsın.
  - Köşede belirgin bir "Kapat" butonu olsun. Gazete dışındaki karanlık alana dokunmak da kapatsın.
  - Gazete açıkken oyun dursun (Gromm hareket etmesin).
- Kapattıktan sonra gazete madencide kalsın: duraklatma menüsüne "Gazeteyi Oku" seçeneği eklensin, istenince tekrar açılabilsin.
- Gazeteyi okumak zorunlu olmasın, oyuncu okumadan da oynayabilsin.
- Gazete sadece 1. bölümde ve sadece yeni oyunda yerde dursun.

---

## Kalite kontrolü (her bölümden sonra ve en sonda)

- Telefon (dikey ve yatay) ve bilgisayar boyutunda ekran görüntüleri al ve kendin kontrol et: menü, açılış ekranları, karanlık ve ışık, meşale, donma aşamaları, barlar, kazma aşamaları, final, bitiş ve ölüm ekranları. Ekran görüntüsü alamıyorsan bunu söyle.
- Oynanış testleri:
  - Gromm 1. bölümde sadece çok yakından fark ediyor mu? Her özellik tek tek gerçekten çalışıyor mu?
  - Sprint ve kaçış döngüleriyle Gromm'dan kaçılabiliyor mu? Karanlıkta meşaleyi söndürünce saklanılabiliyor mu?
  - Gromm hiç uyarısız ya da madencinin dibinden kazarak çıkıyor mu? (Çıkmamalı.)
  - Açlık ve soğuk sadece hafif bir baskı mı? Normal oynayan biri bunlardan nadiren ölmeli.
  - Bütün bölümler baştan sona oynanabiliyor mu? Final ve bitiş ekranı çalışıyor mu?
  - Kaydet ve çık → sayfayı yenile → devam et → kayıt silindi mi? Kayıttan devam edip ölünce 1. bölüme dönülüyor mu?
  - Her bölümde cevher bol ve dengeli dağılmış mı?
  - Gazete 1. bölümde başlangıca yakın mı, açılınca telefonda okunabiliyor mu, yakınlaştırma ve kaydırma çalışıyor mu, kapatınca oyun kaldığı yerden devam ediyor mu?
- Performans: telefonda akıcı olmalı.
- Sorun varsa bana göstermeden düzelt. main'e birleştir. En sonda bana linki, yaptıklarının kısa listesini ve test parametrelerini ver.
