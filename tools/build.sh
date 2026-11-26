#!/bin/sh
# Her güncellemeden sonra çalıştır ve çıktıları commit'le:
#   legacy/gromm.js     eski tarayıcılar için ES2015 sürümü
#   gromm-offline.html  internetsiz / akıllı tahta için tek dosya (görseller gömülü)
set -e
cd "$(dirname "$0")/.."
./tools/build-legacy.sh
node tools/build-offline.mjs
