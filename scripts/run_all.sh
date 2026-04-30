#!/usr/bin/env bash
# Orquestador: corre la cadena completa de scripts del pipeline de datos.
# Falla rápido (set -e) y muestra qué paso falló.
#
# Uso:
#     bash scripts/run_all.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -d ".venv" ]]; then
  echo "ERROR: no existe .venv. Corre primero: uv venv && source .venv/bin/activate && uv pip install -r requirements.txt" >&2
  exit 1
fi

# Activa el venv si no está activo
if [[ -z "${VIRTUAL_ENV:-}" ]]; then
  # shellcheck disable=SC1091
  source .venv/bin/activate
fi

step() {
  echo
  echo "=========================================="
  echo "  $1"
  echo "=========================================="
}

step "01 — Descarga ZOFEMAT (SEMARNAT)"
python scripts/01_download_zofemat.py

step "02 — Descarga DEM Copernicus 30 m"
python scripts/02_download_dem.py

step "03 — Búsqueda de escena Sentinel-2"
python scripts/03_find_sentinel.py

step "03b — Descarga COG Sentinel-2 recortado a la bahía"
python scripts/03b_download_sentinel_cog.py

step "04 — Cálculo de mareas en Punta de Mita"
python scripts/04_compute_tides.py

step "05 — Conversión a PMTiles (ZOFEMAT)"
bash scripts/05_make_pmtiles.sh

if [[ -f "scripts/06_compute_floodlines.py" ]]; then
  step "06 — Líneas de inundación desde DEM"
  python scripts/06_compute_floodlines.py
  step "06b — Conversión a PMTiles (floodlines)"
  bash scripts/05b_make_floodlines_pmtiles.sh 2>/dev/null || true
fi

echo
echo "✔ Pipeline completo."
