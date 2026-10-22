import { poissonPmf } from "./poisson"
import type { Prior } from "./prior"

/**
 * Tortuga-modellen: gitt stillingen nå og hva vi vet om kampen, hvor sannsynlig
 * er hvert av de ni sluttresultatene der hvert lag scorer 0, 1 eller 2 mål til?
 *
 * Mål modelleres som uavhengige Poisson-prosesser. Forventet antall mål som
 * gjenstår per lag er
 *
 *   λ_igjen = (justert målrate for hele kampen) × (andel av kampens mål som
 *             fortsatt gjenstår) × (kamptilstand) × (røde kort)
 *
 * der målraten starter som forhåndsvurderingen (odds eller form) og trekkes
 * mot det vi faktisk har sett — målt i xG-proxy fra skuddstatistikk, ikke i
 * mål, siden mål er mer tilfeldige enn sjanser.
 *
 * Dette er en enkel modell, ikke et orakel. Den rangerer scenarioene fornuftig;
 * den slår ikke bookmakerne på odds. Se README.
 */

export const GRID = 2 // hvert lag kan score 0..GRID mål til

/**
 * Andel av kampens mål som typisk faller i 1. omgang (resten i 2.). Målt til 44,0 %
 * på 1 249 CL/EL/ECL-kamper 2024–26 (scripts/historical-stats.mjs).
 */
const FIRST_HALF_SHARE = 0.44
/** Kampen regnes som ferdig ved ca. 95 spilte minutter (med tillegg). */
const MATCH_END = 95

export type TeamStats = {
  possession: number
  shots: number
  shotsOnTarget: number
  blocked: number
  corners: number
}

export type AnalysisInput = {
  home: string
  away: string
  score: { home: number; away: number }
  /** Spilte minutter. 45 ved pause. */
  minute: number
  prior: Prior
  /** Statistikk hittil i kampen. Null hvis ikke tilgjengelig. */
  stats: { home: TeamStats; away: TeamStats } | null
  redCards: { home: number; away: number }
  /** Hvor mange av de ni scenarioene som strykes. */
  removeCount: number
}

export type Scenario = {
  /** Sluttresultat. */
  home: number
  away: number
  /** Mål som må komme fra nå. */
  addHome: number
  addAway: number
  /** Sannsynlighet for akkurat dette sluttresultatet (0–1). */
  probability: number
  /** 1 = mest sannsynlig. */
  rank: number
  keep: boolean
  why: string
}

export type Factor = { tone: "home" | "away" | "neutral"; text: string }

export type Analysis = {
  scenarios: Scenario[]
  /** Forventede mål igjen per lag. */
  remaining: { home: number; away: number }
  /** Sannsynlighet for at sluttresultatet er blant alle ni. */
  gridProbability: number
  /** Sannsynlighet for at det er blant de beholdte. */
  keptProbability: number
  /** xG-proxy hittil, hvis statistikk finnes. */
  xg: { home: number; away: number } | null
  factors: Factor[]
}

/** Kumulativ andel av kampens mål som er scoret etter `minute` minutter. */
export function goalsShareAt(minute: number): number {
  if (minute <= 0) return 0
  if (minute <= 45) return FIRST_HALF_SHARE * (minute / 45)
  if (minute >= MATCH_END) return 1
  return FIRST_HALF_SHARE + (1 - FIRST_HALF_SHARE) * ((minute - 45) / (MATCH_END - 45))
}

/**
 * Grov xG: skudd på mål er verdt mest, blokkerte litt, øvrige skudd lite.
 * Ikke en ekte xG-modell (vi har ikke skuddposisjon), men fanger hvem som
 * skaper sjanser bedre enn ballbesittelse gjør.
 */
export function xgProxy(s: TeamStats): number {
  const offTarget = Math.max(0, s.shots - s.shotsOnTarget - s.blocked)
  return 0.3 * s.shotsOnTarget + 0.05 * s.blocked + 0.04 * offTarget
}

const fmt = (n: number, d = 2) => n.toFixed(d).replace(".", ",")
const pct = (p: number) => `${Math.round(p * 100)} %`

