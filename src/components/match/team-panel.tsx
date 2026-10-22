import type { TeamInfo } from "@/lib/football/types"
import { formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

import { TeamBadge } from "./team-badge"

const RESULT_STYLE = {
  W: "bg-bull text-bull-foreground",
  D: "bg-muted text-muted-foreground",
  L: "bg-bear text-bear-foreground",
} as const

const RESULT_LABEL = { W: "S", D: "U", L: "T" } as const

function recentCompetitive(team: TeamInfo) {
  const c = team.recent.filter((g) => !/friendly/i.test(g.competition))
  return c.length >= 3 ? c : team.recent
}

/** Lagkort: tabellplassering, form og siste kamper. */
export function TeamPanel({ team }: { team: TeamInfo }) {
  const games = recentCompetitive(team)
  const gf = games.reduce((s, g) => s + g.goalsFor, 0)
  const ga = games.reduce((s, g) => s + g.goalsAgainst, 0)
  const n = Math.max(games.length, 1)

  return (
    <Card className="gap-3 py-4">
      <CardHeader className="px-4">
        <TeamBadge name={team.name} logo={team.logo} size={32} className="text-base" />
      </CardHeader>
      <CardContent className="grid gap-4 px-4">
        {team.table ? (
          <dl className="tabular grid grid-cols-4 gap-2 text-center">
            <Stat label="Plass" value={`${team.table.rank}.`} />
            <Stat label="Poeng" value={String(team.table.points)} />
            <Stat
              label="S-U-T"
              value={`${team.table.wins}-${team.table.draws}-${team.table.losses}`}
            />
            <Stat
              label="Måldiff"
              value={`${team.table.goalDiff > 0 ? "+" : ""}${team.table.goalDiff}`}
            />
          </dl>
        ) : (
          <p className="text-xs text-muted-foreground">Ingen tabellinfo tilgjengelig.</p>
        )}

        {games.length > 0 && (
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Siste kamper</span>
              <span className="tabular text-xs text-muted-foreground">
                {formatNumber(gf / n, 1)} scoret · {formatNumber(ga / n, 1)} sluppet inn per kamp
              </span>
            </div>
            <div className="flex gap-1">
              {games.map((g, i) => (
                <span
                  key={i}
                  title={`${g.home ? "H" : "B"} ${g.opponent} ${g.goalsFor}–${g.goalsAgainst}`}
                  className={cn(
                    "grid size-6 place-items-center rounded text-xs font-semibold",
                    RESULT_STYLE[g.result]
                  )}
                >
                  {RESULT_LABEL[g.result]}
                </span>
              ))}
            </div>
            <ul className="grid gap-1 text-xs text-muted-foreground">
              {[...games].reverse().map((g, i) => (
                <li key={i} className="flex justify-between gap-2">
                  <span className="truncate">
                    {g.home ? "H" : "B"} · {g.opponent}
                  </span>
                  <span className="tabular shrink-0 font-medium text-foreground">
                    {g.goalsFor}–{g.goalsAgainst}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/50 px-1 py-1.5">
      <dt className="text-[10px] tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd className="text-sm font-semibold">{value}</dd>
    </div>
  )
}
