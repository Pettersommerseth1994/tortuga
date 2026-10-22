import type { Metadata } from "next"
import Link from "next/link"
import { ExternalLinkIcon } from "lucide-react"

import { requireUserId } from "@/lib/auth"
import { db } from "@/lib/db"
import { listMatches } from "@/lib/football/espn"
import type { MatchSummary } from "@/lib/football/types"
import { formatKickoff, formatKr, formatNumber, formatProb } from "@/lib/format"
import { AutoRefresh } from "@/components/auto-refresh"
import { BetCheck } from "@/components/bet-check"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export const metadata: Metadata = { title: "Sjekkliste" }
export const dynamic = "force-dynamic"

const ODDSEN_URL = "https://www.norsk-tipping.no/sport/oddsen"

export default async function ChecklistPage() {
  const userId = await requireUserId()

  const [tracked, matches] = await Promise.all([
    db.trackedMatch.findMany({
      where: { userId, archivedAt: null },
      orderBy: { kickoff: "asc" },
      include: { bets: { orderBy: [{ probability: "desc" }] } },
    }),
    listMatches().catch(() => [] as MatchSummary[]),
  ])
  const byId = new Map(matches.map((m) => [m.id, m]))

  const allBets = tracked.flatMap((t) => t.bets)
  const open = allBets.filter((b) => !b.placed)
  const openStake = open.reduce((s, b) => s + (b.stake ?? 0), 0)

  return (
    <div className="flex flex-col gap-6">
      <AutoRefresh seconds={30} />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sjekkliste</h1>
          <p className="text-sm text-muted-foreground">
            Bettene du skal legge inn selv i Oddsen. Kryss av når de er plassert.
          </p>
        </div>
        <Button variant="outline" asChild>
          <a href={ODDSEN_URL} target="_blank" rel="noreferrer">
            Åpne Oddsen <ExternalLinkIcon />
          </a>
        </Button>
      </div>

      {allBets.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="tabular">
            {open.length} av {allBets.length} gjenstår
          </Badge>
          <Badge variant="secondary" className="tabular">
            {formatKr(openStake)} å plassere
          </Badge>
        </div>
      )}

      {tracked.length === 0 && (
        <Alert>
          <AlertDescription>
            Ingen aktive kamper.{" "}
            <Link href="/kamper" className="underline underline-offset-4">
              Velg opptil tre på Kamper-siden
            </Link>
            .
          </AlertDescription>
        </Alert>
      )}

      {tracked.map((t) => {
        const m = byId.get(t.eventId)
        const live = m && (m.status === "live" || m.status === "halftime")
        const stake = t.bets.reduce((s, b) => s + (b.stake ?? 0), 0)
        return (
          <Card key={t.id}>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2">
                <Link href={`/kamp/${t.eventId}`} className="hover:underline">
                  {t.homeName} – {t.awayName}
                </Link>
                {m && m.status !== "scheduled" && (
                  <span className="tabular text-muted-foreground">
                    {m.homeScore}–{m.awayScore}
                  </span>
                )}
                {live && <Badge variant="bear">Live · {m?.statusLabel}</Badge>}
              </CardTitle>
              <CardDescription>
                {formatKickoff(t.kickoff)}
                {stake > 0 ? ` · ${formatKr(stake)} totalt` : ""}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6">
              {t.bets.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Ingen plan ennå.{" "}
                  <Link href={`/kamp/${t.eventId}`} className="underline underline-offset-4">
                    Lag og lås en plan
                  </Link>{" "}
                  — før avspark eller i pausen.
                </p>
              ) : (
                (["pre", "ht"] as const).map((kind) => {
                  const bets = t.bets.filter((b) => b.kind === kind)
                  if (bets.length === 0) return null
                  const missed =
                    kind === "pre" &&
                    t.kickoff.getTime() < Date.now() &&
                    bets.some((b) => !b.placed)
                  return (
                    <div key={kind} className="grid gap-2">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <h3 className="text-sm font-medium">
                          {kind === "pre"
                            ? "Før kamp — plasseres én gang, før avspark"
                            : `Ved pause — plan låst på ${t.lockedScore ?? "?"}`}
                        </h3>
                        {missed && (
                          <span className="text-xs text-bear">
                            Avspark er gått — de som ikke er plassert kan ikke lenger spilles før kamp.
                          </span>
                        )}
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Bet: riktig resultat</TableHead>
                            <TableHead className="text-right">Modell</TableHead>
                            <TableHead className="text-right">Odds</TableHead>
                            <TableHead className="text-right">Innsats</TableHead>
                            <TableHead className="w-36">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {bets.map((b) => (
                            <TableRow key={b.id}>
                              <TableCell className="tabular font-semibold">
                                {t.homeName} {b.homeGoals}–{b.awayGoals} {t.awayName}
                              </TableCell>
                              <TableCell className="tabular text-right">
                                {formatProb(b.probability)}
                              </TableCell>
                              <TableCell className="tabular text-right">
                                {b.odds ? formatNumber(b.odds) : "–"}
                              </TableCell>
                              <TableCell className="tabular text-right">
                                {b.stake != null ? formatKr(b.stake) : "–"}
                              </TableCell>
                              <TableCell>
                                <BetCheck
                                  betId={b.id}
                                  placed={b.placed}
                                  label={`Plassert: ${b.homeGoals}–${b.awayGoals}`}
                                />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )
                })
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
