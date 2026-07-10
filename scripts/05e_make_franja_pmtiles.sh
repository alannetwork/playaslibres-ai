#!/usr/bin/env bash
# Convierte la franja federal nacional (polígonos derivados, script 15) a
# PMTiles y la copia a web/public/tiles/. Idempotente (--force).
#
# minzoom 8: la banda mide ~20 m de ancho; por debajo de z8 es sub-pixel y
# sólo inflaría las teselas de la vista nacional (la cobertura a esos zooms
# ya la comunican los halos de líneas).
#
# Uso:
#     bash scripts/05e_make_franja_pmtiles.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/data/processed/franja_mx.geojson"
OUT="$ROOT/data/tiles/franja_mx.pmtiles"
WEB_OUT="$ROOT/web/public/tiles/franja_mx.pmtiles"

if [[ ! -f "$SRC" ]]; then
  echo "ERROR: falta $SRC. Corre primero scripts/15_build_franja_nacional.py" >&2
  exit 1
fi

mkdir -p "$(dirname "$OUT")" "$(dirname "$WEB_OUT")"

echo "Convirtiendo $SRC → $OUT"
tippecanoe \
  -o "$OUT" \
  --layer=franja_mx \
  --minimum-zoom=8 \
  --maximum-zoom=14 \
  --simplification=2 \
  --detect-shared-borders \
  --no-tile-size-limit \
  --no-feature-limit \
  --force \
  "$SRC"

cp -f "$OUT" "$WEB_OUT"

bytes=$(stat -f %z "$OUT" 2>/dev/null || stat -c %s "$OUT")
mb=$(awk -v b="$bytes" 'BEGIN { printf "%.2f", b/1048576 }')
echo "Listo: $WEB_OUT ($mb MB)"
