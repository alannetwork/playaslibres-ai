#!/usr/bin/env bash
# Convierte floodlines_bb.geojson a PMTiles y lo copia a web/public/tiles/.
#
# Uso:
#     bash scripts/05b_make_floodlines_pmtiles.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/data/processed/floodlines_bb.geojson"
OUT="$ROOT/data/tiles/floodlines_bb.pmtiles"
WEB_OUT="$ROOT/web/public/tiles/floodlines_bb.pmtiles"

if [[ ! -f "$SRC" ]]; then
  echo "ERROR: falta $SRC. Corre primero scripts/06_compute_floodlines.py" >&2
  exit 1
fi

mkdir -p "$(dirname "$OUT")" "$(dirname "$WEB_OUT")"

echo "Convirtiendo $SRC → $OUT"
tippecanoe \
  -o "$OUT" \
  --layer=floodlines \
  --minimum-zoom=8 \
  --maximum-zoom=16 \
  --base-zoom=8 \
  --extend-zooms-if-still-dropping \
  --no-tile-size-limit \
  --no-feature-limit \
  --force \
  "$SRC"

cp -f "$OUT" "$WEB_OUT"

bytes=$(stat -f %z "$OUT" 2>/dev/null || stat -c %s "$OUT")
mb=$(awk -v b="$bytes" 'BEGIN { printf "%.2f", b/1048576 }')
echo "Listo: $WEB_OUT ($mb MB)"
