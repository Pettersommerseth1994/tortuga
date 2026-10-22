import type { MatchSummary } from "@/lib/football/types"
import { isNorwegianTeam } from "@/lib/football/norway"
import { formatTime } from "@/lib/format"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

import { TeamBadge } from "./team-badge"

/**
 * Én kamp i en liste: tid/status, lag, stilling. Hele raden er en lenke, men
 * hvordan lenken lages avhenger av ruteren (Next lokalt, react-router på Pages),
 * så den injiseres.
 */
export function MatchRow({
  match,
  trailing,
  renderLink,
}: {
  match: MatchSummary
  trailing?: React.ReactNode
  renderLink: (props: { className: string; children: React.ReactNode }) => React.ReactNode
}) {
  const live = match.status === "live" || match.status === "halftime"
  const started = match.status !== "scheduled"

  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5 transition-colors hover:bg-accent/40">
      {renderLink({
        className:
          "grid min-w-0 flex-1 grid-cols-[3.5rem_1fr_auto] items-center gap-3 sm:grid-cols-[4.5rem_1fr_auto]",
        children: (
          <>
            <span className="tabular grid gap-1 text-xs text-muted-foreground">
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
              <span className="text-[10px] font-medium tracking-wide uppercase">
                {match.competition.short}
              </span>
            </span>

            <span className="grid min-w-0 gap-1">
              <TeamLine name={match.home.name} logo={match.home.logo} />
              <TeamLine name={match.away.name} logo={match.away.logo} />
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
          </>
        ),
      })}
      {trailing && <div className="shrink-0">{trailing}</div>}
    </div>
  )
}

function TeamLine({ name, logo }: { name: string; logo?: string }) {
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <TeamBadge name={name} logo={logo} size={20} />
      {isNorwegianTeam(name) && (
        <span title="Norsk lag" aria-label="Norsk lag" className="shrink-0 text-xs">
          🇳🇴
        </span>
      )}
    </span>
  )
}
