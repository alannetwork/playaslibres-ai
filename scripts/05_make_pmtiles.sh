#!/usr/bin/env bash
# Convierte el GeoJSON ZOFEMAT a PMTiles con tippecanoe y lo copia a web/public/tiles/.
# Idempotente: --force sobreescribe.
#
# Uso:
#     bash scripts/05_make_pmtiles.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/data/processed/zofemat_bb.geojson"
OUT="$ROOT/data/tiles/zofemat_bb.pmtiles"
WEB_OUT="$ROOT/web/public/tiles/zofemat_bb.pmtiles"

if [[ ! -f "$SRC" ]]; then
  echo "ERROR: falta $SRC. Corre primero scripts/01_download_zofemat.py" >&2
  exit 1
fi

mkdir -p "$(dirname "$OUT")" "$(dirname "$WEB_OUT")"

echo "Convirtiendo $SRC → $OUT"
tippecanoe \
  -o "$OUT" \
  --layer=zofemat \
  --minimum-zoom=8 \
  --maximum-zoom=16 \
  --extend-zooms-if-still-dropping \
  --force \
  "$SRC"

cp -f "$OUT" "$WEB_OUT"

bytes=$(stat -f %z "$OUT" 2>/dev/null || stat -c %s "$OUT")
mb=$(awk -v b="$bytes" 'BEGIN { printf "%.2f", b/1048576 }')
echo "Listo: $WEB_OUT ($mb MB)"