export function analyse(input: AnalysisInput): Analysis {
  const { home, away, score, minute, prior, stats, redCards } = input
  const factors: Factor[] = []

  const played = goalsShareAt(minute)
  const remainingShare = 1 - played

  // --- 1. Målrate for hele kampen: forhåndsvurdering justert mot det vi har sett
  let rateH = prior.home
  let rateA = prior.away
  let xg: Analysis["xg"] = null

  if (stats && played > 0.08) {
    const xgH = xgProxy(stats.home)
    const xgA = xgProxy(stats.away)
    xg = { home: xgH, away: xgA }

    // Observert "verdi" = mest sjanser, litt mål. Gamma-Poisson-aktig
    // oppdatering: forhåndsvurderingen veier som `PRIOR_WEIGHT` av en kamp.
    const PRIOR_WEIGHT = 0.8
    const obsH = 0.8 * xgH + 0.2 * score.home
    const obsA = 0.8 * xgA + 0.2 * score.away
    rateH = (PRIOR_WEIGHT * prior.home + obsH) / (PRIOR_WEIGHT + played)
    rateA = (PRIOR_WEIGHT * prior.away + obsA) / (PRIOR_WEIGHT + played)

    const expectedH = prior.home * played
    const expectedA = prior.away * played
    const dH = xgH - expectedH
    const dA = xgA - expectedA
    if (Math.abs(dH) > 0.25) {
      factors.push({
        tone: dH > 0 ? "home" : "away",
        text: `${home} har skapt ${fmt(xgH)} xG mot forventet ${fmt(expectedH)} så langt — ${dH > 0 ? "over" : "under"} normalen, så rate justeres ${dH > 0 ? "opp" : "ned"}.`,
      })
    }
    if (Math.abs(dA) > 0.25) {
      factors.push({
        tone: dA > 0 ? "away" : "home",
        text: `${away} har skapt ${fmt(xgA)} xG mot forventet ${fmt(expectedA)} så langt — ${dA > 0 ? "over" : "under"} normalen.`,
      })
    }
    const pos = stats.home.possession
    if (pos >= 58 || pos <= 42) {
      const lead = pos >= 50 ? home : away
      factors.push({
        tone: pos >= 50 ? "home" : "away",
        text: `${lead} har ${Math.round(pos >= 50 ? pos : 100 - pos)} % ballbesittelse og styrer tempoet.`,
      })
    }
  }

  // --- 2. Kamptilstand: tapende lag presser, ledende lag sitter lavere
  const diff = score.home - score.away
  const press = (d: number) => 1 + 0.06 * Math.min(d, 3)
  const sit = (d: number) => 1 - 0.03 * Math.min(d, 3)
  const stateH = diff < 0 ? press(-diff) : diff > 0 ? sit(diff) : 1
  const stateA = diff > 0 ? press(diff) : diff < 0 ? sit(-diff) : 1
  if (diff !== 0 && played > 0) {
    const leader = diff > 0 ? home : away
    const chaser = diff > 0 ? away : home
    factors.push({
      tone: "neutral",
      text: `${chaser} ligger under og må presse; ${leader} kan sitte lavere. Gir ${chaser} litt høyere rate.`,
    })
  }

  // --- 3. Røde kort
  const redFactor = (own: number, opp: number) =>
    Math.pow(0.75, Math.min(own, 2)) * Math.pow(1.3, Math.min(opp, 2))
  const redH = redFactor(redCards.home, redCards.away)
  const redA = redFactor(redCards.away, redCards.home)
  if (redCards.home > 0)
    factors.push({ tone: "away", text: `${home} er redusert med ${redCards.home} spiller(e).` })
  if (redCards.away > 0)
    factors.push({ tone: "home", text: `${away} er redusert med ${redCards.away} spiller(e).` })

  // --- 4. Forventede mål igjen
  const remH = rateH * remainingShare * stateH * redH
  const remA = rateA * remainingShare * stateA * redA

  // --- 5. De ni scenarioene
  const pH = Array.from({ length: GRID + 1 }, (_, k) => poissonPmf(k, remH))
  const pA = Array.from({ length: GRID + 1 }, (_, k) => poissonPmf(k, remA))

  const raw: Omit<Scenario, "rank" | "keep" | "why">[] = []
  for (let i = 0; i <= GRID; i++) {
    for (let j = 0; j <= GRID; j++) {
      raw.push({
        home: score.home + i,
        away: score.away + j,
        addHome: i,
        addAway: j,
        probability: pH[i] * pA[j],
      })
    }
  }

  const base = analyseBase(raw, {
    keepCount: Math.max(1, raw.length - Math.max(0, input.removeCount)),
    factors,
    remaining: { home: remH, away: remA },
    labels: { home, away },
    explain: (sc, keep) => explain(sc, keep, { home, away, remH, remA }),
  })

  base.factors.unshift({
    tone: "neutral",
    text: `Forventet ${fmt(remH)} mål til for ${home} og ${fmt(remA)} for ${away} (${pct(remainingShare)} av kampens mål gjenstår). ${prior.detail}`,
  })

  return { ...base, xg }
}

