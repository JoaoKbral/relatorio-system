import type { MetadataRoute } from "next";

// Generic on purpose: the app serves many churches, and browsers fetch the
// manifest without the login cookie, so it cannot show the user's church.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Relatório de Culto",
    short_name: "Culto",
    description: "Relatório estatístico e financeiro de culto, também sem internet",
    lang: "pt-BR",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f9fafb",
    theme_color: "#1d4ed8",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
