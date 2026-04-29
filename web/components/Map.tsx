"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import maplibregl, { Map as MlMap, MapMouseEvent } from "maplibre-gl";
import { ensurePmtilesProtocol } from "@/lib/pmtiles-protocol";
import { LayerToggle, LayerVisibility } from "./LayerToggle";
import { TideSlider } from "./TideSlider";
import { LegalDisclaimer } from "./LegalDisclaimer";
import { Attribution } from "./Attribution";
import { InfoPanel } from "./InfoPanel";

export type SentinelBase = {
  id: string;
  datetime: string;
  cloud_cover: number;
  visual_cog: string;
};

export type Disputa = {
  id: string;
  name: string;
  coords: [number, number];
  status: "en_conflicto" | "resuelto" | "monitoreo";
  summary: string;
  links: { label: string; url: string }[];
};

const CENTER: [number, number] = [-105.546, 20.766];
const INITIAL_ZOOM = 13;
const MAX_BOUNDS: [[number, number], [number, number]] = [
  [-105.85, 20.35],
  [-104.95, 21.0],
];
const BASEMAP_STYLE = "https://tiles.openfreemap.org/styles/positron";
const SENTINEL_TITILER = (cogUrl: string) =>
  `https://titiler.xyz/cog/WebMercatorQuad/tilejson.json?url=${encodeURIComponent(cogUrl)}`;

