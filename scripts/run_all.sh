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

step "04 — Cálculo de mareas (estación de referencia: Punta de Mita)"
python scripts/04_compute_tides.py

step "05 — Conversión a PMTiles (ZOFEMAT)"
bash scripts/05_make_pmtiles.sh

if [[ -f "scripts/06_compute_floodlines.py" ]]; then
  step "06 — Líneas de inundación desde DEM"
  python scripts/06_compute_floodlines.py
  step "06b — Conversión a PMTiles (floodlines)"
  bash scripts/05b_make_floodlines_pmtiles.sh 2>/dev/null || true
fi

# ----------------------------------------------------------------------------
# ZOFEMAT NACIONAL (todo México). Independiente del pipeline de la capa
# estimada de Bahía de Banderas: baja los consolidados anuales 0-4 de SEMARNAT,
# genera el PMTiles nacional y deriva el catálogo de localidades del frontend.
# ----------------------------------------------------------------------------
step "01b — Descarga ZOFEMAT NACIONAL (consolidados 2019-2023)"
python scripts/01b_download_zofemat_nacional.py

step "05c — Conversión a PMTiles (ZOFEMAT nacional)"
bash scripts/05c_make_zofemat_nacional_pmtiles.sh

step "01c — Descarga ZOFEMAT HISTÓRICA (~400 planos por municipio, 17 estados)"
python scripts/01c_download_zofemat_historico.py

step "05d — Conversión a PMTiles (ZOFEMAT histórica)"
bash scripts/05d_make_zofemat_historico_pmtiles.sh

step "14 — Catálogo nacional de localidades (data/localidades_mx.json)"
python scripts/14_build_localidades_nacional.py

step "15 — Franja federal nacional (banda pleamar↔zona federal)"
python scripts/15_build_franja_nacional.py

step "05e — Conversión a PMTiles (franja federal)"
bash scripts/05e_make_franja_pmtiles.sh

echo
echo "✔ Pipeline completo."
