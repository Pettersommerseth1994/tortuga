import coreWebVitals from "eslint-config-next/core-web-vitals"
import typescript from "eslint-config-next/typescript"

/**
 * Next.js 16 fjernet `next lint`. eslint-config-next 16 leverer flat config
 * direkte, så FlatCompat er verken nødvendig eller mulig — den gamle
 * kompatibilitetsveien krasjer på sirkulære plugin-referanser.
 */
const config = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      ".postgres-data/**",
      "next-env.d.ts",
      "scripts/**",
      "web/dist/**",
    ],
  },
  ...coreWebVitals,
  ...typescript,
  {
    // Pages-versjonen er Vite, ikke Next.js — next/image finnes ikke der.
    files: ["web/**"],
    rules: { "@next/next/no-img-element": "off" },
  },
]

export default config
