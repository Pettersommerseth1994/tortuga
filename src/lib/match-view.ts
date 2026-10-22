import type { MatchDetail } from "@/lib/football/types"
import { analyse, type Analysis, type TeamStats } from "@/lib/model/analysis"
import { estimatePrior, type Prior } from "@/lib/model/prior"

/**
 * Hva modellen kjøres på:
 *  - live:       pågående kamp, bruker live-stilling og -statistikk
 *  - halftime:   pause — hovedbruken
 *  - simulation: kampen er ikke startet; du velger pausestilling selv
 *  - replay:     kampen er ferdig; modellen kjøres på pausestillingen for å
 *                se om sluttresultatet var blant de beholdte
 */
export type ViewMode = "live" | "halftime" | "simulation" | "replay"

export type MatchView = {
  mode: ViewMode
  /** Stillingen analysen er bygget på. */
  basis: { home: number; away: number }
  minute: number
  prior: Prior
  analysis: Analysis
  hasStats: boolean
}

function pickStats(match: MatchDetail): { home: TeamStats; away: TeamStats } | null {
  if (match.stats.length === 0) return null
  const get = (key: string, side: "home" | "away") =>
    match.stats.find((s) => s.key === key)?.[side] ?? 0
  const side = (s: "home" | "away"): TeamStats => ({
    possession: get("possessionPct", s),
    shots: get("totalShots", s),
    shotsOnTarget: get("shotsOnTarget", s),
    blocked: get("blockedShots", s),
    corners: get("wonCorners", s),
  })
  const stats = { home: side("home"), away: side("away") }
  // Før avspark er alt null — da har vi ingen statistikk å vise til.
  return stats.home.shots + stats.away.shots > 0 ? stats : null
}

export function buildView(
  match: MatchDetail,
  opts: { simScore?: { home: number; away: number }; removeCount?: number } = {}
): MatchView {
  const prior = estimatePrior(match)
  const removeCount = opts.removeCount ?? 4

  let mode: ViewMode
  let basis = { home: match.homeScore, away: match.awayScore }
  let minute = 45
  let stats: ReturnType<typeof pickStats> = null

  switch (match.status) {
    case "halftime":
      mode = "halftime"
      stats = pickStats(match)
      break
    case "live": {
      mode = "live"
      stats = pickStats(match)
      // I første omgangs tilleggstid står klokka på 45+; modellen regner det som 45.
      minute = match.halftime ? Math.max(45, match.minute ?? 45) : Math.min(45, match.minute ?? 0)
      break
    }
    case "finished":
      mode = "replay"
      basis = match.halftime ?? { home: 0, away: 0 }
      break
    default:
      mode = "simulation"
      basis = opts.simScore ?? { home: 0, away: 0 }
  }

  const analysis = analyse({
    home: match.home.shortName,
    away: match.away.shortName,
    score: basis,
    minute,
    prior,
    stats,
    redCards: mode === "live" || mode === "halftime" ? match.redCards : { home: 0, away: 0 },
    removeCount,
  })

  return { mode, basis, minute, prior, analysis, hasStats: stats !== null }
}
