#!/usr/bin/env bash
# Sube la copia ZOFEMAT al bucket R2.
# Idempotente: rclone sync solo sube lo que cambió.
#
# Uso:
#   bash scripts/mirror/02_upload_r2.sh           # sync completo
#   bash scripts/mirror/02_upload_r2.sh --dry     # dry-run

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

# Cargar env vars (solo líneas KEY=VALUE, ignora líneas malformadas)
if [[ -f .env.local ]]; then
  while IFS='=' read -r key value; do
    [[ -z "$key" ]] && continue
    export "$key=$value"
  done < <(grep -E '^[A-Z_][A-Z0-9_]*=' .env.local)
fi

if [[ -z "${R2_BUCKET:-}" ]]; then
  echo "Falta R2_BUCKET en .env.local" >&2
  exit 1
fi

DRY=""
if [[ "${1:-}" == "--dry" ]]; then
  DRY="--dry-run"
fi

LOCAL_DIR="data/raw/semarnat-mirror/zofem"
REMOTE_BASE="r2:${R2_BUCKET}/semarnat"

if [[ ! -d "$LOCAL_DIR" ]]; then
  echo "No existe $LOCAL_DIR. Corre primero scripts/mirror/01_download.py --only-folder zofem" >&2
  exit 1
fi

# Generar inventario filtrado: solo el folder zofem
python3 - <<'PY'
import json, pathlib
src = pathlib.Path("data/processed/semarnat-mirror/inventory.json")
dst = pathlib.Path("data/processed/semarnat-mirror/inventory_zofem.json")
inv = json.loads(src.read_text())
inv["folders"] = {k: v for k, v in inv["folders"].items() if k == "zofem"}
inv["scope"] = "zofem-only"
# Recompute totals
t = {"services":0, "feature_layers":0, "raster_layers":0, "tables":0, "estimated_features":0}
for f, fdata in inv["folders"].items():
    for s in fdata["services"]:
        t["services"] += 1
        for l in s.get("layers", []):
            if l.get("type") == "Feature Layer":
                t["feature_layers"] += 1
                if l.get("featureCount"): t["estimated_features"] += l["featureCount"]
            elif l.get("type") == "Raster Layer":
                t["raster_layers"] += 1
            elif l.get("type") == "Table":
                t["tables"] += 1
inv["totals"] = t
dst.write_text(json.dumps(inv, ensure_ascii=False, indent=2))
print(f"inventory_zofem.json: {t['feature_layers']} layers, {t['estimated_features']:,} features")
PY

echo "Sincronizando $LOCAL_DIR -> $REMOTE_BASE/zofem"
rclone sync "$LOCAL_DIR" "$REMOTE_BASE/zofem" \
  --progress \
  --transfers 8 \
  --checkers 16 \
  --s3-no-check-bucket \
  --header-upload "Cache-Control: public, max-age=3600" \
  $DRY

# Subir manifest filtrado y resumen (token R2 sin permiso CreateBucket → --s3-no-check-bucket)
rclone copyto data/processed/semarnat-mirror/inventory_zofem.json "$REMOTE_BASE/inventory.json" \
  --s3-no-check-bucket $DRY
rclone copy data/processed/semarnat-mirror/inventory_summary.txt "$REMOTE_BASE/" \
  --s3-no-check-bucket $DRY

# README del mirror
rclone copyto scripts/mirror/MIRROR_README.md "$REMOTE_BASE/README.md" \
  --s3-no-check-bucket $DRY

echo
echo "Listo. URL pública base:"
echo "  ${R2_PUBLIC_BASE:-<sin R2_PUBLIC_BASE>}/semarnat/"
echo "Ejemplo (Bahía de Banderas, capa 220):"
echo "  ${R2_PUBLIC_BASE}/semarnat/zofem/zofem__Delimitaciones_ZOFEMAT/0220__B_BANDERAS_2021.geojson.gz"
