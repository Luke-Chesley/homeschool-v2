import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Homeschool V2",
    short_name: "Homeschool",
    description: "Phone-ready homeschool planning, source intake, Today generation, and learner activities.",
    start_url: "/open",
    display: "standalone",
    background_color: "#f9f5ee",
    theme_color: "#bb6a3a",
    orientation: "portrait",
    categories: ["education", "productivity"],
    icons: [
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
