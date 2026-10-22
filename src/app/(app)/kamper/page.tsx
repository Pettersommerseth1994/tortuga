import type { Metadata } from "next"
import Link from "next/link"
import { AlertCircleIcon, ArrowRightIcon } from "lucide-react"

import { requireUserId } from "@/lib/auth"
import { db } from "@/lib/db"
import { listMatches } from "@/lib/football/espn"
import type { MatchSummary } from "@/lib/football/types"
import { MAX_ACTIVE_MATCHES } from "@/lib/limits"
import { dayKey, formatDay, formatKickoff } from "@/lib/format"
import { AutoRefresh } from "@/components/auto-refresh"
import { MatchRow } from "@/components/match/match-row"
import { TeamBadge } from "@/components/match/team-badge"
import { TrackButton, UntrackButton } from "@/components/track-button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export const metadata: Metadata = { title: "Kamper" }
export const dynamic = "force-dynamic"

export default async function MatchesPage() {
  const userId = await requireUserId()

  const [tracked, matchesResult] = await Promise.all([
    db.trackedMatch.findMany({
      where: { userId, archivedAt: null },
      orderBy: { kickoff: "asc" },
      include: { bets: true },
    }),
    listMatches().then(
      (matches) => ({ matches, error: null as string | null }),
      (e: unknown) => ({
        matches: [] as MatchSummary[],
        error: e instanceof Error ? e.message : "Ukjent feil",
      })
    ),
  ])

  const { matches, error } = matchesResult
  const byId = new Map(matches.map((m) => [m.id, m]))
  const trackedIds = new Set(tracked.map((t) => t.eventId))
  const full = tracked.length >= MAX_ACTIVE_MATCHES

  const live = matches.filter((m) => m.status === "live" || m.status === "halftime")
  const upcoming = matches.filter((m) => m.status === "scheduled")
  const finished = matches.filter((m) => m.status === "finished").reverse()

  const upcomingByDay = new Map<string, MatchSummary[]>()
  for (const m of upcoming) {
    const k = dayKey(m.kickoff)
    upcomingByDay.set(k, [...(upcomingByDay.get(k) ?? []), m])
  }

  const trailingFor = (m: MatchSummary) =>
    trackedIds.has(m.id) ? (
      <Badge variant="secondary">Med</Badge>
    ) : (
      <TrackButton eventId={m.id} disabled={full} />
    )

  return (
    <div className="flex flex-col gap-8">
      {(live.length > 0 || tracked.length > 0) && <AutoRefresh seconds={20} />}

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Champions League</h1>
        <p className="text-sm text-muted-foreground">
          Velg opptil {MAX_ACTIVE_MATCHES} kamper. Ved pause regner Tortuga ut de fem mest
          sannsynlige sluttresultatene av ni.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertTitle>Kunne ikke hente kamper</AlertTitle>
          <AlertDescription>
            Dataleverandøren svarte ikke ({error}). Prøv igjen om litt.
          </AlertDescription>
        </Alert>
      )}

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
                <Card key={t.id} className="gap-3 py-4">
                  <CardHeader className="px-4">
                    <CardDescription className="flex items-center justify-between">
                      <span>
                        {m && (m.status === "live" || m.status === "halftime")
                          ? `Live · ${m.statusLabel}`
                          : m?.status === "finished"
                            ? "Ferdig"
                            : formatKickoff(t.kickoff)}
                      </span>
                      <UntrackButton trackedId={t.id} />
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
                        {t.lockedAt
                          ? `Plan låst på ${t.lockedScore} · ${open} bet gjenstår`
                          : "Plan ikke laget"}
                      </span>
                      <Button asChild size="sm" variant="secondary">
                        <Link href={`/kamp/${t.eventId}`}>
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

      {live.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
            Live nå
          </h2>
          <div className="grid gap-2">
            {live.map((m) => (
              <MatchRow key={m.id} match={m} trailing={trailingFor(m)} />
            ))}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
          Kommende
        </h2>
        {upcoming.length === 0 && !error && (
          <p className="text-sm text-muted-foreground">
            Ingen kommende kamper de neste tre ukene.
          </p>
        )}
        {[...upcomingByDay.entries()].map(([day, list]) => (
          <div key={day} className="flex flex-col gap-2">
            <h3 className="text-sm font-medium capitalize">{formatDay(list[0].kickoff)}</h3>
            <div className="grid gap-2">
              {list.map((m) => (
                <MatchRow key={m.id} match={m} trailing={trailingFor(m)} />
              ))}
            </div>
          </div>
        ))}
      </section>

      {finished.length > 0 && (
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
              Nylig ferdige
            </h2>
            <p className="text-xs text-muted-foreground">
              Åpne en ferdig kamp for å se hva modellen ville gitt deg ved pause.
            </p>
          </div>
          <div className="grid gap-2">
            {finished.map((m) => (
              <MatchRow key={m.id} match={m} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
