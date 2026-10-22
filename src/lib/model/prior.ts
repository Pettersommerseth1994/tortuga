import type { MatchDetail, MatchOdds, TeamInfo } from "@/lib/football/types"

import { outcomeProbs } from "./poisson"

/**
 * Forhåndsvurdering: forventede mål for hvert lag over 90 minutter, før noe
 * har skjedd. Dette er utgangspunktet livemodellen justerer videre fra.
 */
export type Prior = {
  /** Forventede mål, hele kampen. */
  home: number
  away: number
  source: "odds" | "form"
  /** Kort forklaring til UI. */
  detail: string
  /** Sannsynlighet for H/U/B ifølge forhåndsvurderingen. */
  probs: { home: number; draw: number; away: number }
}

/**
 * Snitt mål per lag per kamp — ankeret alt trekkes mot — og hjemmefordel som
 * multiplikator på hjemmelagets (og divisor på bortelagets) rate. Målt på
 * 1 249 kamper i CL, EL og ECL 2024–26: 1,74 hjemme og 1,26 borte, altså
 * 1,5 i snitt og en faktor 1,17 hver vei (scripts/historical-stats.mjs).
 */
const LEAGUE_GOALS_PER_TEAM = 1.5
const HOME_ADVANTAGE = 1.17

/**
 * Snitt mål per lag per kamp i hver turnering, samme måling (1 249 kamper,
 * 2024–26): CL 3,42 totalt, EL 2,83, ECL 2,68. Nivåforskjellen er stor nok til
 * at den flytter sannsynligheten for f.eks. 0–0 og 3+ mål merkbart.
 */
const GOALS_PER_TEAM_BY_COMPETITION: Record<string, number> = {
  "uefa.champions": 1.71,
  "uefa.europa": 1.415,
  "uefa.europa.conf": 1.34,
}

export function goalsPerTeam(competitionSlug?: string): number {
  return (competitionSlug && GOALS_PER_TEAM_BY_COMPETITION[competitionSlug]) || LEAGUE_GOALS_PER_TEAM
}

/** Fjerner bookmakerens marginal ved å normalisere de inverse oddsene. */
export function devig(odds: Pick<MatchOdds, "home" | "draw" | "away">) {
  const h = 1 / odds.home
  const d = 1 / odds.draw
  const a = 1 / odds.away
  const sum = h + d + a
  return { home: h / sum, draw: d / sum, away: a / sum }
}

/**
 * Finner (λ_hjemme, λ_borte) slik at Poisson-modellen gir samme H/U/B-
 * sannsynligheter som markedet. Total-mål-linja (hvis den finnes) legges inn
 * som et mykt krav, ellers trekkes totalen svakt mot ligasnittet.
 */
export function fitRates(
  target: { home: number; draw: number; away: number },
  totalHint?: number,
  /** Totalen vi trekkes svakt mot når ingen total-linje finnes. */
  fallbackTotal = LEAGUE_GOALS_PER_TEAM * 2
) {
  const total = totalHint ?? fallbackTotal
  const weight = totalHint ? 0.05 : 0.004

  let best = { home: 1.4, away: 1.1, err: Infinity }
  for (let h = 0.15; h <= 4.5; h += 0.05) {
    for (let a = 0.15; a <= 4.5; a += 0.05) {
      const o = outcomeProbs(h, a)
      const err =
        (o.home - target.home) ** 2 +
        (o.draw - target.draw) ** 2 +
        (o.away - target.away) ** 2 +
        weight * (h + a - total) ** 2
      if (err < best.err) best = { home: h, away: a, err }
    }
  }
  return { home: best.home, away: best.away }
}

function recentRates(team: TeamInfo, anchor: number) {
  // Treningskamper sier lite om nivået; bruk dem bare hvis det ikke finnes noe annet.
  const competitive = team.recent.filter((g) => !/friendly/i.test(g.competition))
  const games = competitive.length >= 3 ? competitive : team.recent
  const n = games.length
  if (n === 0) return { gf: anchor, ga: anchor, n: 0 }
  const gf = games.reduce((s, g) => s + g.goalsFor, 0) / n
  const ga = games.reduce((s, g) => s + g.goalsAgainst, 0) / n
  return { gf, ga, n }
}

/** Krymper et lite utvalg mot snittet: 5 kamper teller like mye som anker. */
function shrink(value: number, n: number, anchor = LEAGUE_GOALS_PER_TEAM, k = 5) {
  return (value * n + anchor * k) / (n + k)
}

function priorFromForm(home: TeamInfo, away: TeamInfo, avg: number): Prior {
  const h = recentRates(home, avg)
  const a = recentRates(away, avg)

  const attH = shrink(h.gf, h.n, avg)
  const defH = shrink(h.ga, h.n, avg)
  const attA = shrink(a.gf, a.n, avg)
  const defA = shrink(a.ga, a.n, avg)

  const lamH = avg * HOME_ADVANTAGE * (attH / avg) * (defA / avg)
  const lamA = (avg / HOME_ADVANTAGE) * (attA / avg) * (defH / avg)

  const home_ = clamp(lamH, 0.3, 3.5)
  const away_ = clamp(lamA, 0.3, 3.5)
  return {
    home: home_,
    away: away_,
    source: "form",
    detail: `Ingen odds tilgjengelig — estimert fra siste ${Math.max(h.n, a.n)} kamper (mål for/mot), tonet mot Champions League-snittet.`,
    probs: outcomeProbs(home_, away_),
  }
}

function priorFromOdds(odds: MatchOdds, avg: number): Prior {
  const probs = devig(odds)
  // Linja ligger typisk litt under snittet av mål; legg til et lite påslag.
  const total = odds.overUnder ? odds.overUnder + 0.15 : undefined
  const { home, away } = fitRates(probs, total, avg * 2)
  return {
    home,
    away,
    source: "odds",
    detail: `Utledet fra ${odds.provider}-odds (marginen fjernet)${odds.overUnder ? ` og total-linje ${odds.overUnder}` : ""}.`,
    probs,
  }
}

export function estimatePrior(
  match: Pick<MatchDetail, "odds" | "homeTeam" | "awayTeam"> & { competition?: { slug: string } }
): Prior {
  const avg = goalsPerTeam(match.competition?.slug)
  return match.odds
    ? priorFromOdds(match.odds, avg)
    : priorFromForm(match.homeTeam, match.awayTeam, avg)
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v))
}