/**
 * Felles for pause- og førkampsanalysen: rangér rutene, marker de beste som
 * «behold», og summer sannsynlighetene. Rutenettet vises i fast rekkefølge
 * (hjemmelagets mål nedover, bortelagets bortover).
 */
export function analyseBase(
  raw: Omit<Scenario, "rank" | "keep" | "why">[],
  opts: {
    keepCount: number
    factors: Factor[]
    remaining: { home: number; away: number }
    labels: { home: string; away: string }
    explain?: (s: Omit<Scenario, "rank" | "keep" | "why">, keep: boolean) => string
    scenarioLabel?: (s: Omit<Scenario, "rank" | "keep" | "why">) => string
  }
): Analysis {
  // Mest sannsynlig først; ved likt, færrest mål først (enklest å forklare).
  const ranked = [...raw].sort(
    (a, b) =>
      b.probability - a.probability ||
      a.addHome + a.addAway - (b.addHome + b.addAway)
  )

  const scenarios: Scenario[] = ranked.map((sc, idx) => {
    const keep = idx < opts.keepCount
    const why =
      opts.explain?.(sc, keep) ??
      `${keep ? "Behold" : "Stryk"}: ${opts.scenarioLabel?.(sc) ?? `${sc.home}–${sc.away}`} — ${pct(sc.probability)}.`
    return { ...sc, rank: idx + 1, keep, why }
  })
  scenarios.sort((a, b) => a.addHome - b.addHome || a.addAway - b.addAway)

  return {
    scenarios,
    remaining: opts.remaining,
    gridProbability: scenarios.reduce((sum, x) => sum + x.probability, 0),
    keptProbability: scenarios.filter((x) => x.keep).reduce((sum, x) => sum + x.probability, 0),
    xg: null,
    factors: opts.factors,
  }
}

function explain(
  s: { addHome: number; addAway: number; probability: number },
  keep: boolean,
  ctx: { home: string; away: string; remH: number; remA: number }
): string {
  const side = (name: string, add: number, rem: number) => {
    const p = poissonPmf(add, rem)
    const label = add === 0 ? "ingen flere" : `${add} til`
    return `${name}: ${label} (${pct(p)})`
  }
  const head = keep ? "Behold" : "Stryk"
  const base = `${side(ctx.home, s.addHome, ctx.remH)}, ${side(ctx.away, s.addAway, ctx.remA)}.`

  // Begrunnelse for hvorfor noe er usannsynlig, bare for strøkne scenarioer.
  const notes: string[] = []
  if (!keep) {
    const note = (name: string, add: number, rem: number) => {
      if (add >= 2 && rem < 0.8) notes.push(`${name} må score ${add} til, men forventes bare ${fmt(rem)}`)
      else if (add === 1 && rem < 0.35) notes.push(`${name} har lav rate (${fmt(rem)} forventet)`)
      else if (add === 0 && rem >= 1.2) notes.push(`${name} uten flere mål er lite sannsynlig (forventer ${fmt(rem)})`)
    }
    note(ctx.home, s.addHome, ctx.remH)
    note(ctx.away, s.addAway, ctx.remA)
  }

  return `${head}: ${base}${notes.length ? " " + notes.join(". ") + "." : ""} Samlet ${pct(s.probability)}.`
}
