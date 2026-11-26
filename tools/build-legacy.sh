#!/bin/sh
# Eski tarayıcılar için tek dosyalık sürüm: src/ altındaki kodu ES2015'e
# çevirip legacy/gromm.js olarak yazar. src/ değişince yeniden çalıştır
# ve legacy/gromm.js'i de commit'le (index.html eski tarayıcılara bunu yükler).
set -e
cd "$(dirname "$0")/.."
npx --yes esbuild@0.28.2 src/main.js --bundle --format=iife --target=es2015 --minify --legal-comments=none --outfile=legacy/gromm.js
