import { useQuery } from "@tanstack/react-query"
import { ArrowRightIcon, PlusIcon, XIcon } from "lucide-react"
import { Link } from "react-router"
import { toast } from "sonner"

import { MatchRow } from "@/components/match/match-row"
import { MatchSections } from "@/components/match/match-sections"
import { TeamBadge } from "@/components/match/team-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { MatchSummary } from "@/lib/football/types"
import { formatKickoff } from "@/lib/format"
import { MAX_ACTIVE_MATCHES } from "@/lib/limits"

import { listMatches } from "../lib/data"
import { trackMatch, untrackMatch, useTracked } from "../lib/store"

export function Matches() {
  const tracked = useTracked()
  const { data: matches = [], error, isPending } = useQuery({
    queryKey: ["matches"],
    queryFn: () => listMatches(),
    // Raskere når noe spilles; ellers sparer vi ESPN (og nettleseren) for kall.
    refetchInterval: (q) =>
      q.state.data?.some((m) => m.status === "live" || m.status === "halftime") ? 30_000 : 120_000,
  })

  const byId = new Map(matches.map((m) => [m.id, m]))
  const trackedIds = new Set(tracked.map((t) => t.eventId))
  const full = tracked.length >= MAX_ACTIVE_MATCHES

  const add = (m: MatchSummary) => {
    const res = trackMatch({
      eventId: m.id,
      homeName: m.home.name,
      awayName: m.away.name,
      kickoff: m.kickoff,
    })
    if (!res.ok) toast.error(res.error)
    else toast.success("Kampen er med i Tortuga.")
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Kamper</h1>
        <p className="text-sm text-muted-foreground">
          Champions League, Europa League og Conference League. Velg opptil {MAX_ACTIVE_MATCHES}{" "}
          kamper; ved pause regner Tortuga ut de fem mest sannsynlige sluttresultatene av ni.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
            Mine kamper
          </h2>
          <Badge variant={full ? "default" : "secondary"} className="tabular">
            {tracked.length} / {MAX_ACTIVE_MATCHES}
          </Badge>
        </div>

        {tracked.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ingen kamper valgt ennå</CardTitle>
              <CardDescription>
                Trykk «Ta med» på en kamp nedenfor. Du kan ha tre aktive om gangen.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-3">
            {tracked.map((t) => {
              const m = byId.get(t.eventId)
              const open = t.bets.filter((b) => !b.placed).length
              const started = m && m.status !== "scheduled"
              return (
                <Card key={t.eventId} className="gap-3 py-4">
                  <CardHeader className="px-4">
                    <CardDescription className="flex items-center justify-between">
                      <span>
                        {m ? `${m.competition.short} · ` : ""}
                        {m && (m.status === "live" || m.status === "halftime")
                          ? `Live · ${m.statusLabel}`
                          : m?.status === "finished"
                            ? "Ferdig"
                            : formatKickoff(t.kickoff)}
                      </span>
                      <Button size="xs" variant="ghost" onClick={() => untrackMatch(t.eventId)}>
                        <XIcon /> Fjern
                      </Button>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-3 px-4">
                    <div className="grid gap-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <TeamBadge name={m?.home.name ?? t.homeName} logo={m?.home.logo} size={22} />
                        <span className="tabular font-semibold">{started ? m.homeScore : ""}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <TeamBadge name={m?.away.name ?? t.awayName} logo={m?.away.logo} size={22} />
                        <span className="tabular font-semibold">{started ? m.awayScore : ""}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground">
                        {t.lockedScore
                          ? `Plan låst på ${t.lockedScore} · ${open} bet gjenstår`
                          : "Plan ikke laget"}
                      </span>
                      <Button asChild size="sm" variant="secondary">
                        <Link to={`/kamp/${t.eventId}`}>
                          Åpne <ArrowRightIcon />
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </section>

      <MatchSections
        matches={matches}
        loading={isPending}
        error={error ? (error instanceof Error ? error.message : "ukjent feil") : null}
        renderRow={(m) => (
          <MatchRow
            match={m}
            renderLink={({ className, children }) => (
              <Link to={`/kamp/${m.id}`} className={className}>
                {children}
              </Link>
            )}
            trailing={
              m.status === "finished" ? null : trackedIds.has(m.id) ? (
                <Badge variant="secondary">Med</Badge>
              ) : (
                <Button size="sm" variant="outline" disabled={full} onClick={() => add(m)}>
                  <PlusIcon /> Ta med
                </Button>
              )
            }
          />
        )}
      />
    </div>
  )
}