export function Map() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MlMap | null>(null);

  const [sentinel, setSentinel] = useState<SentinelBase | null>(null);
  const [disputas, setDisputas] = useState<Disputa[]>([]);
  const [activeDisputa, setActiveDisputa] = useState<Disputa | null>(null);

  const [layers, setLayers] = useState<LayerVisibility>({
    sentinel: true,
    zofemat: true,
    pleamar: true,
  });
  const [tideHeight, setTideHeight] = useState(0);

  // Carga inicial de metadata estática.
  useEffect(() => {
    fetch("/data/sentinel_base.json")
      .then((r) => r.json())
      .then(setSentinel)
      .catch(() => setSentinel(null));
    fetch("/data/disputas.json")
      .then((r) => (r.ok ? r.json() : []))
      .then(setDisputas)
      .catch(() => setDisputas([]));
  }, []);

  // Inicialización del mapa (una sola vez).
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    ensurePmtilesProtocol();

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: BASEMAP_STYLE,
      center: CENTER,
      zoom: INITIAL_ZOOM,
      maxBounds: MAX_BOUNDS,
      attributionControl: false,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");
    map.addControl(new maplibregl.FullscreenControl(), "top-right");
    map.addControl(new maplibregl.GeolocateControl({ trackUserLocation: false }), "top-right");

    map.on("load", () => {
      // ZOFEMAT (pmtiles)
      map.addSource("zofemat", {
        type: "vector",
        url: "pmtiles:///tiles/zofemat_bb.pmtiles",
      });
      map.addLayer({
        id: "zofemat-fill",
        type: "fill",
        source: "zofemat",
        "source-layer": "zofemat",
        paint: {
          "fill-color": "#dc2626",
          "fill-opacity": 0.35,
        },
      });
      map.addLayer({
        id: "zofemat-line",
        type: "line",
        source: "zofemat",
        "source-layer": "zofemat",
        paint: {
          "line-color": "#dc2626",
          "line-width": 2,
        },
      });
      map.on("click", "zofemat-fill", (e: MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) => {
        const f = e.features?.[0];
        if (!f) return;
        const props = f.properties ?? {};
        const html = `
          <div class="text-xs leading-tight">
            <strong>ZOFEMAT (SEMARNAT)</strong><br/>
            ${Object.entries(props)
              .filter(([k]) => !k.startsWith("OBJECTID") && !k.startsWith("Shape"))
              .slice(0, 8)
              .map(([k, v]) => `<span class="text-slate-500">${k}:</span> ${v}`)
              .join("<br/>")}
          </div>`;
        new maplibregl.Popup({ closeButton: true })
          .setLngLat(e.lngLat)
          .setHTML(html)
          .addTo(map);
      });
      map.on("mouseenter", "zofemat-fill", () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", "zofemat-fill", () => (map.getCanvas().style.cursor = ""));

      mapRef.current = map;
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Sentinel-2: agregar/quitar fuente cuando llega la metadata.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !sentinel) return;
    const apply = () => {
      if (!map.getSource("sentinel")) {
        map.addSource("sentinel", {
          type: "raster",
          tiles: [SENTINEL_TITILER(sentinel.visual_cog)],
          tileSize: 256,
          attribution: "Sentinel-2 Copernicus",
        });
        map.addLayer(
          {
            id: "sentinel-raster",
            type: "raster",
            source: "sentinel",
            paint: { "raster-opacity": 0.85 },
          },
          map.getLayer("zofemat-fill") ? "zofemat-fill" : undefined,
        );
      }
    };
    if (map.isStyleLoaded()) apply();
    else map.once("load", apply);
  }, [sentinel]);

  // Floodlines / pleamar dinámica.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      if (!map.getSource("floodlines")) {
        // Pleamar PMTiles aún no existe en Fase 3; se agrega en Fase 5.
        // El fetch HEAD evita fallar si el archivo aún no se ha generado.
        fetch("/tiles/floodlines_bb.pmtiles", { method: "HEAD" })
          .then((r) => {
            if (!r.ok) return;
            map.addSource("floodlines", {
              type: "vector",
              url: "pmtiles:///tiles/floodlines_bb.pmtiles",
            });
            map.addLayer({
              id: "pleamar-max",
              type: "line",
              source: "floodlines",
              "source-layer": "floodlines",
              filter: ["==", ["get", "tide_m"], 1.2],
              paint: {
                "line-color": "#1e40af",
                "line-width": 2.5,
              },
            });
            map.addLayer({
              id: "pleamar-dynamic",
              type: "line",
              source: "floodlines",
              "source-layer": "floodlines",
              filter: ["==", ["get", "tide_m"], 0.0],
              paint: {
                "line-color": "#60a5fa",
                "line-width": 2,
                "line-dasharray": [2, 1],
              },
            });
          })
          .catch(() => {
            /* sin floodlines aún */
          });
      }
    };
    if (map.isStyleLoaded()) apply();
    else map.once("load", apply);
  }, []);

  // Toggle de visibilidad por capa.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const setVis = (id: string, visible: boolean) => {
      if (!map.getLayer(id)) return;
      map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
    };
    setVis("sentinel-raster", layers.sentinel);
    setVis("zofemat-fill", layers.zofemat);
    setVis("zofemat-line", layers.zofemat);
    setVis("pleamar-max", layers.pleamar);
    setVis("pleamar-dynamic", layers.pleamar);
  }, [layers]);

  // Filtro dinámico de la pleamar según slider.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!map.getLayer("pleamar-dynamic")) return;
    const step = 0.2;
    const rounded = Math.round(tideHeight / step) * step;
    map.setFilter("pleamar-dynamic", ["==", ["get", "tide_m"], +rounded.toFixed(1)]);
  }, [tideHeight]);

  // Markers de disputas.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || disputas.length === 0) return;
    const markers: maplibregl.Marker[] = [];
    const apply = () => {
      disputas.forEach((d) => {
        const el = document.createElement("button");
        el.className =
          "flex h-9 w-9 items-center justify-center rounded-full border-2 border-amber-300 bg-amber-500/90 text-slate-900 shadow-lg ring-2 ring-amber-300/50 transition hover:scale-110";
        el.title = d.name;
        el.innerHTML = "⚠";
        el.addEventListener("click", (ev) => {
          ev.stopPropagation();
          setActiveDisputa(d);
        });
        const marker = new maplibregl.Marker({ element: el })
          .setLngLat(d.coords)
          .addTo(map);
        markers.push(marker);
      });
    };
    if (map.isStyleLoaded()) apply();
    else map.once("load", apply);
    return () => {
      markers.forEach((m) => m.remove());
    };
  }, [disputas]);

  const onTideChange = useCallback((h: number) => setTideHeight(h), []);

  const sentinelLabel = useMemo(() => {
    if (!sentinel) return "—";
    const d = new Date(sentinel.datetime);
    return d.toLocaleDateString("es-MX", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }, [sentinel]);

  return (
    <div className="relative h-screen w-full">
      <div ref={containerRef} className="absolute inset-0" />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col gap-2 p-3 sm:p-4">
        <div className="pointer-events-auto inline-flex w-fit items-center gap-2 rounded-md bg-slate-950/80 px-3 py-1.5 text-xs font-medium tracking-wide text-slate-100 shadow-lg backdrop-blur">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          Playas Libres · Bahía de Banderas
          <span className="text-slate-400">· Sentinel-2 {sentinelLabel}</span>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col gap-3 p-3 sm:p-4">
        <div className="pointer-events-auto">
          <LayerToggle value={layers} onChange={setLayers} />
        </div>
        <div className="pointer-events-auto">
          <TideSlider onHeightChange={onTideChange} />
        </div>
        <div className="pointer-events-auto">
          <Attribution />
        </div>
      </div>

      <LegalDisclaimer />
      <InfoPanel
        disputa={activeDisputa}
        onClose={() => setActiveDisputa(null)}
      />
    </div>
  );
}

export default Map;
