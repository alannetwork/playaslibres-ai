"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const COOKIE_NAME = "playas-libres-welcome-v2";

function hasAccepted(): boolean {
  if (typeof document === "undefined") return true;
  return document.cookie.split("; ").some((c) => c.startsWith(`${COOKIE_NAME}=1`));
}

function setAccepted() {
  if (typeof document === "undefined") return;
  const oneYear = 60 * 60 * 24 * 365;
  document.cookie = `${COOKIE_NAME}=1; path=/; max-age=${oneYear}; SameSite=Lax`;
}

export function LegalDisclaimer() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!hasAccepted()) setOpen(true);
  }, []);

  const accept = () => {
    setAccepted();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(v) : accept())}>
      <DialogContent className="max-w-2xl border-slate-800 bg-slate-950 text-slate-100">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Playas Libres · Bahía de Banderas
            </span>
          </div>
          <DialogTitle className="text-2xl">
            ¿Hasta dónde llega tu playa?
          </DialogTitle>
          <DialogDescription className="text-slate-300">
            Una herramienta ciudadana para visualizar la Zona Federal
            Marítimo-Terrestre (ZOFEMAT) en Bahía de Banderas, Nayarit.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm leading-relaxed text-slate-300">
          <div>
            <div className="mb-1 font-semibold text-slate-100">
              Qué muestra el mapa
            </div>
            <ul className="ml-1 space-y-1">
              <li className="flex items-start gap-2">
                <span
                  aria-hidden
                  style={{
                    display: "inline-block",
                    width: 12,
                    height: 8,
                    background: "#facc15",
                    opacity: 0.55,
                    border: "1px solid #facc15",
                    borderRadius: 2,
                    marginTop: 6,
                  }}
                />
                <span>
                  <strong>Playa libre</strong> — la franja amarilla de 20 m
                  entre la línea de pleamar máxima y la zona federal. Uso
                  público por mandato del Art. 27 constitucional.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span
                  aria-hidden
                  style={{
                    display: "inline-block",
                    width: 14,
                    height: 0,
                    borderTop: "3px solid #0ea5e9",
                    marginTop: 10,
                  }}
                />
                <span>
                  <strong>Pleamar máxima</strong> — línea oficial SEMARNAT (cyan).
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span
                  aria-hidden
                  style={{
                    display: "inline-block",
                    width: 14,
                    height: 0,
                    borderTop: "3px solid #dc2626",
                    marginTop: 10,
                  }}
                />
                <span>
                  <strong>Zona federal</strong> — borde interno de la
                  ZOFEMAT (rojo).
                </span>
              </li>
            </ul>
          </div>

          <div className="rounded-md border border-emerald-700/40 bg-emerald-900/15 p-3">
            <div className="mb-1 font-semibold text-emerald-200">
              Fuente oficial: SEMARNAT
            </div>
            <p>
              Las líneas de pleamar máxima, zona federal y demás capas
              SEMARNAT que muestra el mapa son los{" "}
              <strong>datos oficiales publicados por la Dirección
              General de Zona Federal Marítimo-Terrestre y Ambientes
              Costeros (DGZFMTAC)</strong>, descargados directamente del
              MapServer ArcGIS de SEMARNAT. Son la referencia
              gubernamental para Bahía de Banderas: planos a escala
              1:1000, ITRF2008 Z13, levantamiento 2021. La franja
              &ldquo;Playa libre&rdquo; se deriva geométricamente de
              esos mismos datos oficiales.
            </p>
          </div>

          <div>
            <div className="mb-1 font-semibold text-slate-100">
              Metodología
            </div>
            <p>
              Encima de los datos SEMARNAT mostramos imagen aérea Esri
              World Imagery y el modelo digital de elevación Copernicus
              30 m. La capa &ldquo;pleamar estimada&rdquo; (experimental,
              desactivada por defecto) deriva del DEM y un modelo
              armónico de marea.{" "}
              <Link
                href="/metodologia"
                className="text-blue-300 underline-offset-2 hover:underline"
              >
                Detalle completo
              </Link>{" "}
              ·{" "}
              <Link
                href="/validacion"
                className="text-blue-300 underline-offset-2 hover:underline"
              >
                Validación científica
              </Link>
              .
            </p>
          </div>

          <div className="rounded-md border border-amber-700/40 bg-amber-900/15 p-3">
            <div className="mb-1 flex items-center gap-1.5 font-semibold text-amber-200">
              <AlertTriangle className="h-4 w-4" />
              Alcance legal
            </div>
            <p className="text-amber-100/90">
              Los datos son la <strong>publicación oficial</strong> de
              SEMARNAT con fines informativos. Para procesos judiciales,
              la NOM-146-SEMARNAT-2017 requiere el plano original
              firmado por perito autorizado y validado por la DGZFMTAC.
              Los datos del MapServer son del levantamiento 2021 y
              pueden no reflejar cambios o concesiones posteriores.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Link
            href="/acerca"
            className="hidden h-9 items-center justify-center gap-1 rounded-md border border-slate-700 bg-slate-800 px-3 text-sm font-medium text-slate-100 hover:bg-slate-700 sm:inline-flex"
          >
            Más información
            <ChevronRight className="h-4 w-4" />
          </Link>
          <Button onClick={accept} className="w-full sm:w-auto">
            Entendido, abrir el mapa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
