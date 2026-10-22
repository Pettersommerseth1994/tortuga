import { Link } from "react-router"

import type { MatchSummary } from "@/lib/football/types"
import { formatTime } from "@/lib/format"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

import { TeamBadge } from "@/components/match/team-badge"

/** Én kamp i en liste: tid/status, lag, stilling. Hele raden er en lenke. */
export function MatchRow({
  match,
  trailing,
}: {
  match: MatchSummary
  trailing?: React.ReactNode
}) {
  const live = match.status === "live" || match.status === "halftime"
  const started = match.status !== "scheduled"

  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5 transition-colors hover:bg-accent/40">
      <Link
        to={`/kamp/${match.id}`}
        className="grid min-w-0 flex-1 grid-cols-[3.5rem_1fr_auto] items-center gap-3 sm:grid-cols-[4.5rem_1fr_auto]"
      >
        <span className="tabular text-xs text-muted-foreground">
          {live ? (
            <Badge variant="bear" className="gap-1.5">
              <span className="size-1.5 animate-pulse rounded-full bg-bear" />
              {match.statusLabel}
            </Badge>
          ) : match.status === "finished" ? (
            "Ferdig"
          ) : (
            formatTime(match.kickoff)
          )}
        </span>

        <span className="grid min-w-0 gap-1">
          <TeamBadge name={match.home.name} logo={match.home.logo} size={20} />
          <TeamBadge name={match.away.name} logo={match.away.logo} size={20} />
        </span>

        <span
          className={cn(
            "tabular grid gap-1 text-right font-semibold",
            !started && "text-muted-foreground/40"
          )}
        >
          <span>{started ? match.homeScore : "–"}</span>
          <span>{started ? match.awayScore : "–"}</span>
        </span>
      </Link>
      {trailing && <div className="shrink-0">{trailing}</div>}
    </div>
  )
}
