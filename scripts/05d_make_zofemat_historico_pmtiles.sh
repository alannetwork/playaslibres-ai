#!/usr/bin/env bash
# Convierte las DELIMITACIONES HISTÓRICAS de la ZOFEMAT a PMTiles y las copia
# a web/public/tiles/. Idempotente (--force).
#
# Mismos parámetros que 05c (capa nacional consolidada): minzoom 3 para que la
# vista nacional (z4.4) tenga teselas, sin límites de tamaño/densidad para que
# ningún tramo se descarte en zooms bajos, simplificación suave para no
# colapsar segmentos cortos.
#
# Uso:
#     bash scripts/05d_make_zofemat_historico_pmtiles.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/data/processed/zofemat_hist.geojson"
OUT="$ROOT/data/tiles/zofemat_hist.pmtiles"
WEB_OUT="$ROOT/web/public/tiles/zofemat_hist.pmtiles"

if [[ ! -f "$SRC" ]]; then
  echo "ERROR: falta $SRC. Corre primero scripts/01c_download_zofemat_historico.py" >&2
  exit 1
fi

mkdir -p "$(dirname "$OUT")" "$(dirname "$WEB_OUT")"

echo "Convirtiendo $SRC → $OUT"
tippecanoe \
  -o "$OUT" \
  --layer=zofemat_hist \
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
