"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import maplibregl, { Map as MlMap, MapMouseEvent } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
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
const SENTINEL_TILEJSON = (cogUrl: string) =>
  `https://titiler.xyz/cog/WebMercatorQuad/tilejson.json?url=${encodeURIComponent(cogUrl)}`;

/** Ejecuta `fn` ahora si el estilo del mapa está listo, o lo difiere a `load`. */
function whenStyleReady(map: MlMap, fn: () => void) {
  if (map.isStyleLoaded()) fn();
  else map.once("load", fn);
}

export function Map() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MlMap | null>(null);
  const [styleReady, setStyleReady] = useState(false);

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
    map.on("error", (e) => console.error("[MapLibre]", e?.error || e));
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");
    map.addControl(new maplibregl.FullscreenControl(), "top-right");
    map.addControl(new maplibregl.GeolocateControl({ trackUserLocation: false }), "top-right");

    // Forzar resize tras el primer paint.
    const resizeOnce = () => map.resize();
    requestAnimationFrame(resizeOnce);
    setTimeout(resizeOnce, 200);

    // Asignación inmediata para que los useEffect dependientes puedan referenciarlo.
    mapRef.current = map;
    if (typeof window !== "undefined") {
      (window as unknown as { __map: MlMap }).__map = map;
    }

    map.on("load", () => {
      // ZOFEMAT vector source (1 PMTiles, múltiples sublayers por property "Layer").
      map.addSource("zofemat", {
        type: "vector",
        url: "pmtiles:///tiles/zofemat_bb.pmtiles",
      });

      // Estilo por sub-categoría SEMARNAT. Cada feature tiene properties.Layer.
      // Orden de añadido = orden de pintado (last on top).
      const subLayers: {
        id: string;
        layerName: string;
        color: string;
        width: number;
        dashArray?: number[];
      }[] = [
        { id: "zofemat-mangle", layerName: "MANGLE", color: "#16a34a", width: 1.5 },
        {
          id: "zofemat-terrenos-ganados",
          layerName: "TERRENOS GANADOS MAR",
          color: "#a855f7",
          width: 1.5,
          dashArray: [3, 2],
        },
        { id: "zofemat-muelle", layerName: "MUELLE", color: "#94a3b8", width: 1.5 },
        {
          id: "zofemat-playa",
          layerName: "PLAYA MARITIMA",
          color: "#fbbf24",
          width: 1.5,
        },
        {
          id: "zofemat-zona-federal",
          layerName: "ZONA FEDERAL",
          color: "#dc2626",
          width: 2.5,
        },
        {
          id: "zofemat-pleamar-oficial",
          layerName: "PLEAMAR MAXIMA",
          color: "#0ea5e9",
          width: 3,
        },
      ];
      for (const sl of subLayers) {
        map.addLayer({
          id: sl.id,
          type: "line",
          source: "zofemat",
          "source-layer": "zofemat",
          filter: ["==", ["get", "Layer"], sl.layerName],
          paint: {
            "line-color": sl.color,
            "line-width": sl.width,
            "line-opacity": 0.95,
            ...(sl.dashArray ? { "line-dasharray": sl.dashArray } : {}),
          },
        });
        // Cursor pointer + popup sobre todas las sublayers ZOFEMAT.
        map.on("mouseenter", sl.id, () => (map.getCanvas().style.cursor = "pointer"));
        map.on("mouseleave", sl.id, () => (map.getCanvas().style.cursor = ""));
        map.on(
          "click",
          sl.id,
          (e: MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) => {
            const f = e.features?.[0];
            if (!f) return;
            const props = f.properties ?? {};
            const rows = Object.entries(props)
              .filter(
                ([k]) =>
                  !k.toUpperCase().startsWith("OBJECTID") &&
                  !k.startsWith("Shape"),
              )
              .slice(0, 8);
            const html = `
              <div style="font-size:12px;line-height:1.4;">
                <div style="font-weight:600;margin-bottom:4px;">ZOFEMAT · ${
                  props.Layer ?? "?"
                }</div>
                ${rows
                  .map(
                    ([k, v]) =>
                      `<span style="color:#94a3b8;">${k}:</span> ${v}`,
                  )
                  .join("<br/>")}
              </div>`;
            new maplibregl.Popup({ closeButton: true })
              .setLngLat(e.lngLat)
              .setHTML(html)
              .addTo(map);
          },
        );
      }

      setStyleReady(true);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      setStyleReady(false);
    };
  }, []);

  // Sentinel-2 raster vía TiTiler — usar `url` (TileJSON), no `tiles`.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !sentinel) return;
    whenStyleReady(map, () => {
      if (map.getSource("sentinel")) return;
      map.addSource("sentinel", {
        type: "raster",
        url: SENTINEL_TILEJSON(sentinel.visual_cog),
        tileSize: 512,
        attribution: "Sentinel-2 Copernicus",
      });
      // Insertamos por debajo de la primera capa ZOFEMAT (todas usan la misma fuente).
      const ZOFEMAT_IDS = [
        "zofemat-mangle",
        "zofemat-terrenos-ganados",
        "zofemat-muelle",
        "zofemat-playa",
        "zofemat-zona-federal",
        "zofemat-pleamar-oficial",
      ];
      const before = ZOFEMAT_IDS.find((id) => map.getLayer(id));
      map.addLayer(
        {
          id: "sentinel-raster",
          type: "raster",
          source: "sentinel",
          paint: { "raster-opacity": 0.85 },
        },
        before,
      );
    });
  }, [sentinel, styleReady]);

  // Pleamar / floodlines.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    whenStyleReady(map, () => {
      if (map.getSource("floodlines")) return;
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
          "line-opacity": 0.9,
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
    });
  }, [styleReady]);

  // Toggle de visibilidad por capa.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReady) return;
    const setVis = (id: string, visible: boolean) => {
      if (!map.getLayer(id)) return;
      map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
    };
    const ZOFEMAT_IDS = [
      "zofemat-mangle",
      "zofemat-terrenos-ganados",
      "zofemat-muelle",
      "zofemat-playa",
      "zofemat-zona-federal",
      "zofemat-pleamar-oficial",
    ];
    setVis("sentinel-raster", layers.sentinel);
    ZOFEMAT_IDS.forEach((id) => setVis(id, layers.zofemat));
    setVis("pleamar-max", layers.pleamar);
    setVis("pleamar-dynamic", layers.pleamar);
  }, [layers, styleReady]);

  // Filtro dinámico de la pleamar según slider.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReady) return;
    if (!map.getLayer("pleamar-dynamic")) return;
    const step = 0.2;
    const rounded = Math.round(tideHeight / step) * step;
    const value = +rounded.toFixed(1);
    // Evitar -0
    const safe = value === 0 ? 0 : value;
    map.setFilter("pleamar-dynamic", ["==", ["get", "tide_m"], safe]);
  }, [tideHeight, styleReady]);

  // Markers de disputas.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || disputas.length === 0) return;
    const markers: maplibregl.Marker[] = [];
    whenStyleReady(map, () => {
      disputas.forEach((d) => {
        const el = document.createElement("button");
        el.className =
          "flex h-9 w-9 items-center justify-center rounded-full border-2 border-amber-300 bg-amber-500/90 text-slate-900 shadow-lg ring-2 ring-amber-300/50 transition hover:scale-110";
        el.style.cssText =
          "font-size:18px;font-weight:bold;cursor:pointer;line-height:1;";
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
    });
    return () => {
      markers.forEach((m) => m.remove());
    };
  }, [disputas, styleReady]);

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
    <div
      className="relative w-full"
      style={{ height: "100dvh", minHeight: "100vh" }}
    >
      <div
        ref={containerRef}
        className="absolute inset-0"
        style={{ width: "100%", height: "100%" }}
      />

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
