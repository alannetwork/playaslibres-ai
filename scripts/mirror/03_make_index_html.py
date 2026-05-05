#!/usr/bin/env python3
"""Genera un index.html navegable con jerarquía Estado → Municipio → Capas.

Usa:
  - state_name / state_code (de 04_classify_by_state.py)
  - parent / subLayers (de 05_capture_hierarchy.py)

Estructura:
  Estado
   └─ Municipio (Group Layer padre)
       └─ tabla de Feature Layers (años / versiones)

Uso:
    python scripts/mirror/03_make_index_html.py
"""

from __future__ import annotations

import html
import json
import re
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
INV = ROOT / "data" / "processed" / "semarnat-mirror" / "inventory_zofem.json"
OUT = ROOT / "data" / "processed" / "semarnat-mirror" / "index.html"

UNKNOWN_STATE = "_sin_clasificar"
UNGROUPED = "Sin agrupación"


def safe_name(s: str) -> str:
    s = (s or "").strip().replace(" ", "_")
    return re.sub(r"[^A-Za-z0-9._-]+", "_", s)[:120]


def slugify(s: str) -> str:
    s = (s or "").lower().replace(" ", "-")
    return re.sub(r"[^a-z0-9-]+", "", s) or "x"


def find_meaningful_parent(layer: dict, by_id: dict[int, dict]) -> str:
    """
    Devuelve el nombre del ancestro Group Layer más cercano que represente
    un municipio/zona (no la raíz "DELIMITACIONES HISTORICAS" ni el estado).
    """
    cur_parent = layer.get("parent")
    chain: list[str] = []
    seen: set[int] = set()
    while cur_parent and cur_parent.get("id") not in seen:
        seen.add(cur_parent["id"])
        pl = by_id.get(cur_parent["id"])
        if pl is None:
            break
        chain.append(pl.get("name") or "")
        cur_parent = pl.get("parent")

    # Filtrar nombres que son estado/raíz: la cadena suele ser
    # [municipio, estado, "DELIMITACIONES HISTORICAS"]
    if not chain:
        return UNGROUPED
    # El primero (más cercano) suele ser el municipio
    candidate = chain[0]
    # Si es genérico, probar el siguiente
    generic = {"DELIMITACIONES HISTORICAS", ""}
    for c in chain:
        if c not in generic:
            return c
    return UNGROUPED


