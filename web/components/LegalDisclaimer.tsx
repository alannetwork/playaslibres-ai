"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  ChevronLeft,
  Landmark,
  Scale,
  Waves,
} from "lucide-react";

function GithubMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      fill="currentColor"
      className={className}
    >
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8" />
    </svg>
  );
}
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const COOKIE_NAME = "playas-libres-welcome-v3";
const TOTAL_SLIDES = 4;

function hasAccepted(): boolean {
  if (typeof document === "undefined") return true;
  return document.cookie.split("; ").some((c) => c.startsWith(`${COOKIE_NAME}=1`));
}

function setAccepted() {
  if (typeof document === "undefined") return;
  const oneYear = 60 * 60 * 24 * 365;
  document.cookie = `${COOKIE_NAME}=1; path=/; max-age=${oneYear}; SameSite=Lax`;
}

type SlideId = "bienvenida" | "capas" | "fuente" | "legal";

type SlideDef = {
  id: SlideId;
  eyebrow: string;
  title: string;
  icon: typeof Waves;
  iconBg: string;
  iconFg: string;
  body: React.ReactNode;
};

export function LegalDisclaimer() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!hasAccepted()) setOpen(true);
  }, []);

  const accept = useCallback(() => {
    setAccepted();
    setOpen(false);
  }, []);

  const next = useCallback(() => {
    setStep((s) => (s < TOTAL_SLIDES - 1 ? s + 1 : s));
  }, []);

  const back = useCallback(() => {
    setStep((s) => (s > 0 ? s - 1 : s));
  }, []);

  // Keyboard navigation: ← → para moverse, Enter en última slide para aceptar.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        if (step === TOTAL_SLIDES - 1) accept();
        else next();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        back();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, step, next, back, accept]);

  const slides: SlideDef[] = useMemo(
    () => [
      {
        id: "bienvenida",
        eyebrow: "Playas Libres · Bahía de Banderas",
        title: "¿Hasta dónde llega tu playa?",
        icon: Waves,
        iconBg: "bg-sky-500/15",
        iconFg: "text-sky-300",
        body: (
          <div className="space-y-3 text-slate-300">
            <p>
              Una herramienta ciudadana para visualizar la{" "}
              <strong className="text-slate-100">
                Zona Federal Marítimo-Terrestre
              </strong>{" "}
              (ZOFEMAT) en Bahía de Banderas, Nayarit, sobre imagen aérea
              y datos oficiales de SEMARNAT.
            </p>
            <p className="text-slate-400">
              Te tomará 30 segundos entender qué estás viendo y los límites
              legales de la información.
            </p>
          </div>
        ),
      },
      {
        id: "capas",
        eyebrow: "Paso 1 · Qué muestra el mapa",
        title: "Tres capas, un mismo objetivo",
        icon: Building2,
        iconBg: "bg-emerald-500/15",
        iconFg: "text-emerald-300",
        body: (
          <ul className="space-y-3 text-slate-300">
            <li className="flex items-start gap-3">
              <span
                aria-hidden
                className="mt-1.5 inline-block shrink-0 rounded-sm"
                style={{
                  width: 16,
                  height: 12,
                  background: "#22c55e",
                  opacity: 0.55,
                  border: "1px solid #86efac",
                }}
              />
              <span>
                <strong className="text-slate-100">Playa libre</strong> —
                franja verde entre la pleamar máxima y la zona federal
                (≈ 20 m). Uso público inalienable por el Art. 27
                constitucional.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span
                aria-hidden
                className="mt-2 inline-block shrink-0"
                style={{
                  width: 18,
                  height: 0,
                  borderTop: "3px solid #0ea5e9",
                }}
              />
              <span>
                <strong className="text-slate-100">Pleamar máxima</strong> —
                línea oficial publicada por SEMARNAT (cyan).
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span
                aria-hidden
                className="mt-2 inline-block shrink-0"
                style={{
                  width: 18,
                  height: 0,
                  borderTop: "3px solid #dc2626",
                }}
              />
              <span>
                <strong className="text-slate-100">Zona federal</strong> —
                borde interno de la ZOFEMAT (rojo), 20 m tierra adentro.
              </span>
            </li>
          </ul>
        ),
      },
      {
        id: "fuente",
        eyebrow: "Paso 2 · De dónde vienen los datos",
        title: "Fuente oficial: SEMARNAT",
        icon: Landmark,
        iconBg: "bg-emerald-500/15",
        iconFg: "text-emerald-300",
        body: (
          <div className="space-y-3 text-slate-300">
            <p>
              Las líneas de pleamar máxima y zona federal son los{" "}
              <strong className="text-slate-100">
                datos oficiales publicados por la DGZFMTAC
              </strong>{" "}
              (Dirección General de Zona Federal Marítimo-Terrestre y
              Ambientes Costeros), descargados directamente del MapServer
              ArcGIS de SEMARNAT.
            </p>
            <dl className="grid grid-cols-3 gap-2 rounded-md border border-emerald-700/40 bg-emerald-900/15 p-3 text-xs">
              <div>
                <dt className="text-emerald-300/70">Escala</dt>
                <dd className="font-semibold text-emerald-100">1:1000</dd>
              </div>
              <div>
                <dt className="text-emerald-300/70">Datum</dt>
                <dd className="font-semibold text-emerald-100">
                  ITRF2008 Z13
                </dd>
              </div>
              <div>
                <dt className="text-emerald-300/70">Levantamiento</dt>
                <dd className="font-semibold text-emerald-100">2021</dd>
              </div>
            </dl>
            <p className="text-slate-400">
              La franja “Playa libre” se deriva geométricamente de esos
              mismos datos oficiales.
            </p>
          </div>
        ),
      },
      {
        id: "legal",
        eyebrow: "Paso 3 · Antes de empezar",
        title: "Descargo de responsabilidad",
        icon: Scale,
        iconBg: "bg-amber-500/15",
        iconFg: "text-amber-300",
        body: (
          <div className="space-y-3 text-slate-300">
            <div className="rounded-md border border-amber-700/40 bg-amber-900/15 p-3">
              <div className="mb-1 flex items-center gap-1.5 font-semibold text-amber-200">
                <AlertTriangle className="h-4 w-4" />
                Alcance legal
              </div>
              <p className="text-sm text-amber-100/90">
                Datos con fines{" "}
                <strong>informativos y de transparencia</strong>. Para
                procesos judiciales, la NOM-146-SEMARNAT-2017 requiere el
                plano original firmado por perito autorizado y validado
                por la DGZFMTAC. Los datos del MapServer corresponden al
                levantamiento 2021 y pueden no reflejar cambios o
                concesiones posteriores.
              </p>
            </div>
            <p className="text-sm text-slate-400">
              Más detalle en{" "}
              <Link
                href="/metodologia"
                className="text-blue-300 underline-offset-2 hover:underline"
              >
                Metodología
              </Link>{" "}
              y{" "}
              <Link
                href="/validacion"
                className="text-blue-300 underline-offset-2 hover:underline"
              >
                Validación científica
              </Link>
              .
            </p>
            <a
              href="https://github.com/alannetwork/playaslibres-ai"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-xs text-slate-300 transition hover:border-slate-500 hover:bg-slate-800 hover:text-slate-100"
            >
              <GithubMark className="h-4 w-4" />
              <span>
                Código abierto en GitHub
                <span className="text-slate-500"> · AGPL-3.0</span>
              </span>
            </a>
          </div>
        ),
      },
    ],
    [],
  );

  const current = slides[step];
  const Icon = current.icon;
  const isFirst = step === 0;
  const isLast = step === TOTAL_SLIDES - 1;

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(v) : accept())}>
      <DialogContent
        className="max-w-2xl gap-0 overflow-hidden border-slate-800 bg-slate-950 p-0 text-slate-100 sm:max-w-2xl"
        showCloseButton={false}
      >
        {/* Cabecera con eyebrow + dots */}
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            {current.eyebrow}
          </div>
          <div
            className="flex items-center gap-1.5"
            role="tablist"
            aria-label="Progreso del tutorial"
          >
            {slides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={i === step}
                aria-label={`Ir al paso ${i + 1}: ${s.title}`}
                onClick={() => setStep(i)}
                className={
                  "h-1.5 rounded-full transition-all " +
                  (i === step
                    ? "w-6 bg-emerald-400"
                    : i < step
                      ? "w-1.5 bg-emerald-700 hover:bg-emerald-500"
                      : "w-1.5 bg-slate-700 hover:bg-slate-500")
                }
              />
            ))}
          </div>
        </div>

        {/* Cuerpo */}
        <div className="min-h-[340px] px-6 py-6">
          <div className="mb-4 flex items-start gap-3">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${current.iconBg}`}
            >
              <Icon className={`h-5 w-5 ${current.iconFg}`} />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-2xl font-semibold leading-tight text-slate-50">
                {current.title}
              </DialogTitle>
              <DialogDescription className="sr-only">
                {current.eyebrow}
              </DialogDescription>
            </div>
          </div>
          <div
            key={current.id}
            className="text-sm leading-relaxed animate-in fade-in-0 duration-200"
          >
            {current.body}
          </div>
        </div>

        {/* Pie con navegación */}
        <div className="flex items-center justify-between gap-2 border-t border-slate-800 bg-slate-900/40 px-5 py-3">
          <div className="flex items-center gap-2">
            {!isFirst && (
              <Button
                variant="ghost"
                size="sm"
                onClick={back}
                className="text-slate-300 hover:bg-slate-800 hover:text-slate-100"
              >
                <ChevronLeft className="h-4 w-4" />
                Atrás
              </Button>
            )}
            {!isLast && (
              <button
                type="button"
                onClick={accept}
                className="text-xs text-slate-500 underline-offset-2 hover:text-slate-300 hover:underline"
              >
                Saltar tutorial
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-slate-500 sm:inline">
              {step + 1} / {TOTAL_SLIDES}
            </span>
            {isLast ? (
              <Button onClick={accept} size="lg">
                Entendido, abrir el mapa
              </Button>
            ) : (
              <Button onClick={next} size="lg">
                Continuar
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
