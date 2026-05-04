"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, Waves, X } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  TideExtremes,
  TideFull,
  heightAt,
  loadTidesExtremes,
  loadTidesFull,
  tidePhase,
  topHighTides,
} from "@/lib/tides";

type Props = {
  onHeightChange: (h: number) => void;
};

const PLAY_STEP_MIN = 60; // 1 hora por tick
const PLAY_INTERVAL_MS = 100;

export function TideSlider({ onHeightChange }: Props) {
  const [full, setFull] = useState<TideFull | null>(null);
  const [ext, setExt] = useState<TideExtremes | null>(null);
  const [tMs, setTMs] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const playRef = useRef<number | null>(null);

  // Carga lazy.
  useEffect(() => {
    loadTidesFull().then(setFull).catch(() => null);
    loadTidesExtremes().then(setExt).catch(() => null);
  }, []);

  // Inicializa el timestamp en el primer sample.
  useEffect(() => {
    if (full && tMs === null) {
      setTMs(Date.parse(full.samples[0].t));
    }
  }, [full, tMs]);

  // Notifica al padre la altura actual.
  useEffect(() => {
    if (!full || tMs === null) return;
    onHeightChange(heightAt(full.samples, tMs));
  }, [full, tMs, onHeightChange]);

  // Auto-play.
  useEffect(() => {
    if (!playing || !full) return;
    const stepMs = PLAY_STEP_MIN * 60 * 1000;
    const last = Date.parse(full.samples[full.samples.length - 1].t);
    playRef.current = window.setInterval(() => {
      setTMs((prev) => {
        if (prev === null) return prev;
        const next = prev + stepMs;
        if (next > last) return Date.parse(full.samples[0].t);
        return next;
      });
    }, PLAY_INTERVAL_MS);
    return () => {
      if (playRef.current !== null) window.clearInterval(playRef.current);
      playRef.current = null;
    };
  }, [playing, full]);

  const range = useMemo(() => {
    if (!full) return null;
    return {
      min: Date.parse(full.samples[0].t),
      max: Date.parse(full.samples[full.samples.length - 1].t),
    };
  }, [full]);

  const h = useMemo(() => {
    if (!full || tMs === null) return null;
    return heightAt(full.samples, tMs);
  }, [full, tMs]);

  const phase = useMemo(() => {
    if (!full || tMs === null) return "estable" as const;
    return tidePhase(full.samples, tMs);
  }, [full, tMs]);

  const monthlyHighs = useMemo(() => {
    if (!ext) return [];
    return topHighTides(ext.extremes, 12);
  }, [ext]);

  if (!full || !range || tMs === null) {
    return (
      <button
        type="button"
        disabled
        className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-950/85 px-2.5 py-1.5 text-xs text-slate-400 shadow-lg backdrop-blur"
      >
        <Waves className="h-4 w-4" />
        Cargando mareas…
      </button>
    );
  }

  const heightStr = (h ?? 0).toFixed(2) + " m";
  const heightColor = (h ?? 0) >= 0 ? "text-blue-300" : "text-amber-300";

  if (!expanded) {
    return (
      <div className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-950/85 px-1 py-1 shadow-lg backdrop-blur">
        <button
          type="button"
          onClick={(ev) => {
            ev.stopPropagation();
            setPlaying((p) => !p);
          }}
          className="flex h-7 w-7 items-center justify-center rounded text-slate-200 hover:bg-slate-800"
          title={playing ? "Pausar" : "Reproducir marea"}
          aria-label={playing ? "Pausar" : "Reproducir marea"}
        >
          {playing ? (
            <Pause className="h-3.5 w-3.5" />
          ) : (
            <Play className="h-3.5 w-3.5" />
          )}
        </button>
        <button
          type="button"
          onClick={() => setExpanded(true)}
          title="Slider de marea"
          className="inline-flex items-center gap-1.5 rounded px-1.5 py-1 text-xs text-slate-100 hover:bg-slate-800"
        >
          <Waves className="h-4 w-4 text-slate-400" />
          <span className={`font-mono font-semibold ${heightColor}`}>
            {heightStr}
          </span>
          <span className="hidden text-[10px] text-slate-400 sm:inline">
            {phase}
          </span>
        </button>
      </div>
    );
  }

  const date = new Date(tMs);
  const fmt = date.toLocaleString("es-MX", {
    timeZone: "America/Mazatlan",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <Card className="w-full max-w-[calc(100vw-1rem)] border-slate-700 bg-slate-950/85 text-slate-100 shadow-xl backdrop-blur sm:max-w-lg">
      <div className="flex flex-col gap-2 p-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="flex items-baseline gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Marea
            </span>
            <span className="font-mono text-sm">{fmt}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-2xl font-semibold ${heightColor}`}>
              {heightStr}
            </span>
            <span className="text-xs text-slate-400">{phase}</span>
            <span className="text-[10px] text-slate-500">
              ({full.model === "FES2014" ? "FES2014" : "armónico aprox."})
            </span>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="ml-1 rounded p-0.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
              title="Minimizar"
              aria-label="Minimizar"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setPlaying((p) => !p)}
            className="h-8 w-12 shrink-0"
            aria-label={playing ? "Pausar" : "Reproducir"}
          >
            {playing ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </Button>
          <Slider
            min={range.min}
            max={range.max}
            value={[tMs]}
            step={10 * 60 * 1000}
            onValueChange={(v) =>
              setTMs(Array.isArray(v) ? v[0] : (v as number))
            }
          />
        </div>

        {monthlyHighs.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1 text-[10px] text-slate-400">
            <span className="text-slate-500">Pleamares máximas:</span>
            {monthlyHighs.slice(0, 6).map((m) => (
              <button
                key={m.t}
                onClick={() => setTMs(Date.parse(m.t))}
                className="rounded border border-slate-700 bg-slate-900/60 px-1.5 py-0.5 hover:bg-slate-800"
              >
                {new Date(m.t).toLocaleDateString("es-MX", {
                  month: "short",
                  day: "numeric",
                })}{" "}
                · {m.h.toFixed(2)} m
              </button>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
