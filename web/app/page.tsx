import dynamic from "next/dynamic";

const Map = dynamic(() => import("@/components/Map").then((m) => m.Map), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen w-full items-center justify-center bg-slate-950 text-slate-300">
      Cargando mapa…
    </div>
  ),
});

export default function HomePage() {
  return <Map />;
}
