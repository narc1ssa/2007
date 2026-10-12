#!/usr/bin/env bash
# Сборка веб-ассетов для игры.
#
# Оригиналы в real/ и anime/ не меняются: скрипт кладёт в assets/opt/
# оптимизированные webp-копии, которые и грузит игра.
#   assets/opt/real/NN.webp   — реальное фото (экран пазла)
#   assets/opt/anime/NN.webp  — аниме-версия (награда за сборку)
#   assets/opt/thumb/NN.webp  — превью для карточек уровней
#
# Запуск: bash tools/build-assets.sh
set -euo pipefail
cd "$(dirname "$0")/.."

mkdir -p assets/opt/real assets/opt/anime assets/opt/thumb

for f in real/*.jpg; do
  n=$(basename "$f" .jpg)
  convert "$f" -resize 1100x -strip -quality 84 "assets/opt/real/$n.webp"
  convert "$f" -resize 400x -strip -quality 76 "assets/opt/thumb/$n.webp"
  echo "real/$n -> assets/opt/real/$n.webp"
done

for f in anime/*.png; do
  n=$(basename "$f" .png)
  convert "$f" -resize 1100x -strip -quality 88 "assets/opt/anime/$n.webp"
  convert "$f" -resize 400x -strip -quality 80 "assets/opt/thumb/$n-anime.webp"
  echo "anime/$n -> assets/opt/anime/$n.webp"
done

du -sh assets/opt
