import { fileURLToPath } from "node:url"

import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

/**
 * Statisk Pages-versjon av Tortuga. Gjenbruker modell, ESPN-adapter, shadcn-
 * komponenter og kampvisning fra src/, men uten server: ingen innlogging,
 * ingen database. Planer lagres i nettleseren.
 */
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  // Prosjektsider på GitHub Pages ligger under /<repo>/.
  base: process.env.PAGES_BASE ?? "/tortuga/",
  publicDir: fileURLToPath(new URL("../public", import.meta.url)),
  plugins: [react(), tailwindcss()],
  // Tailwind kommer fra Vite-pluginen; ikke plukk opp Next.js sin postcss.config.mjs i roten.
  css: { postcss: { plugins: [] } },
  resolve: {
    alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) },
  },
  build: { outDir: "dist", emptyOutDir: true },
})
