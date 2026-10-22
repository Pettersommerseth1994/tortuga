import { poissonPmf } from "./poisson"
import { analyseBase, type Analysis, type Scenario } from "./analysis"
import type { Prior } from "./prior"

/**
 * Sluttresultat før avspark. Samme Poisson-modell som ved pause, men over hele
 * kampen fra 0–0 og uten live-justeringer: sannsynligheten for hvert resultat
 * fra 0–0 til `PRE_MAX`–`PRE_MAX` (25 ruter).
 */
export const PRE_MAX = 4

/** Målt på 1 249 CL/EL/ECL-kamper 2024–26 (scripts/historical-stats.mjs). */
export const HISTORICAL_NIL_NIL = 0.047
export const HISTORICAL_GOALS_PER_MATCH = 3.0

const fmt = (n: number, d = 2) => n.toFixed(d).replace(".", ",")
const pct = (p: number) => `${(p * 100).toFixed(1).replace(".", ",")} %`

export function analysePreMatch(input: {
  home: string
  away: string
  prior: Prior
  /** Hvor mange av de 25 som markeres «behold». */
  keepCount: number
}): Analysis {
  const { home, away, prior } = input
  const pH = Array.from({ length: PRE_MAX + 1 }, (_, k) => poissonPmf(k, prior.home))
  const pA = Array.from({ length: PRE_MAX + 1 }, (_, k) => poissonPmf(k, prior.away))

  const raw: Omit<Scenario, "rank" | "keep" | "why">[] = []
  for (let i = 0; i <= PRE_MAX; i++) {
    for (let j = 0; j <= PRE_MAX; j++) {
      raw.push({ home: i, away: j, addHome: i, addAway: j, probability: pH[i] * pA[j] })
    }
  }

  const nilNil = pH[0] * pA[0]
  const factors: Analysis["factors"] = [
    {
      tone: "neutral",
      text: `Forventet ${fmt(prior.home)} mål for ${home} og ${fmt(prior.away)} for ${away} (${fmt(prior.home + prior.away)} totalt). ${prior.detail}`,
    },
    {
      tone: "neutral",
      text: `0–0 gir modellen ${pct(nilNil)} her. Historisk endte ${pct(HISTORICAL_NIL_NIL)} av kampene i CL, EL og ECL 0–0, med ${fmt(HISTORICAL_GOALS_PER_MATCH, 1)} mål i snitt. Mener du 0–0 er mindre sannsynlig, klikk på ruten for å ta den ut.`,
    },
  ]

  return analyseBase(raw, {
    keepCount: input.keepCount,
    factors,
    remaining: { home: prior.home, away: prior.away },
    labels: { home, away },
    scenarioLabel: (s) => `${home} ${s.home}–${s.away} ${away}`,
  })
}
