#!/usr/bin/env bash
# Convierte la ZOFEMAT NACIONAL (todo México) a PMTiles con tippecanoe y la
# copia a web/public/tiles/. Idempotente (--force).
#
# Parámetros validados empíricamente (7,586 polilíneas, todo el país):
#   - PMTiles resultante ~2.2 MB.
#   - Peor tesela a zoom nacional ~15 KB gzip, muy por debajo del límite de
#     500 KB de tippecanoe.
#   - El cliente sólo baja la tesela visible (range requests sobre el .pmtiles).
#
# --no-tile-size-limit + --no-feature-limit (igual que 05_make_pmtiles.sh):
# garantizan que NINGUNA línea se descarte por densidad en zooms bajos. Sin
# esto, las zonas densas (Nayarit/Bahía de Banderas, ~3,961 líneas) se ven
# adelgazadas. --simplification=2 mantiene los segmentos cortos a zoom medio
# (un valor más alto los colapsa y "desaparecen" hasta acercar mucho).
# --minimum-zoom=3 cubre la vista nacional por default (z4.4); con minzoom=5
# el mapa abría en blanco hasta hacer zoom.
#
# Uso:
#     bash scripts/05c_make_zofemat_nacional_pmtiles.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/data/processed/zofemat_mx.geojson"
OUT="$ROOT/data/tiles/zofemat_mx.pmtiles"
WEB_OUT="$ROOT/web/public/tiles/zofemat_mx.pmtiles"

if [[ ! -f "$SRC" ]]; then
  echo "ERROR: falta $SRC. Corre primero scripts/01b_download_zofemat_nacional.py" >&2
  exit 1
fi

mkdir -p "$(dirname "$OUT")" "$(dirname "$WEB_OUT")"

echo "Convirtiendo $SRC → $OUT"
tippecanoe \
  -o "$OUT" \
  --layer=zofemat_mx \
  --minimum-zoom=3 \
  --maximum-zoom=14 \
  --simplification=2 \
  --no-tile-size-limit \
  --no-feature-limit \
  --force \
  "$SRC"

cp -f "$OUT" "$WEB_OUT"

bytes=$(stat -f %z "$OUT" 2>/dev/null || stat -c %s "$OUT")
mb=$(awk -v b="$bytes" 'BEGIN { printf "%.2f", b/1048576 }')
echo "Listo: $WEB_OUT ($mb MB)"
