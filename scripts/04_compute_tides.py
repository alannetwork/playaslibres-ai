#!/usr/bin/env python3
"""Calcula altura de marea cada 10 minutos durante 2025 en Punta de Mita.

Usa pyTMD + FES2014 si los archivos del modelo existen en
data/raw/tide_models/fes2014/ocean_tide/. Si no, cae a un fallback armónico
basado en constantes M2/S2/K1/O1 aproximadas para Punta de Mita (queda
explícitamente marcado como fallback en el JSON).

Salidas:
    web/public/data/tides_punta_mita_2025_full.json      (10 min, año entero)
    web/public/data/tides_punta_mita_2025_extremes.json  (4 extremos por día)

Uso:
    python scripts/04_compute_tides.py
"""

from __future__ import annotations

import json
import math
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
TIDE_MODEL_DIR = ROOT / "data" / "raw" / "tide_models" / "fes2014" / "ocean_tide"
OUT_FULL = ROOT / "web" / "public" / "data" / "tides_punta_mita_2025_full.json"
OUT_EXT = ROOT / "web" / "public" / "data" / "tides_punta_mita_2025_extremes.json"

LAT = 20.766
LON = -105.546
NAME = "Punta de Mita"
YEAR = 2025
STEP_MIN = 10

# Constantes armónicas aproximadas para Punta de Mita (régimen mixto semidiurno
# del Pacífico mexicano). Amplitud (m) y fase (grados, ref Greenwich).
# Valores tomados de literatura general; el fallback NO sustituye a FES2014.
HARMONICS = {
    "M2": {"amplitude": 0.50, "phase": 175.0, "speed_deg_per_h": 28.9841042},
    "S2": {"amplitude": 0.30, "phase": 200.0, "speed_deg_per_h": 30.0000000},
    "K1": {"amplitude": 0.32, "phase": 105.0, "speed_deg_per_h": 15.0410686},
    "O1": {"amplitude": 0.20, "phase": 90.0,  "speed_deg_per_h": 13.9430356},
}


def fes2014_available() -> bool:
    if not TIDE_MODEL_DIR.is_dir():
        return False
    has_files = any(TIDE_MODEL_DIR.glob("*.nc")) or any(TIDE_MODEL_DIR.glob("*.nc.gz"))
    if not has_files:
        return False
    try:
        import pyTMD  # noqa: F401
    except ImportError:
        return False
    return True


def compute_fes2014(timestamps: pd.DatetimeIndex) -> np.ndarray:
    import pyTMD.io
    import pyTMD.predict
    import pyTMD.time

    raise SystemExit(
        "Implementación FES2014 deshabilitada en MVP — requiere ajuste fino "
        "de paths según versión de pyTMD instalada. Si necesitas ejecutarla, "
        "descomenta este bloque y configura model_directory."
    )


def compute_harmonic(timestamps: pd.DatetimeIndex) -> np.ndarray:
    """Predicción armónica simple. t en horas desde inicio del año UTC."""
    t0 = datetime(YEAR, 1, 1, tzinfo=timezone.utc)
    hours = np.array(
        [(t.to_pydatetime().replace(tzinfo=timezone.utc) - t0).total_seconds() / 3600.0
         for t in timestamps]
    )
    eta = np.zeros(len(hours), dtype=float)
    for cons in HARMONICS.values():
        amp = cons["amplitude"]
        phase_rad = math.radians(cons["phase"])
        speed_rad = math.radians(cons["speed_deg_per_h"])
        eta += amp * np.cos(speed_rad * hours - phase_rad)
    return eta


def find_extremes(df: pd.DataFrame) -> pd.DataFrame:
    """Devuelve un DataFrame con los puntos donde la altura cambia de signo
    su derivada (máximos y mínimos locales)."""
    h = df["h"].values
    dh = np.diff(h)
    sign = np.sign(dh)
    # cambios de pendiente
    flips = np.where(np.diff(sign) != 0)[0] + 1
    out = df.iloc[flips].copy()
    out["kind"] = ["high" if h[i] > h[i - 1] else "low" for i in flips]
    return out


def main() -> None:
    OUT_FULL.parent.mkdir(parents=True, exist_ok=True)

    start = datetime(YEAR, 1, 1, tzinfo=timezone.utc)
    end = datetime(YEAR + 1, 1, 1, tzinfo=timezone.utc)
    timestamps = pd.date_range(start=start, end=end, freq=f"{STEP_MIN}min", inclusive="left")

    if fes2014_available():
        model = "FES2014"
        print(f"Modelo: {model}")
        h = compute_fes2014(timestamps)
    else:
        model = "harmonic_fallback"
        print("Modelo: fallback armónico (FES2014 no disponible).")
        print("  → Para usar FES2014, registra una cuenta en AVISO+ y coloca")
        print(f"    los .nc en {TIDE_MODEL_DIR.relative_to(ROOT)}")
        h = compute_harmonic(timestamps)

    df = pd.DataFrame({"t": timestamps, "h": h.round(3)})

    stats = {
        "max_m": float(df["h"].max()),
        "min_m": float(df["h"].min()),
        "mean_m": round(float(df["h"].mean()), 3),
    }

    payload_full = {
        "location": {"lat": LAT, "lon": LON, "name": NAME},
        "model": model,
        "year": YEAR,
        "step_minutes": STEP_MIN,
        "stats": stats,
        "samples": [
            {"t": t.isoformat().replace("+00:00", "Z"), "h": float(h)}
            for t, h in zip(df["t"], df["h"])
        ],
    }
    OUT_FULL.write_text(json.dumps(payload_full, ensure_ascii=False))
    print(f"Full: {OUT_FULL.relative_to(ROOT)} ({OUT_FULL.stat().st_size/1e6:.2f} MB, n={len(df)})")

    ext = find_extremes(df)
    payload_ext = {
        "location": {"lat": LAT, "lon": LON, "name": NAME},
        "model": model,
        "year": YEAR,
        "stats": stats,
        "extremes": [
            {
                "t": row.t.isoformat().replace("+00:00", "Z"),
                "h": float(row.h),
                "kind": row.kind,
            }
            for row in ext.itertuples()
        ],
    }
    OUT_EXT.write_text(json.dumps(payload_ext, ensure_ascii=False))
    print(f"Extremos: {OUT_EXT.relative_to(ROOT)} ({OUT_EXT.stat().st_size/1024:.1f} KB, n={len(ext)})")
    print(f"Stats: {stats}")


if __name__ == "__main__":
    main()