def render() -> str:
    inv = json.loads(INV.read_text())
    fetched = inv.get("fetched_at", "?")
    svc = inv["folders"]["zofem"]["services"][0]
    svc_safe = safe_name(svc["name"].replace("/", "__"))
    by_id = {l["id"]: l for l in svc["layers"]}

    # Estado → Municipio → [feature layers]
    grouped: dict[str, dict[str, list[dict]]] = defaultdict(lambda: defaultdict(list))
    total_features = 0

    for layer in svc["layers"]:
        if layer.get("type") != "Feature Layer":
            continue
        state = layer.get("state_name") or UNKNOWN_STATE
        muni = find_meaningful_parent(layer, by_id)
        # En layers raíz (sin parent), agrupamos como su propio nombre limpio
        if muni == UNGROUPED:
            muni = layer.get("name") or UNGROUPED

        lid = layer["id"]
        lname = layer.get("name") or f"layer_{lid}"
        fname = f"{lid:04d}__{safe_name(lname)}.geojson.gz"
        rel = f"zofem/{svc_safe}/{fname}"
        grouped[state][muni].append(
            {
                "id": lid,
                "name": lname,
                "geom": (layer.get("geometryType") or "").replace(
                    "esriGeometry", ""
                ),
                "fc": layer.get("featureCount") or 0,
                "url": rel,
                "filename": fname,
                "approx": bool(layer.get("state_approximate")),
            }
        )
        total_features += 1

    state_order = sorted([s for s in grouped if s != UNKNOWN_STATE])
    if UNKNOWN_STATE in grouped:
        state_order.append(UNKNOWN_STATE)

    # TOC
    toc_rows: list[str] = []
    for st in state_order:
        munis = grouped[st]
        n_layers = sum(len(v) for v in munis.values())
        sl = slugify(st)
        label = "Sin clasificar" if st == UNKNOWN_STATE else html.escape(st)
        toc_rows.append(
            f'<li><a href="#st-{sl}">{label}</a> '
            f'<span class="muted">({n_layers}, {len(munis)} mun.)</span></li>'
        )

    # Secciones
    sections: list[str] = []
    for st in state_order:
        munis = grouped[st]
        muni_order = sorted(munis.keys())
        n_layers = sum(len(v) for v in munis.values())
        sl = slugify(st)
        label = "Sin clasificar" if st == UNKNOWN_STATE else html.escape(st)

        muni_blocks = []
        for muni in muni_order:
            items = sorted(munis[muni], key=lambda x: x["name"])
            rows_html = []
            for it in items:
                approx = (
                    ' <span class="approx" title="estado aproximado">~</span>'
                    if it["approx"] else ""
                )
                rows_html.append(
                    "<tr>"
                    f"<td>{it['id']}</td>"
                    f"<td><span class=\"layer-name\">{html.escape(it['name'])}</span>{approx}</td>"
                    f"<td>{it['geom']}</td>"
                    f"<td>{it['fc']:,}</td>"
                    f'<td><a href="{it["url"]}">⬇</a></td>'
                    "</tr>"
                )
            muni_blocks.append(
                f'<details class="muni">'
                f'<summary>{html.escape(muni)} '
                f'<span class="muted">({len(items)} capas)</span></summary>'
                f'<table class="layers"><thead>'
                f"<tr><th>ID</th><th>Capa</th><th>Geom</th><th>Feat</th><th>↓</th></tr>"
                f"</thead><tbody>{''.join(rows_html)}</tbody></table>"
                f"</details>"
            )

        section_html = (
            f'<details id="st-{sl}" class="state" open>'
            f'<summary><strong>{label}</strong> '
            f'<span class="muted">({n_layers} capas en {len(munis)} municipios/zonas)</span></summary>'
            f"{''.join(muni_blocks)}"
            f"</details>"
        )
        sections.append(section_html)

    return f"""<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Mirror cívico ZOFEMAT (SEMARNAT) — por estado y municipio</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  :root {{ color-scheme: light dark; --accent: #2563eb; }}
  * {{ box-sizing: border-box; }}
  body {{ font-family: system-ui, -apple-system, sans-serif; max-width: 1200px;
         margin: 2rem auto; padding: 0 1rem; line-height: 1.5; }}
  h1 {{ margin-bottom: 0.25rem; }}
  .meta {{ color: #666; font-size: 0.9rem; margin: 0; }}
  .muted {{ color: #888; font-weight: 400; font-size: 0.85em; }}
  .links {{ margin: 1rem 0 1.5rem; display: flex; flex-wrap: wrap; gap: 0.5rem; }}
  .links a {{ padding: 0.4rem 0.8rem; background: #f0f0f0; border-radius: 4px;
              text-decoration: none; color: inherit; }}
  .links a:hover {{ background: #e5e5e5; }}
  #search {{ width: 100%; padding: 0.6rem; font-size: 1rem; margin-bottom: 1rem;
             border: 1px solid #ccc; border-radius: 4px; background: inherit;
             color: inherit; }}
  .toc {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 0.25rem 1rem; margin: 1rem 0 2rem; padding: 0; list-style: none; }}
  .toc li a {{ color: var(--accent); text-decoration: none; }}
  .toc li a:hover {{ text-decoration: underline; }}
  details.state {{ margin: 1rem 0; border: 1px solid #d5d5d5; border-radius: 4px;
                   padding: 0.6rem 1rem; background: #fafafa; }}
  details.state > summary {{ cursor: pointer; padding: 0.25rem 0;
                              font-size: 1.15rem; }}
  details.muni {{ margin: 0.4rem 0 0.4rem 1rem;
                  border-left: 2px solid #d5d5d5; padding: 0.3rem 0.8rem;
                  background: white; }}
  details.muni > summary {{ cursor: pointer; font-size: 0.95rem; }}
  table.layers {{ width: 100%; border-collapse: collapse; font-size: 0.85rem;
                  margin-top: 0.4rem; }}
  table.layers th, table.layers td {{ padding: 0.3rem 0.5rem; text-align: left;
                                       border-bottom: 1px solid #eee; }}
  table.layers th {{ background: #f5f5f5; font-weight: 600; }}
  table.layers tr:hover td {{ background: #f8f8f8; }}
  table.layers td:first-child {{ font-family: ui-monospace, monospace;
                                  color: #888; width: 60px; }}
  table.layers td:nth-child(4) {{ font-family: ui-monospace, monospace;
                                   text-align: right; width: 80px; }}
  table.layers td:last-child {{ width: 40px; text-align: center; }}
  table.layers td:last-child a {{ font-size: 1.2rem; text-decoration: none; }}
  .approx {{ color: #c97a00; cursor: help; font-weight: bold; }}
  .disclaimer {{ background: #fff3cd; border-left: 4px solid #ffc107;
                 padding: 1rem; margin: 1.5rem 0; font-size: 0.9rem; }}
  .controls {{ display: flex; gap: 0.5rem; margin: 1rem 0; flex-wrap: wrap; }}
  .controls button {{ padding: 0.4rem 0.8rem; border: 1px solid #ccc;
                      border-radius: 4px; background: inherit; color: inherit;
                      cursor: pointer; font-size: 0.9rem; }}
  .controls button:hover {{ background: #f0f0f0; }}
  @media (prefers-color-scheme: dark) {{
    body {{ background: #1a1a1a; color: #e0e0e0; }}
    .links a, .controls button {{ background: #2a2a2a; }}
    .links a:hover, .controls button:hover {{ background: #3a3a3a; }}
    details.state {{ background: #1f1f1f; border-color: #333; }}
    details.muni {{ background: #161616; border-left-color: #444; }}
    table.layers th {{ background: #2a2a2a; }}
    table.layers th, table.layers td {{ border-bottom-color: #333; }}
    table.layers tr:hover td {{ background: #222; }}
    .disclaimer {{ background: #3a2f0a; }}
    #search {{ border-color: #444; }}
  }}
</style>
</head>
<body>
<h1>Mirror cívico ZOFEMAT (SEMARNAT)</h1>
<p class="meta">
  Snapshot: {fetched} · {total_features} capas vectoriales en
  {len([s for s in state_order if s != UNKNOWN_STATE])} estados ·
  Espejo no oficial de <code>geomaticasig1.semarnat.gob.mx</code>
</p>

<div class="links">
  <a href="README.md">README</a>
  <a href="inventory.json">inventory.json</a>
  <a href="inventory_summary.txt">summary.txt</a>
  <a href="https://github.com/alanestrada/playaslibres-ai">GitHub</a>
</div>

<div class="disclaimer">
  <strong>Aviso legal.</strong> Este mirror reproduce información publicada por SEMARNAT
  con fines de resiliencia y reproducibilidad ciudadana. <strong>No constituye fuente
  oficial</strong> ni produce efectos jurídicos. Para uso pericial consulta directamente
  a la Dirección General de Zona Federal Marítimo-Terrestre y Ambientes Costeros
  (DGZFMTAC), conforme a la NOM-146-SEMARNAT-2017.
</div>

<input type="search" id="search" placeholder="Filtrar por capa, municipio o estado…" autocomplete="off">

<div class="controls">
  <button onclick="document.querySelectorAll('details.state').forEach(d => d.open = true)">Expandir estados</button>
  <button onclick="document.querySelectorAll('details.state').forEach(d => d.open = false)">Contraer estados</button>
  <button onclick="document.querySelectorAll('details.muni').forEach(d => d.open = true)">Expandir todo</button>
  <button onclick="document.querySelectorAll('details.muni').forEach(d => d.open = false); document.querySelectorAll('details.state').forEach(d => d.open = false)">Contraer todo</button>
</div>

<h2>Estados</h2>
<ul class="toc">
{''.join(toc_rows)}
</ul>

{''.join(sections)}

<p class="meta" style="margin-top:2rem">
  Agrupación: estado por spatial join contra polígonos INEGI; municipio por
  jerarquía nativa de Group Layers del MapServer SEMARNAT.
  Datos: SEMARNAT (DGZFMTAC). Código del mirror:
  <a href="https://github.com/alanestrada/playaslibres-ai">AGPL-3.0</a>.
</p>

<script>
  // Filtro client-side: oculta filas, municipios y estados sin matches
  const search = document.getElementById('search');
  search.addEventListener('input', () => {{
    const q = search.value.trim().toLowerCase();
    document.querySelectorAll('details.state').forEach(state => {{
      const stateLabel = state.querySelector(':scope > summary').textContent.toLowerCase();
      let stateVisible = 0;
      state.querySelectorAll('details.muni').forEach(muni => {{
        const muniLabel = muni.querySelector(':scope > summary').textContent.toLowerCase();
        let muniVisible = 0;
        muni.querySelectorAll('tbody tr').forEach(tr => {{
          const text = tr.textContent.toLowerCase();
          const match = !q || text.includes(q) || muniLabel.includes(q) || stateLabel.includes(q);
          tr.style.display = match ? '' : 'none';
          if (match) muniVisible++;
        }});
        muni.style.display = muniVisible > 0 || !q ? '' : 'none';
        if (q && muniVisible > 0) muni.open = true;
        stateVisible += muniVisible;
      }});
      state.style.display = stateVisible > 0 || !q ? '' : 'none';
      if (q && stateVisible > 0) state.open = true;
    }});
  }});
</script>
</body>
</html>
"""


def main() -> None:
    OUT.write_text(render())
    print(f"✓ {OUT.relative_to(ROOT)} ({OUT.stat().st_size/1024:.1f} KB)")


if __name__ == "__main__":
    main()
