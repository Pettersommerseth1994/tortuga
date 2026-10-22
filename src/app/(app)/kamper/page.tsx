import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRightIcon } from "lucide-react"

import { requireUserId } from "@/lib/auth"
import { db } from "@/lib/db"
import { listMatches } from "@/lib/football/espn"
import type { MatchSummary } from "@/lib/football/types"
import { MAX_ACTIVE_MATCHES } from "@/lib/limits"
import { formatKickoff } from "@/lib/format"
import { AutoRefresh } from "@/components/auto-refresh"
import { MatchSectionsLocal } from "@/components/match/match-sections-local"
import { TeamBadge } from "@/components/match/team-badge"
import { UntrackButton } from "@/components/track-button"
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

  return (
    <div className="flex flex-col gap-8">
      {(live.length > 0 || tracked.length > 0) && <AutoRefresh seconds={20} />}

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Kamper</h1>
        <p className="text-sm text-muted-foreground">
          Champions League, Europa League og Conference League. Velg opptil{" "}
          {MAX_ACTIVE_MATCHES} kamper; ved pause regner Tortuga ut de fem mest sannsynlige
          sluttresultatene av ni.
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
              const preCount = t.bets.filter((b) => b.kind === "pre").length
              const htCount = t.bets.length - preCount
              const started = m && m.status !== "scheduled"
              return (
                <Card key={t.id} className="gap-3 py-4">
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
                        {t.bets.length === 0
                          ? "Plan ikke laget"
                          : `${[preCount > 0 && `${preCount} før kamp`, htCount > 0 && `${htCount} ved pause`].filter(Boolean).join(" · ")} · ${open} gjenstår`}
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

      <MatchSectionsLocal
        matches={matches}
        trackedIds={[...trackedIds]}
        full={full}
        error={error}
      />
    </div>
  )
}
