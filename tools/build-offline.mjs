// Çevrimdışı tek dosya sürümü: gromm-offline.html
//
// Bütün oyun kodu (ES2015'e çevrilmiş, legacy sürümü gibi) ve oyunda
// kullanılan bütün görseller (gazete dahil) base64 data URI olarak tek bir
// HTML dosyasına gömülür. Dosya başka hiçbir şeye ihtiyaç duymaz: USB'ye
// kopyalanıp çift tıklanınca (file://) internetsiz açılır.
//
// Görseller data URI olduğu için canvas "kirlenmez" (getImageData çalışır).
// Oyun görselleri src/assets.js > assetUrl() üzerinden window.GROMM_ASSETS
// haritasından (yol -> data URI) alır.
//
// Kullanım: node tools/build-offline.mjs   (veya tools/build.sh)

import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ESBUILD = 'npx --yes esbuild@0.28.2';
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gromm-offline-'));
const run = (cmd) => execSync(cmd, { cwd: ROOT, stdio: ['ignore', 'pipe', 'inherit'] }).toString();

// 1) Oyunun kullandığı görsellerin listesi: kaynak koddan (src/assets.js) alınır,
//    böylece yeni bir görsel eklenince ayrıca bir liste güncellemek gerekmez.
const listEntry = path.join(tmp, 'list.mjs');
fs.writeFileSync(
  path.join(tmp, 'entry.js'),
  `import { allAssetPaths } from ${JSON.stringify(path.join(ROOT, 'src/assets.js'))};\nconsole.log(JSON.stringify(allAssetPaths()));\n`,
);
run(`${ESBUILD} ${JSON.stringify(path.join(tmp, 'entry.js'))} --bundle --platform=node --format=esm --log-level=warning --outfile=${JSON.stringify(listEntry)}`);
const paths = JSON.parse(execSync(`node ${JSON.stringify(listEntry)}`).toString());

// 2) Görselleri data URI olarak göm
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp' };
const assets = {};
let bytes = 0;
for (const p of paths) {
  const file = path.join(ROOT, p);
  if (!fs.existsSync(file)) {
    console.warn('UYARI: görsel bulunamadı, atlandı:', p);
    continue;
  }
  const data = fs.readFileSync(file);
  bytes += data.length;
  assets[p] = `data:${MIME[path.extname(p).toLowerCase()] || 'application/octet-stream'};base64,${data.toString('base64')}`;
}

// 3) Oyun kodu: tek dosya, ES2015
const bundleFile = path.join(tmp, 'gromm.js');
run(`${ESBUILD} src/main.js --bundle --format=iife --target=es2015 --minify --legal-comments=none --log-level=warning --outfile=${JSON.stringify(bundleFile)}`);
let code = fs.readFileSync(bundleFile, 'utf8');
// HTML içinde <script> bloğunu erken kapatmasın
code = code.replace(/<\/(script)/gi, '<\\/$1');
if (code.includes('<!--')) throw new Error('Paket "<!--" içeriyor; HTML içine güvenle gömülemez.');

// 4) index.html'in görünümünü kullan, yükleyiciyi gömülü kodla değiştir
let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const start = html.indexOf('<div id="old">');
const end = html.indexOf('</body>');
if (start < 0 || end < 0) throw new Error('index.html beklenen biçimde değil');
const body = `<div id="old">Bu tarayıcı oyunu açmak için çok eski. Lütfen tarayıcını güncelle ya da başka bir tarayıcı dene.<br><br><small id="ua"></small></div>
  <script>
    // Çevrimdışı tek dosya sürümü (tools/build-offline.mjs ile üretildi; elle düzenleme).
    window.GROMM_OFFLINE = true;
    window.GROMM_ASSETS = ${JSON.stringify(assets)};
  </script>
  <script>
${code}
  </script>
  <script>
    setTimeout(function () {
      if (window.__grommStarted) return;
      document.getElementById('ua').textContent = navigator.userAgent;
      document.getElementById('old').style.display = 'block';
    }, 4000);
  </script>
`;
html = html.slice(0, start) + body + html.slice(end);
html = html.replace('<title>Gromm</title>', '<title>Gromm (internetsiz)</title>');
const out = path.join(ROOT, 'gromm-offline.html');
fs.writeFileSync(out, html);
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`gromm-offline.html: ${(fs.statSync(out).size / 1024 / 1024).toFixed(2)} MB (${Object.keys(assets).length} görsel, ${(bytes / 1024).toFixed(0)} KB ham)`);
