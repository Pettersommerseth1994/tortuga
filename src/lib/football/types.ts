/**
 * Leverandøruavhengige typer. UI og modell kjenner bare disse — ESPN-formatet
 * lever kun i espn.ts, så leverandøren kan byttes (f.eks. til API-Football)
 * uten å røre resten.
 */

export type MatchStatus = "scheduled" | "live" | "halftime" | "finished" | "other"

export type TeamLite = {
  id: string
  name: string
  shortName: string
  abbreviation: string
  logo?: string
}

export type MatchSummary = {
  id: string
  kickoff: string
  status: MatchStatus
  /** "43'", "Pause", "Ferdig" … ferdig formatert for visning. */
  statusLabel: string
  /** Spilte minutter (inkl. tillegg), null før avspark. */
  minute: number | null
  home: TeamLite
  away: TeamLite
  homeScore: number
  awayScore: number
  /** Stillingen ved pause. Null hvis første omgang ikke er ferdig. */
  halftime: { home: number; away: number } | null
  venue?: string
}

export type TableRow = {
  rank: number
  played: number
  wins: number
  draws: number
  losses: number
  points: number
  goalDiff: number
}

export type RecentGame = {
  date: string
  opponent: string
  home: boolean
  goalsFor: number
  goalsAgainst: number
  result: "W" | "D" | "L"
  competition: string
}

export type TeamInfo = TeamLite & {
  table: TableRow | null
  /** Siste kamper, eldste først. Kan inneholde treningskamper. */
  recent: RecentGame[]
}

export type StatPair = {
  key: string
  label: string
  home: number
  away: number
  /** Vises som prosent (ballbesittelse). */
  percent?: boolean
}

export type MatchEvent = {
  minute: string
  type: "goal" | "yellow" | "red" | "other"
  team?: "home" | "away"
  text: string
}

/** Desimalodds fra et bookmakerfeed, brukt som forhåndsvurdering. */
export type MatchOdds = {
  provider: string
  home: number
  draw: number
  away: number
  /** Total-mål-linje, f.eks. 2.5. */
  overUnder?: number
}

export type MatchDetail = MatchSummary & {
  homeTeam: TeamInfo
  awayTeam: TeamInfo
  stats: StatPair[]
  events: MatchEvent[]
  odds: MatchOdds | null
  redCards: { home: number; away: number }
}
