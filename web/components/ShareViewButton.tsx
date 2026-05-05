"use client";

import { useCallback, useState } from "react";
import { Check, Share2 } from "lucide-react";

/** Botón flotante "Compartir vista". Comparte la URL actual del navegador,
 *  que incluye el hash `#zoom/lat/lng` actualizado por el mapa en cada
 *  pan/zoom. Funciona también sobre `/c/<slug>`. */
export function ShareViewButton() {
  const [copied, setCopied] = useState(false);

  const onShare = useCallback(async () => {
    const url = window.location.href;
    const data: ShareData = {
      title: "Playas Libres",
      text: "Mira esta zona de Bahía de Banderas",
      url,
    };
    try {
      const nav = navigator as Navigator & {
        share?: (data: ShareData) => Promise<void>;
      };
      if (typeof nav.share === "function") {
        await nav.share(data);
        return;
      }
    } catch {
      // El usuario canceló el share nativo; caemos al copy-to-clipboard.
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copia este enlace:", url);
    }
  }, []);

  return (
    <button
      type="button"
      onClick={onShare}
      title="Compartir esta vista del mapa"
      className="pointer-events-auto inline-flex shrink-0 items-center gap-1.5 rounded-md border border-blue-500/40 bg-slate-950/80 px-2.5 py-1.5 text-[11px] font-medium text-blue-100 shadow-lg backdrop-blur transition hover:bg-blue-500/20 sm:text-xs"
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5" />
          <span>Copiado</span>
        </>
      ) : (
        <>
          <Share2 className="h-3.5 w-3.5" />
          <span>Compartir vista</span>
        </>
      )}
    </button>
  );
}
