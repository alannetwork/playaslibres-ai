"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
      <Card className="border-slate-700 bg-slate-950/85 text-slate-100 shadow-xl backdrop-blur">
        <div className="p-3 text-xs text-slate-400">Cargando mareas…</div>
      </Card>
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
    <Card className="border-slate-700 bg-slate-950/85 text-slate-100 shadow-xl backdrop-blur">
      <div className="flex flex-col gap-2 p-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="flex items-baseline gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Marea
            </span>
            <span className="font-mono text-sm">{fmt}</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span
              className={`text-2xl font-semibold ${
                (h ?? 0) >= 0 ? "text-blue-300" : "text-amber-300"
              }`}
            >
              {(h ?? 0).toFixed(2)} m
            </span>
            <span className="text-xs text-slate-400">{phase}</span>
            <span className="text-[10px] text-slate-500">
              ({full.model === "FES2014" ? "FES2014" : "armónico aprox."})
            </span>
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
            {playing ? "❚❚" : "▶"}
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
