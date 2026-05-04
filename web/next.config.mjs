/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        // Los .pmtiles cambian cuando se regenera el pipeline. MapLibre hace
        // HTTP range requests y los browsers cachean cada rango sin revalidar
        // si no se les fuerza ETag/no-cache. Resultado: tras `npm run dev`
        // post-pipeline, el mapa muestra los tiles viejos hasta hard refresh.
        source: "/tiles/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
