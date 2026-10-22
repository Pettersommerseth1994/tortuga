/**
 * Historisk statistikk for CL, EL og ECL — grunnlaget for konstantene i
 * src/lib/model (snitt mål, hjemmefordel, andel mål i 2. omgang).
 *
 *   node scripts/historical-stats.mjs
 *
 * Henter sluttresultater fra ESPN (hele kalenderår) og pausetall per kamp
 * (~1 300 kall, cachet i .cache/ så neste kjøring går raskt). Kamper som gikk til
 * ekstraomganger eller straffer er utelatt, siden scoren da inneholder mål utover 90 min.
 * Kvalifiseringsrunder ligger ikke i dataene.
 */
import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs"

const COMPS = { CL: "uefa.champions", EL: "uefa.europa", ECL: "uefa.europa.conf" }
const YEARS = [2024, 2025, 2026]
const API = "https://site.api.espn.com/apis/site/v2/sports/soccer"
mkdirSync(".cache", { recursive: true })

async function cached(file, build) {
  if (existsSync(file)) return JSON.parse(readFileSync(file, "utf8"))
  const v = await build()
  writeFileSync(file, JSON.stringify(v))
  return v
}

// --- 1. Sluttresultater
const finals = await cached(".cache/finals.json", async () => {
  const rows = []
  for (const [short, slug] of Object.entries(COMPS)) {
    const seen = new Set()
    for (const y of YEARS) {
      const j = await (await fetch(`${API}/${slug}/scoreboard?dates=${y}&limit=1000`)).json()
      for (const e of j.events ?? []) {
        if (seen.has(e.id) || e.status.type.name !== "STATUS_FULL_TIME") continue
        const cs = e.competitions[0].competitors
        const h = cs.find((c) => c.homeAway === "home"), a = cs.find((c) => c.homeAway === "away")
        seen.add(e.id)
        rows.push({ short, id: e.id, h: Number(h.score), a: Number(a.score), phase: e.season?.slug ?? "" })
      }
    }
  }
  return rows.filter((r) => Number.isFinite(r.h) && Number.isFinite(r.a))
})

// --- 2. Pausetall
const ht = await cached(".cache/ht.json", async () => {
  const out = {}
  let i = 0
  const worker = async () => {
    while (i < finals.length) {
      const r = finals[i++]
      try {
        const j = await (await fetch(`${API}/uefa.champions/summary?event=${r.id}`)).json()
        const cs = j.header.competitions[0].competitors
        const g = (side, k) => Number(cs.find((c) => c.homeAway === side).linescores?.[k]?.displayValue)
        out[r.id] = { h1: g("home", 0), a1: g("away", 0), h2: g("home", 1), a2: g("away", 1) }
      } catch { /* hoppes over */ }
    }
  }
  await Promise.all(Array.from({ length: 8 }, worker))
  return out
})

// --- 3. Rapport
const pc = (x) => `${(100 * x).toFixed(1)} %`
const fact = (k) => (k <= 1 ? 1 : k * fact(k - 1))
const pois = (k, l) => Math.exp(-l) * l ** k / fact(k)
const wilson = (k, n) => {
  const z = 1.96, p = k / n, d = 1 + z * z / n, c = p + z * z / (2 * n)
  const s = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))
  return [(c - s) / d, (c + s) / d]
}

function report(label, R) {
  const n = R.length
  const mh = R.reduce((s, r) => s + r.h, 0) / n, ma = R.reduce((s, r) => s + r.a, 0) / n
  const k00 = R.filter((r) => r.h === 0 && r.a === 0).length
  const [lo, hi] = wilson(k00, n)
  const hw = R.filter((r) => r.h > r.a).length, dr = R.filter((r) => r.h === r.a).length
  const dist = {}
  for (const r of R) dist[`${r.h}-${r.a}`] = (dist[`${r.h}-${r.a}`] ?? 0) + 1
  const sorted = Object.entries(dist).sort((a, b) => b[1] - a[1])
  console.log(`\n=== ${label} (n=${n})`)
  console.log(`snitt mål: hjemme ${mh.toFixed(2)}, borte ${ma.toFixed(2)}, totalt ${(mh + ma).toFixed(2)} · H/U/B ${pc(hw / n)} / ${pc(dr / n)} / ${pc((n - hw - dr) / n)}`)
  console.log(`0–0: ${k00}/${n} = ${pc(k00 / n)} (95 % KI ${pc(lo)}–${pc(hi)}) · Poisson med samme snitt: ${pc(pois(0, mh) * pois(0, ma))}`)
  console.log(`vanligst: ${sorted.slice(0, 9).map(([k, v]) => `${k} ${pc(v / n)}`).join(" · ")}`)
  console.log(`0–0 er nr. ${sorted.findIndex(([k]) => k === "0-0") + 1} av ${sorted.length} ulike sluttresultater`)
}

report("Alle tre", finals)
for (const s of Object.keys(COMPS)) report(s, finals.filter((r) => r.short === s))
report("Ligafase (nye motstandere)", finals.filter((r) => r.phase === "league-phase"))
report("Sluttspill (kjente motstandere)", finals.filter((r) => r.phase !== "league-phase"))

const H = finals
  .map((r) => ({ ...r, ...ht[r.id] }))
  .filter((r) => [r.h1, r.a1, r.h2, r.a2].every(Number.isFinite) && r.h1 + r.h2 === r.h && r.a1 + r.a2 === r.a)
const g1 = H.reduce((s, r) => s + r.h1 + r.a1, 0), g2 = H.reduce((s, r) => s + r.h2 + r.a2, 0)
const ht00 = H.filter((r) => r.h1 === 0 && r.a1 === 0)
console.log(`\n=== Pause (n=${H.length})`)
console.log(`andel mål i 2. omgang: ${pc(g2 / (g1 + g2))} · pause 0–0 i ${pc(ht00.length / H.length)} av kampene, og ${pc(ht00.filter((r) => r.h2 + r.a2 === 0).length / ht00.length)} av dem endte 0–0`)
const cell = {}
for (const r of H) if (r.h2 <= 2 && r.a2 <= 2) cell[`+${r.h2}/+${r.a2}`] = (cell[`+${r.h2}/+${r.a2}`] ?? 0) + 1
console.log(`de ni rutene (mål til hjemme/borte etter pause): ${Object.entries(cell).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${pc(v / H.length)}`).join(" · ")}`)
console.log(`rutenettets dekning: ${pc(H.filter((r) => r.h2 <= 2 && r.a2 <= 2).length / H.length)}`)
