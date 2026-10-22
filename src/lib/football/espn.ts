import type {
  Competition,
  MatchDetail,
  MatchEvent,
  MatchOdds,
  MatchStatus,
  MatchSummary,
  RecentGame,
  StatPair,
  TableRow,
  TeamInfo,
  TeamLite,
} from "./types"

/**
 * ESPNs åpne (uoffisielle, nøkkelfrie) fotball-API.
 *
 * Gir terminliste, live-stilling, lagstatistikk, form, tabell og odds for
 * Champions League. Det er ikke en dokumentert kontrakt — formatet kan endres
 * uten varsel, så all parsing her er defensiv og feiler mykt (manglende felt
 * gir tomme verdier, ikke krasj).
 */

const API = "https://site.api.espn.com/apis/site/v2/sports/soccer"

/** Turneringene Tortuga viser. Rekkefølgen er også visningsrekkefølgen i filteret. */
export const COMPETITIONS: Competition[] = [
  { slug: "uefa.champions", name: "Champions League", short: "CL" },
  { slug: "uefa.europa", name: "Europa League", short: "EL" },
  { slug: "uefa.europa.conf", name: "Conference League", short: "ECL" },
]

function competitionFor(slug: string | undefined, fallbackName?: string): Competition {
  return (
    COMPETITIONS.find((c) => c.slug === slug) ?? {
      slug: slug ?? "ukjent",
      name: fallbackName ?? "Fotball",
      short: "—",
    }
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any

async function getJson(url: string, revalidate: number): Promise<Json> {
  const res = await fetch(url, {
    next: { revalidate },
    headers: { accept: "application/json" },
  })
  if (!res.ok) throw new Error(`ESPN ${res.status} for ${url}`)
  return res.json()
}

function toNumber(v: unknown, fallback = 0): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""))
  return Number.isFinite(n) ? n : fallback
}

function teamLite(t: Json): TeamLite {
  return {
    id: String(t?.id ?? ""),
    name: t?.displayName ?? t?.name ?? "Ukjent",
    shortName: t?.shortDisplayName ?? t?.displayName ?? "Ukjent",
    abbreviation: t?.abbreviation ?? "",
    logo: t?.logo ?? t?.logos?.[0]?.href,
  }
}

function mapStatus(name: string): MatchStatus {
  switch (name) {
    case "STATUS_SCHEDULED":
      return "scheduled"
    case "STATUS_HALFTIME":
      return "halftime"
    case "STATUS_FIRST_HALF":
    case "STATUS_SECOND_HALF":
    case "STATUS_IN_PROGRESS":
    case "STATUS_EXTRA_TIME":
    case "STATUS_FIRST_HALF_EXTRA_TIME":
    case "STATUS_SECOND_HALF_EXTRA_TIME":
    case "STATUS_END_OF_REGULATION":
    case "STATUS_END_OF_EXTRATIME":
    case "STATUS_SHOOTOUT":
      return "live"
    case "STATUS_FULL_TIME":
    case "STATUS_FINAL":
    case "STATUS_FINAL_AET":
    case "STATUS_FINAL_PEN":
      return "finished"
    default:
      return "other"
  }
}

function statusLabel(status: MatchStatus, status_: Json): string {
  switch (status) {
    case "scheduled":
      return "Ikke startet"
    case "halftime":
      return "Pause"
    case "finished":
      return "Ferdig"
    case "live":
      return status_?.displayClock ?? "Live"
    default:
      return status_?.type?.description ?? "—"
  }
}

/** Mål per omgang fra linescores; null hvis omgangen ikke finnes ennå. */
function half(competitor: Json, index: number): number | null {
  const v = competitor?.linescores?.[index]?.displayValue
  return v === undefined ? null : toNumber(v)
}

function parseSummary(event: Json, competition: Competition): MatchSummary {
  const comp = event.competitions?.[0] ?? event
  const competitors: Json[] = comp.competitors ?? []
  const home = competitors.find((c) => c.homeAway === "home") ?? competitors[0]
  const away = competitors.find((c) => c.homeAway === "away") ?? competitors[1]

  const statusObj = event.status ?? comp.status
  const status = mapStatus(statusObj?.type?.name ?? "")
  // Oppsummeringsendepunktet gir ikke klokke for ferdige kamper.
  const minute =
    status === "scheduled"
      ? null
      : status === "finished"
        ? 90
        : Math.floor(toNumber(statusObj?.clock) / 60)

  const homeScore = toNumber(home?.score)
  const awayScore = toNumber(away?.score)

  // Pausestillingen er førsteomgangs-linescore, men bare når 1. omgang er
  // ferdig: i en pågående første omgang er "linescore 0" bare dagens stilling.
  const htDone =
    status === "halftime" ||
    status === "finished" ||
    (status === "live" && (minute ?? 0) >= 45 && half(home, 1) !== null)
  const h1 = half(home, 0)
  const a1 = half(away, 0)
  const halftime =
    htDone && h1 !== null && a1 !== null ? { home: h1, away: a1 } : null

  return {
    id: String(event.id ?? comp.id),
    competition,
    kickoff: event.date ?? comp.date,
    status,
    statusLabel: statusLabel(status, statusObj),
    minute,
    home: teamLite(home?.team),
    away: teamLite(away?.team),
    homeScore,
    awayScore,
    halftime,
    venue: comp.venue?.fullName,
  }
}

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10).replace(/-/g, "")
}

