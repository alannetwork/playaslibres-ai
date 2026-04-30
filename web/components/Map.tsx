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

const CENTER: [number, number] = [-105.5085, 20.7714];
const INITIAL_ZOOM = 14;
const MAX_BOUNDS: [[number, number], [number, number]] = [
  [-105.85, 20.35],
  [-104.95, 21.0],
];
const BASEMAP_STYLE = "https://tiles.openfreemap.org/styles/positron";
const SENTINEL_TILEJSON = (cogUrl: string) =>
  `https://titiler.xyz/cog/WebMercatorQuad/tilejson.json?url=${encodeURIComponent(cogUrl)}`;
const ESRI_WORLD_IMAGERY =
  "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

const ZOFEMAT_DESCRIPTIONS: Record<string, string> = {
  "PLEAMAR MAXIMA":
    "Línea oficial de la pleamar máxima delimitada por SEMARNAT.",
  "ZONA FEDERAL":
    "Borde interno de la franja federal (20 m tierra adentro de la pleamar).",
  "TERRENOS GANADOS MAR":
    "Áreas rellenadas o ganadas artificialmente al mar (sujetas a régimen especial).",
  "PLAYA MARITIMA": "Playa pública entre pleamar y bajamar.",
  MANGLE: "Manglar inventariado por SEMARNAT.",
  MUELLE: "Muelle o estructura portuaria.",
};

/** Ejecuta `fn` ahora si el estilo del mapa está listo, o lo difiere a `load`. */
function whenStyleReady(map: MlMap, fn: () => void) {
  if (map.isStyleLoaded()) fn();
  else map.once("load", fn);
}

export type SatelliteSource = "esri" | "sentinel";

