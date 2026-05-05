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
import { BrandMark } from "./BrandMark";
import { ShareViewButton } from "./ShareViewButton";
import { CasosListButton } from "./CasosListButton";
import type { Caso, EstadoCaso } from "@/lib/casos";

export type SentinelBase = {
  id: string;
  datetime: string;
  cloud_cover: number;
  visual_cog: string;
};

export type Candidato = {
  id: string;
  osm_id: string;
  name: string | null;
  coords: [number, number];
  severidad: "roja" | "ambar";
  building: string;
  area_total_m2: number;
  area_invadida_m2: number;
  pct_invadido: number;
};

const MARKER_BY_ESTADO: Record<
  EstadoCaso,
  { bg: string; ring: string; border: string; icon: string }
> = {
  en_conflicto: {
    bg: "#dc2626",
    ring: "rgba(252,165,165,.45)",
    border: "#fecaca",
    icon: "⚠",
  },
  suspendido: {
    bg: "#f59e0b",
    ring: "rgba(252,211,77,.35)",
    border: "#fcd34d",
    icon: "⚠",
  },
  resuelto: {
    bg: "#10b981",
    ring: "rgba(110,231,183,.35)",
    border: "#a7f3d0",
    icon: "✓",
  },
  archivado: {
    bg: "#64748b",
    ring: "rgba(148,163,184,.35)",
    border: "#cbd5e1",
    icon: "i",
  },
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

function openCandidatoPopup(map: MlMap, c: Candidato) {
  const html = `
    <div style="font-size:12px;line-height:1.5;max-width:240px;">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
        <span style="background:#f59e0b;color:#0f172a;padding:1px 6px;border-radius:3px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;">Sin verificar</span>
        <span style="font-weight:600;">${c.name ?? "(sin nombre)"}</span>
      </div>
      <div style="color:#64748b;margin-bottom:6px;font-size:11px;">
        Candidato automático detectado por intersección OSM × franja federal.
      </div>
      <div><span style="color:#94a3b8;">Tipo OSM:</span> ${c.building}</div>
      <div><span style="color:#94a3b8;">Área del edificio:</span> ${Math.round(c.area_total_m2)} m²</div>
      <div><span style="color:#94a3b8;">Dentro de franja federal:</span> ${Math.round(c.area_invadida_m2)} m² (${c.pct_invadido.toFixed(1)}%)</div>
      <div style="margin-top:6px;padding-top:6px;border-top:1px solid #334155;">
        <a href="https://www.openstreetmap.org/${c.osm_id}" target="_blank" rel="noopener" style="color:#60a5fa;text-decoration:underline;font-size:11px;">Ver en OpenStreetMap →</a>
      </div>
      <div style="margin-top:6px;padding:6px 8px;background:rgba(245,158,11,.1);border-left:3px solid #f59e0b;color:#fef3c7;font-size:10px;line-height:1.4;">
        <strong>No es un caso confirmado.</strong> Pendiente de verificación periodística.
        Puede ser una construcción autorizada con concesión vigente o un error de georreferencia.
      </div>
    </div>`;
  new maplibregl.Popup({ closeButton: true, maxWidth: "260px" })
    .setLngLat(c.coords)
    .setHTML(html)
    .addTo(map);
}

/** Hash estilo OSM/MapLibre: `#zoom/lat/lng` (ej. `#15/20.7714/-105.5085`). */
function parseMapHash(): { lat: number; lng: number; zoom: number } | null {
  if (typeof window === "undefined") return null;
  const m = window.location.hash
    .replace(/^#/, "")
    .match(/^(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)$/);
  if (!m) return null;
  const zoom = parseFloat(m[1]);
  const lat = parseFloat(m[2]);
  const lng = parseFloat(m[3]);
  if (!Number.isFinite(zoom) || !Number.isFinite(lat) || !Number.isFinite(lng))
    return null;
  return { zoom, lat, lng };
}

export type SatelliteSource = "esri" | "sentinel";

export type MapProps = {
  /** Si se pasa, al cargar el mapa se hace flyTo al caso y se abre el panel. */
  focusSlug?: string;
};

export function Map({ focusSlug }: MapProps = {}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MlMap | null>(null);
  const [styleReady, setStyleReady] = useState(false);

  const [sentinel, setSentinel] = useState<SentinelBase | null>(null);
  const [casos, setCasos] = useState<Caso[]>([]);
  const [activeCaso, setActiveCaso] = useState<Caso | null>(null);
  const [candidatos, setCandidatos] = useState<Candidato[]>([]);
  const focusedRef = useRef(false);

  const [layers, setLayers] = useState<LayerVisibility>({
    sentinel: true,
    zofemat: true,
    pleamar: false, // experimental — ver /validacion
    candidatos: true, // candidatos automáticos visibles por default (PoC)
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
    fetch("/data/casos.json")
      .then((r) => (r.ok ? r.json() : []))
      .then(setCasos)
      .catch(() => setCasos([]));
    fetch("/data/candidatos.json")
      .then((r) => (r.ok ? r.json() : []))
      .then(setCandidatos)
      .catch(() => setCandidatos([]));
  }, []);

  // Inicialización del mapa (una sola vez).
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    ensurePmtilesProtocol();

    // Si la URL trae un hash de mapa y no estamos enfocando un caso, lo
    // usamos como vista inicial. Si hay focusSlug, el efecto de foco más
    // abajo se encargará de fitBounds y sobrescribirá el hash.
    const hashView = focusSlug ? null : parseMapHash();

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: BASEMAP_STYLE,
      center: hashView ? [hashView.lng, hashView.lat] : CENTER,
      zoom: hashView ? hashView.zoom : INITIAL_ZOOM,
      maxZoom: 20,
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
      // Tooltip helpers — clamp position al viewport para no salirse en mobile.
      const showTooltip = (
        e: MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] },
        title: string,
        body: string,
      ) => {
        const tip = tooltipRef.current;
        if (!tip) return;
        tip.innerHTML = `<div style="font-weight:600;margin-bottom:2px;">${title}</div><div style="color:#cbd5e1;">${body}</div>`;
        tip.style.display = "block";
        // Posicionar tentativo y luego clamp al viewport del canvas.
        tip.style.left = e.point.x + 14 + "px";
        tip.style.top = e.point.y + 14 + "px";
        const cw = map.getCanvas().clientWidth;
        const ch = map.getCanvas().clientHeight;
        const r = tip.getBoundingClientRect();
        if (r.right > cw - 8) {
          tip.style.left = Math.max(8, cw - r.width - 8) + "px";
        }
        if (r.bottom > ch - 8) {
          tip.style.top = Math.max(8, ch - r.height - 8) + "px";
        }
      };
      const hideTooltip = () => {
        const tip = tooltipRef.current;
        if (tip) tip.style.display = "none";
      };

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
          showTooltip(
            e,
            "Playa libre (ZOFEMAT)",
            "Franja pública de 20 m entre la pleamar máxima y la línea de zona federal. Uso público inalienable (Art. 27 Const., LGBN art. 119).",
          );
          map.getCanvas().style.cursor = "help";
        },
      );
      map.on("mouseleave", "playa-libre-fill", () => {
        hideTooltip();
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
    // focusSlug se lee sólo en el montaje para decidir si respetar el hash;
    // los cambios posteriores los maneja el efecto de foco más abajo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          // Esri tiene cobertura nativa hasta ~z18 en esta zona; con maxzoom
          // bajo, MapLibre hace overzoom (upscale) en vez de pedir tiles
          // inexistentes que devuelven el placeholder "Map data not yet available".
          maxzoom: 18,
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

  // Markers de casos. MapLibre no requiere style cargado para markers,
  // y usamos un ref persistente para evitar el bug donde el cleanup async
  // remueve markers que se acaban de crear.
  const markersRef = useRef<maplibregl.Marker[]>([]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || casos.length === 0) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    casos.forEach((c) => {
      const style = MARKER_BY_ESTADO[c.estado];
      const wrapper = document.createElement("div");
      wrapper.style.cssText = "cursor: pointer;";
      const inner = document.createElement("button");
      inner.title = c.name;
      inner.innerHTML = style.icon;
      inner.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: center;
        width: 38px;
        height: 38px;
        padding: 0;
        border-radius: 9999px;
        border: 2px solid ${style.border};
        background: ${style.bg};
        color: #fff;
        font-size: 22px;
        font-weight: 900;
        line-height: 1;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(0,0,0,.4), 0 0 0 4px ${style.ring};
        transition: transform .15s ease;
        transform: scale(1);
      `.replace(/\s+/g, " ");
      inner.addEventListener("mouseenter", () => {
        inner.style.transform = "scale(1.15)";
      });
      inner.addEventListener("mouseleave", () => {
        inner.style.transform = "scale(1)";
      });
      inner.addEventListener("click", (ev) => {
        ev.stopPropagation();
        setActiveCaso(c);
      });
      wrapper.appendChild(inner);
      const marker = new maplibregl.Marker({ element: wrapper, anchor: "center" })
        .setLngLat(c.coords)
        .addTo(map);
      markersRef.current.push(marker);
    });
  }, [casos]);

  useEffect(() => {
    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
    };
  }, []);

  // Markers de candidatos automáticos. Estilo distinto (aro hueco amarillo
  // con "?") para no confundirlos con casos verificados. Se muestran sólo
  // cuando el toggle "candidatos" está activo.
  const candidatoMarkersRef = useRef<maplibregl.Marker[]>([]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    candidatoMarkersRef.current.forEach((m) => m.remove());
    candidatoMarkersRef.current = [];
    if (!layers.candidatos || candidatos.length === 0) return;

    candidatos.forEach((c) => {
      const wrapper = document.createElement("div");
      wrapper.style.cssText = "cursor: pointer;";
      const inner = document.createElement("button");
      inner.title = `${c.name ?? "(sin nombre)"} — candidato automático sin verificar`;
      inner.innerHTML = "?";
      inner.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        padding: 0;
        border-radius: 9999px;
        border: 3px dashed #f59e0b;
        background: rgba(15, 23, 42, 0.7);
        color: #fcd34d;
        font-size: 14px;
        font-weight: 800;
        line-height: 1;
        cursor: pointer;
        box-shadow: 0 2px 6px rgba(0,0,0,.4);
        transition: transform .15s ease;
        transform: scale(1);
      `.replace(/\s+/g, " ");
      inner.addEventListener("mouseenter", () => {
        inner.style.transform = "scale(1.2)";
      });
      inner.addEventListener("mouseleave", () => {
        inner.style.transform = "scale(1)";
      });
      inner.addEventListener("click", (ev) => {
        ev.stopPropagation();
        openCandidatoPopup(map, c);
      });
      wrapper.appendChild(inner);
      const marker = new maplibregl.Marker({ element: wrapper, anchor: "center" })
        .setLngLat(c.coords)
        .addTo(map);
      candidatoMarkersRef.current.push(marker);
    });
  }, [candidatos, layers.candidatos]);

  useEffect(() => {
    return () => {
      candidatoMarkersRef.current.forEach((m) => m.remove());
      candidatoMarkersRef.current = [];
    };
  }, []);

  // Foco automático cuando llega `focusSlug` (deep-link `/c/<slug>`).
  // Espera a que el mapa esté listo y los casos cargados.
  useEffect(() => {
    if (focusedRef.current) return;
    if (!focusSlug) return;
    const map = mapRef.current;
    if (!map || casos.length === 0) return;
    const caso = casos.find((c) => c.slug === focusSlug);
    if (!caso) return;
    focusedRef.current = true;
    if (caso.coords_bbox) {
      const [w, s, e, n] = caso.coords_bbox;
      map.fitBounds(
        [
          [w, s],
          [e, n],
        ],
        { padding: 80, maxZoom: 18, duration: 800 },
      );
    } else {
      map.flyTo({ center: caso.coords, zoom: 17, duration: 800 });
    }
    setActiveCaso(caso);
  }, [focusSlug, casos, styleReady]);

  // Sincroniza el hash de la URL al pan/zoom: `#zoom/lat/lng`. Permite
  // compartir cualquier vista del mapa con un link directo.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReady) return;
    let raf = 0;
    const writeHash = () => {
      const c = map.getCenter();
      const z = map.getZoom();
      const next = `#${z.toFixed(2)}/${c.lat.toFixed(4)}/${c.lng.toFixed(4)}`;
      if (window.location.hash !== next) {
        window.history.replaceState(
          {},
          "",
          window.location.pathname + window.location.search + next,
        );
      }
    };
    const onMove = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(writeHash);
    };
    map.on("moveend", onMove);
    // Escribir una vez al montar para que el botón "Compartir" tenga
    // el hash incluso antes del primer pan.
    writeHash();
    return () => {
      map.off("moveend", onMove);
      cancelAnimationFrame(raf);
    };
  }, [styleReady]);

  // Sincroniza la URL del browser al abrir/cerrar un caso, sin recargar.
  // Permite copiar el link directo desde la home cuando se abre un marker.
  // Preserva el hash de mapa para que el link siga reflejando la vista actual.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash;
    if (activeCaso) {
      const target = `/c/${activeCaso.slug}`;
      if (window.location.pathname !== target) {
        window.history.replaceState({}, "", target + hash);
      }
    } else if (window.location.pathname.startsWith("/c/")) {
      window.history.replaceState({}, "", "/" + hash);
    }
  }, [activeCaso]);

  const onTideChange = useCallback((h: number) => setTideHeight(h), []);

  const onCasoSelect = useCallback((c: Caso) => {
    const map = mapRef.current;
    if (map) {
      if (c.coords_bbox) {
        const [w, s, e, n] = c.coords_bbox;
        map.fitBounds(
          [
            [w, s],
            [e, n],
          ],
          { padding: 80, maxZoom: 18, duration: 800 },
        );
      } else {
        map.flyTo({ center: c.coords, zoom: 17, duration: 800 });
      }
    }
    setActiveCaso(c);
  }, []);

  const onCandidatoSelect = useCallback((c: Candidato) => {
    const map = mapRef.current;
    if (!map) return;
    map.flyTo({ center: c.coords, zoom: 18, duration: 800 });
    map.once("moveend", () => openCandidatoPopup(map, c));
  }, []);

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
        className="pointer-events-none absolute z-30 max-w-[min(20rem,calc(100vw-1rem))] rounded-md border border-slate-700 bg-slate-950/95 px-2.5 py-1.5 text-[11px] leading-snug text-slate-100 shadow-xl backdrop-blur"
        style={{ display: "none" }}
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col gap-2 p-2 pr-12 sm:p-4 sm:pr-16">
        <div className="flex flex-wrap items-center gap-2">
          <div className="pointer-events-auto inline-flex max-w-full items-center gap-2 rounded-md bg-slate-950/80 px-2 py-1 text-[11px] font-medium tracking-wide text-slate-100 shadow-lg backdrop-blur sm:px-2.5 sm:py-1.5 sm:text-xs">
            <BrandMark size={18} className="shrink-0" title="Playas Libres" />
            <span className="truncate">
              <span className="sm:hidden">Playas Libres</span>
              <span className="hidden sm:inline">
                Playas Libres · Bahía de Banderas
              </span>
            </span>
            <span className="hidden truncate text-slate-400 md:inline">
              · {headerLabel}
            </span>
          </div>
          <ShareViewButton />
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col items-start gap-2 p-2 sm:p-4">
        <div className="pointer-events-auto flex w-full flex-wrap items-end gap-2">
          <LayerToggle
            value={layers}
            onChange={setLayers}
            satSource={satSource}
            onSatSourceChange={setSatSource}
          />
          {layers.pleamar && <TideSlider onHeightChange={onTideChange} />}
          <CasosListButton
            casos={casos}
            candidatos={candidatos}
            onCasoSelect={onCasoSelect}
            onCandidatoSelect={onCandidatoSelect}
          />
          <Attribution />
        </div>
      </div>

      <LegalDisclaimer />
      <InfoPanel caso={activeCaso} onClose={() => setActiveCaso(null)} />
    </div>
  );
}

export default Map;