/**
 * Kamper fra `daysBack` dager tilbake til `daysAhead` fram, i alle turneringer.
 * ESPN godtar bare én dato per kall, så vi henter alle kombinasjonene parallelt.
 * Feiler enkeltkall, vises resten; feiler alle, kastes feilen videre.
 */
export async function listMatches(
  daysBack = 1,
  daysAhead = 21
): Promise<MatchSummary[]> {
  const days: string[] = []
  const now = Date.now()
  for (let i = -daysBack; i <= daysAhead; i++) {
    days.push(dayKey(new Date(now + i * 86_400_000)))
  }

  const calls = COMPETITIONS.flatMap((c) =>
    days.map(async (d) => ({
      competition: c,
      data: await getJson(`${API}/${c.slug}/scoreboard?dates=${d}`, 30),
    }))
  )
  const results = await Promise.allSettled(calls)
  if (results.every((r) => r.status === "rejected")) {
    throw (results[0] as PromiseRejectedResult).reason
  }

  const seen = new Set<string>()
  const matches: MatchSummary[] = []
  for (const r of results) {
    if (r.status !== "fulfilled") continue
    for (const ev of r.value.data.events ?? []) {
      const m = parseSummary(ev, r.value.competition)
      if (seen.has(m.id)) continue
      seen.add(m.id)
      matches.push(m)
    }
  }
  return matches.sort((a, b) => a.kickoff.localeCompare(b.kickoff))
}

// ------------------------------------------------------------------ odds

function americanToDecimal(ml: number) {
  return ml > 0 ? 1 + ml / 100 : 1 + 100 / Math.abs(ml)
}

function oddsValue(side: Json): number | null {
  if (!side) return null
  // Desimalodds ligger direkte på siden (uavgjort) eller nestet under `odds`
  // (hjemme/borte) i bookmaker-formatet; moneyLine brukes av DraftKings-formatet.
  const decimal = side.value ?? side.odds?.value
  if (typeof decimal === "number" && decimal > 1) return decimal
  if (typeof side.moneyLine === "number" && side.moneyLine !== 0) {
    return americanToDecimal(side.moneyLine)
  }
  return null
}

function parseOdds(summary: Json): MatchOdds | null {
  const feeds: Json[] = [...(summary.pickcenter ?? []), ...(summary.odds ?? [])]
  for (const f of feeds) {
    const home = oddsValue(f.homeTeamOdds)
    const draw = oddsValue(f.drawOdds)
    const away = oddsValue(f.awayTeamOdds)
    if (home && draw && away) {
      return {
        provider: f.provider?.displayName ?? f.provider?.name ?? "Bookmaker",
        home,
        draw,
        away,
        overUnder: typeof f.overUnder === "number" ? f.overUnder : undefined,
      }
    }
  }
  return null
}

// ----------------------------------------------------------------- lagdata

function standingsEntries(summary: Json): Json[] {
  return (summary.standings?.groups ?? []).flatMap(
    (g: Json) => g.standings?.entries ?? []
  )
}

/**
 * Noen turneringer (Conference League) har tom tabell i kampsammendraget, men
 * en komplett tabell på standings-endepunktet. Brukes som reserve.
 */
async function fetchStandingsEntries(slug: string): Promise<Json[]> {
  try {
    const j = await getJson(
      `https://site.api.espn.com/apis/v2/sports/soccer/${slug}/standings`,
      300
    )
    return (j.children ?? []).flatMap((c: Json) => c.standings?.entries ?? [])
  } catch {
    return []
  }
}

function parseTable(entries: Json[], teamId: string): TableRow | null {
  for (const entry of entries) {
    if (String(entry.id ?? entry.team?.id) !== teamId) continue
    const stat = (name: string) =>
      toNumber(entry.stats?.find((s: Json) => s.name === name)?.value)
    return {
      rank: stat("rank"),
      played: stat("gamesPlayed"),
      wins: stat("wins"),
      draws: stat("ties"),
      losses: stat("losses"),
      points: stat("points"),
      goalDiff: stat("pointDifferential"),
    }
  }
  return null
}

