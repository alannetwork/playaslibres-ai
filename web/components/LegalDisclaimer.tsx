"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const COOKIE_NAME = "playas-libres-disclaimer-accepted";

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
      <DialogContent className="max-w-xl border-slate-800 bg-slate-950 text-slate-100">
        <DialogHeader>
          <DialogTitle className="text-lg">Aviso legal</DialogTitle>
          <DialogDescription className="text-slate-300">
            Antes de seguir, lee qué muestra y qué no muestra este sitio.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm leading-relaxed text-slate-300">
          <p>
            Esta plataforma muestra dos tipos de capas. La capa{" "}
            <strong>&ldquo;Pleamar estimada (uso ciudadano)&rdquo;</strong> se genera
            a partir de imágenes satelitales abiertas (Copernicus Sentinel-2),
            un modelo digital de elevación (Copernicus DEM 30 m) y un modelo
            global de mareas (FES2014); tiene una incertidumbre estimada de
            ±10 a 30 metros y <strong>no constituye una delimitación oficial
            ni produce efectos jurídicos</strong>.
          </p>
          <p>
            La capa <strong>&ldquo;ZOFEMAT oficial (SEMARNAT)&rdquo;</strong>{" "}
            reproduce información publicada por la Secretaría de Medio Ambiente
            y Recursos Naturales con fines informativos; los planos con valor
            jurídico son únicamente los firmados por perito autorizado y
            validados por la Dirección General de Zona Federal Marítimo-Terrestre
            y Ambientes Costeros (DGZFMTAC) conforme a la NOM-146-SEMARNAT-2017
            y a las tablas numéricas de predicción de marea publicadas por la
            Secretaría de Marina.
          </p>
        </div>
        <DialogFooter>
          <Button onClick={accept} className="w-full sm:w-auto">
            Entiendo, continuar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