export function Map() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MlMap | null>(null);
  const [styleReady, setStyleReady] = useState(false);

  const [sentinel, setSentinel] = useState<SentinelBase | null>(null);
  const [disputas, setDisputas] = useState<Disputa[]>([]);
  const [activeDisputa, setActiveDisputa] = useState<Disputa | null>(null);

  const [layers, setLayers] = useState<LayerVisibility>({
    sentinel: true,
    zofemat: true,
    pleamar: false, // experimental — ver /validacion
    zofematSub: {
      playaLibre: true,
      pleamarMaxima: true,
      zonaFederal: true,
      playaMaritima: false,
      terrenosGanadosMar: true,
      mangle: false,
      muelle: false,
    },
  });
  const [satSource, setSatSource] = useState<SatelliteSource>("esri");
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
      // Playa Libre (polígono pintado, debajo de las líneas).
      map.addSource("playa-libre", {
        type: "vector",
        url: "pmtiles:///tiles/playa_libre_bb.pmtiles",
      });
      map.addLayer({
        id: "playa-libre-fill",
        type: "fill",
        source: "playa-libre",
        "source-layer": "playa_libre",
        paint: {
          "fill-color": "#22c55e",
          "fill-opacity": 0.55,
        },
      });
      map.addLayer({
        id: "playa-libre-outline",
        type: "line",
        source: "playa-libre",
        "source-layer": "playa_libre",
        paint: {
          "line-color": "#86efac",
          "line-width": 1.5,
          "line-opacity": 1,
        },
      });
      map.on(
        "mousemove",
        "playa-libre-fill",
        (e) => {
          const tip = tooltipRef.current;
          if (!tip) return;
          tip.innerHTML = `<div style="font-weight:600;margin-bottom:2px;">Playa libre (ZOFEMAT)</div><div style="color:#cbd5e1;">Franja pública de 20 m entre la pleamar máxima y la línea de zona federal. Uso público inalienable (Art. 27 Const., LGBN art. 119).</div>`;
          tip.style.display = "block";
          tip.style.left = e.point.x + 14 + "px";
          tip.style.top = e.point.y + 14 + "px";
          map.getCanvas().style.cursor = "help";
        },
      );
      map.on("mouseleave", "playa-libre-fill", () => {
        if (tooltipRef.current) tooltipRef.current.style.display = "none";
        map.getCanvas().style.cursor = "";
      });

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
      const showTooltip = (
        e: MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] },
        title: string,
        body: string,
      ) => {
        const tip = tooltipRef.current;
        if (!tip) return;
        tip.innerHTML = `<div style="font-weight:600;margin-bottom:2px;">${title}</div><div style="color:#cbd5e1;">${body}</div>`;
        tip.style.display = "block";
        tip.style.left = e.point.x + 14 + "px";
        tip.style.top = e.point.y + 14 + "px";
      };
      const hideTooltip = () => {
        const tip = tooltipRef.current;
        if (tip) tip.style.display = "none";
      };

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
        // Hover tooltip + cursor pointer
        map.on("mousemove", sl.id, (e) => {
          map.getCanvas().style.cursor = "pointer";
          const desc = ZOFEMAT_DESCRIPTIONS[sl.layerName] ?? "";
          showTooltip(e, `ZOFEMAT · ${sl.layerName}`, desc);
        });
        map.on("mouseleave", sl.id, () => {
          map.getCanvas().style.cursor = "";
          hideTooltip();
        });
        // Click → popup completo con propiedades
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
            const desc = ZOFEMAT_DESCRIPTIONS[sl.layerName] ?? "";
            const html = `
              <div style="font-size:12px;line-height:1.4;">
                <div style="font-weight:600;margin-bottom:2px;">ZOFEMAT · ${
                  props.Layer ?? "?"
                }</div>
                <div style="color:#94a3b8;margin-bottom:6px;font-size:11px;">${desc}</div>
                ${rows
                  .map(
                    ([k, v]) =>
                      `<span style="color:#94a3b8;">${k}:</span> ${v}`,
                  )
                  .join("<br/>")}
                <div style="margin-top:6px;padding-top:6px;border-top:1px solid #334155;color:#10b981;font-size:10px;">Fuente oficial · DGZFMTAC SEMARNAT</div>
              </div>`;
            new maplibregl.Popup({ closeButton: true })
              .setLngLat(e.lngLat)
              .setHTML(html)
              .addTo(map);
          },
        );
      }

      // Hover sobre las pleamares estimadas.
      const pleamarTooltip = (
        title: string,
        body: string,
      ): ((e: MapMouseEvent) => void) => {
        return (e) => {
          map.getCanvas().style.cursor = "pointer";
          showTooltip(e, title, body);
        };
      };
      map.once("idle", () => {
        if (map.getLayer("pleamar-max")) {
          map.on(
            "mousemove",
            "pleamar-max",
            pleamarTooltip(
              "Pleamar máxima estimada",
              "Línea ciudadana derivada del DEM Copernicus a 1.2 m sobre nivel del mar.",
            ),
          );
          map.on("mouseleave", "pleamar-max", () => {
            map.getCanvas().style.cursor = "";
            hideTooltip();
          });
        }
        if (map.getLayer("pleamar-dynamic")) {
          map.on(
            "mousemove",
            "pleamar-dynamic",
            pleamarTooltip(
              "Pleamar instantánea",
              "Estimación de pleamar al timestamp del slider (DEM + modelo de marea).",
            ),
          );
          map.on("mouseleave", "pleamar-dynamic", () => {
            map.getCanvas().style.cursor = "";
            hideTooltip();
          });
        }
      });

      setStyleReady(true);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      setStyleReady(false);
    };
  }, []);

  // Capa raster satelital — Esri World Imagery (alta resolución) o Sentinel-2 (vía TiTiler).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    whenStyleReady(map, () => {
      // Insertamos el raster ANTES de la franja Playa Libre y de las líneas
      // ZOFEMAT, para que el polígono amarillo y las líneas queden encima.
      const STACK_TOP_FIRST = [
        "playa-libre-fill",
        "playa-libre-outline",
        "zofemat-mangle",
        "zofemat-terrenos-ganados",
        "zofemat-muelle",
        "zofemat-playa",
        "zofemat-zona-federal",
        "zofemat-pleamar-oficial",
      ];
      const before = STACK_TOP_FIRST.find((id) => map.getLayer(id));

      // Quitar capa+source previas si existen (cambio de fuente).
      if (map.getLayer("sentinel-raster")) map.removeLayer("sentinel-raster");
      if (map.getSource("sat-esri")) map.removeSource("sat-esri");
      if (map.getSource("sat-sentinel")) map.removeSource("sat-sentinel");

      if (satSource === "esri") {
        map.addSource("sat-esri", {
          type: "raster",
          tiles: [ESRI_WORLD_IMAGERY],
          tileSize: 256,
          maxzoom: 19,
          attribution: "© Esri World Imagery",
        });
        map.addLayer(
          {
            id: "sentinel-raster",
            type: "raster",
            source: "sat-esri",
            paint: { "raster-opacity": 0.95 },
          },
          before,
        );
      } else if (satSource === "sentinel" && sentinel) {
        map.addSource("sat-sentinel", {
          type: "raster",
          url: SENTINEL_TILEJSON(sentinel.visual_cog),
          tileSize: 512,
          attribution: "Sentinel-2 Copernicus",
        });
        map.addLayer(
          {
            id: "sentinel-raster",
            type: "raster",
            source: "sat-sentinel",
            paint: { "raster-opacity": 0.85 },
          },
          before,
        );
      }
      // Aplicar visibilidad según toggle.
      if (map.getLayer("sentinel-raster")) {
        map.setLayoutProperty(
          "sentinel-raster",
          "visibility",
          layers.sentinel ? "visible" : "none",
        );
      }
    });
  }, [satSource, sentinel, styleReady, layers.sentinel]);

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
    setVis("sentinel-raster", layers.sentinel);

    // ZOFEMAT master + sub-capas individuales
    const sub = layers.zofematSub;
    const masterOn = layers.zofemat;
    setVis("playa-libre-fill", masterOn && sub.playaLibre);
    setVis("playa-libre-outline", masterOn && sub.playaLibre);
    setVis("zofemat-pleamar-oficial", masterOn && sub.pleamarMaxima);
    setVis("zofemat-zona-federal", masterOn && sub.zonaFederal);
    setVis("zofemat-playa", masterOn && sub.playaMaritima);
    setVis("zofemat-terrenos-ganados", masterOn && sub.terrenosGanadosMar);
    setVis("zofemat-mangle", masterOn && sub.mangle);
    setVis("zofemat-muelle", masterOn && sub.muelle);

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

  // Markers de disputas. MapLibre no requiere style cargado para markers,
  // y usamos un ref persistente para evitar el bug donde el cleanup async
  // remueve markers que se acaban de crear.
  const markersRef = useRef<maplibregl.Marker[]>([]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || disputas.length === 0) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    disputas.forEach((d) => {
      const el = document.createElement("button");
      el.title = d.name;
      el.innerHTML = "⚠";
      el.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: center;
        width: 38px;
        height: 38px;
        padding: 0;
        border-radius: 9999px;
        border: 2px solid #fcd34d;
        background: #f59e0b;
        color: #1e293b;
        font-size: 22px;
        font-weight: 900;
        line-height: 1;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(0,0,0,.4), 0 0 0 4px rgba(252,211,77,.35);
        transition: transform .15s ease;
      `.replace(/\s+/g, " ");
      el.addEventListener("mouseenter", () => {
        el.style.transform = "scale(1.15)";
      });
      el.addEventListener("mouseleave", () => {
        el.style.transform = "scale(1)";
      });
      el.addEventListener("click", (ev) => {
        ev.stopPropagation();
        setActiveDisputa(d);
      });
      const marker = new maplibregl.Marker({ element: el, anchor: "center" })
        .setLngLat(d.coords)
        .addTo(map);
      markersRef.current.push(marker);
    });
  }, [disputas]);

  useEffect(() => {
    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
    };
  }, []);

  const onTideChange = useCallback((h: number) => setTideHeight(h), []);

  const headerLabel = useMemo(() => {
    if (satSource === "esri") return "Esri World Imagery";
    if (sentinel) {
      const d = new Date(sentinel.datetime);
      const fmt = d.toLocaleDateString("es-MX", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
      return `Sentinel-2 ${fmt}`;
    }
    return "—";
  }, [satSource, sentinel]);

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

      <div
        ref={tooltipRef}
        className="pointer-events-none absolute z-30 max-w-xs rounded-md border border-slate-700 bg-slate-950/95 px-2.5 py-1.5 text-[11px] leading-snug text-slate-100 shadow-xl backdrop-blur"
        style={{ display: "none" }}
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col gap-2 p-3 sm:p-4">
        <div className="pointer-events-auto inline-flex w-fit items-center gap-2 rounded-md bg-slate-950/80 px-3 py-1.5 text-xs font-medium tracking-wide text-slate-100 shadow-lg backdrop-blur">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          Playas Libres · Bahía de Banderas
          <span className="text-slate-400">· {headerLabel}</span>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col items-start gap-2 p-3 sm:p-4">
        <div className="pointer-events-auto flex flex-wrap items-end gap-2">
          <LayerToggle
            value={layers}
            onChange={setLayers}
            satSource={satSource}
            onSatSourceChange={setSatSource}
          />
          <TideSlider onHeightChange={onTideChange} />
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