function parseRecent(summary: Json, teamId: string): RecentGame[] {
  const block = (summary.lastFiveGames ?? []).find(
    (b: Json) => String(b.team?.id) === teamId
  )
  const games: RecentGame[] = (block?.events ?? []).map((e: Json) => {
    const isHome = String(e.homeTeamId) === teamId
    const gf = toNumber(isHome ? e.homeTeamScore : e.awayTeamScore)
    const ga = toNumber(isHome ? e.awayTeamScore : e.homeTeamScore)
    return {
      date: e.gameDate,
      opponent: e.opponent?.displayName ?? "Ukjent",
      home: isHome,
      goalsFor: gf,
      goalsAgainst: ga,
      result: gf > ga ? "W" : gf < ga ? "L" : "D",
      competition: e.leagueName ?? e.competitionName ?? "",
    } satisfies RecentGame
  })
  return games.sort((a, b) => a.date.localeCompare(b.date))
}

const STAT_ROWS: { key: string; label: string; percent?: boolean }[] = [
  { key: "possessionPct", label: "Ballbesittelse", percent: true },
  { key: "totalShots", label: "Skudd" },
  { key: "shotsOnTarget", label: "Skudd på mål" },
  { key: "blockedShots", label: "Blokkerte skudd" },
  { key: "wonCorners", label: "Hjørnespark" },
  { key: "saves", label: "Redninger" },
  { key: "foulsCommitted", label: "Frispark begått" },
  { key: "offsides", label: "Offside" },
  { key: "yellowCards", label: "Gule kort" },
  { key: "redCards", label: "Røde kort" },
]

function parseStats(summary: Json): StatPair[] {
  const teams: Json[] = summary.boxscore?.teams ?? []
  const home = teams.find((t) => t.homeAway === "home") ?? teams[0]
  const away = teams.find((t) => t.homeAway === "away") ?? teams[1]
  if (!home || !away) return []

  const read = (t: Json, key: string) =>
    toNumber(t.statistics?.find((s: Json) => s.name === key)?.displayValue)

  const hasAny = (home.statistics ?? []).length > 0
  if (!hasAny) return []

  return STAT_ROWS.map((r) => ({
    key: r.key,
    label: r.label,
    home: read(home, r.key),
    away: read(away, r.key),
    percent: r.percent,
  }))
}

function parseEvents(summary: Json, homeId: string): MatchEvent[] {
  const out: MatchEvent[] = []
  for (const e of summary.keyEvents ?? []) {
    const type = e.type?.type as string | undefined
    let kind: MatchEvent["type"] = "other"
    if (e.scoringPlay) kind = "goal"
    else if (type === "yellow-card") kind = "yellow"
    else if (type === "red-card") kind = "red"
    if (kind === "other") continue

    out.push({
      minute: e.clock?.displayValue ?? "",
      type: kind,
      team: e.team?.id ? (String(e.team.id) === homeId ? "home" : "away") : undefined,
      text: e.shortText ?? e.text ?? "",
    })
  }
  return out
}

export async function getMatch(id: string): Promise<MatchDetail | null> {
  let summary: Json
  try {
    // Endepunktet er turneringsuavhengig; kamp-ID-en er unik på tvers.
    summary = await getJson(
      `${API}/uefa.champions/summary?event=${encodeURIComponent(id)}`,
      10
    )
  } catch {
    return null
  }

  const comp = summary.header?.competitions?.[0]
  if (!comp) return null

  const base = parseSummary(
    {
      id: summary.header.id,
      date: comp.date,
      status: comp.status,
      competitions: [comp],
    },
    competitionFor(summary.header.league?.slug, summary.header.league?.name)
  )

  const homeId = base.home.id
  const awayId = base.away.id

  let entries = standingsEntries(summary)
  if (!entries.some((e) => [homeId, awayId].includes(String(e.id ?? e.team?.id)))) {
    entries = await fetchStandingsEntries(base.competition.slug)
  }

  const homeTeam: TeamInfo = {
    ...base.home,
    table: parseTable(entries, homeId),
    recent: parseRecent(summary, homeId),
  }
  const awayTeam: TeamInfo = {
    ...base.away,
    table: parseTable(entries, awayId),
    recent: parseRecent(summary, awayId),
  }

  const stats = parseStats(summary)
  const reds = stats.find((s) => s.key === "redCards")

  return {
    ...base,
    venue: base.venue ?? summary.gameInfo?.venue?.fullName,
    homeTeam,
    awayTeam,
    stats,
    events: parseEvents(summary, homeId),
    odds: parseOdds(summary),
    redCards: { home: reds?.home ?? 0, away: reds?.away ?? 0 },
  }
}
