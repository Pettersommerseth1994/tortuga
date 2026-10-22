import type { Metadata } from "next"
import Link from "next/link"
import { ExternalLinkIcon, PencilIcon } from "lucide-react"

import { requireUserId } from "@/lib/auth"
import { db } from "@/lib/db"
import { listMatches } from "@/lib/football/espn"
import type { MatchSummary } from "@/lib/football/types"
import { formatKickoff, formatKr, formatNumber, formatProb } from "@/lib/format"
import type { LockedLeg } from "@/lib/model/combos"
import { AutoRefresh } from "@/components/auto-refresh"
import { BetCheck } from "@/components/bet-check"
import { ComboBetsTable, type ComboRow } from "@/components/combo-bets-table"
import { ComboCheck } from "@/components/combo-check"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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

  const [tracked, matches, comboRows] = await Promise.all([
    db.trackedMatch.findMany({
      where: { userId, archivedAt: null },
      orderBy: { kickoff: "asc" },
      include: { bets: { orderBy: [{ probability: "desc" }] } },
    }),
    listMatches().catch(() => [] as MatchSummary[]),
    db.comboBet.findMany({ where: { userId }, orderBy: [{ createdAt: "asc" }, { odds: "asc" }] }),
  ])
  const byId = new Map(matches.map((m) => [m.id, m]))

  // Kombinasjoner vises så lenge alle kampene i dem fortsatt er aktive.
  const activeIds = new Set(tracked.map((t) => t.eventId))
  const combos: ComboRow[] = comboRows
    .map((c) => ({
      id: c.id,
      kind: (c.kind === "pre" ? "pre" : "ht") as ComboRow["kind"],
      legs: c.legs as unknown as LockedLeg[],
      odds: c.odds,
      probability: c.probability,
      stake: c.stake,
      placed: c.placed,
    }))
    .filter((c) => c.legs.every((l) => activeIds.has(l.eventId)))

  const allBets = tracked.flatMap((t) => t.bets)
  const open = allBets.filter((b) => !b.placed)
  const openCombos = combos.filter((c) => !c.placed)
  const openStake =
    open.reduce((s, b) => s + (b.stake ?? 0), 0) + openCombos.reduce((s, c) => s + (c.stake ?? 0), 0)

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

      {(allBets.length > 0 || combos.length > 0) && (
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="tabular">
            {open.length + openCombos.length} av {allBets.length + combos.length} gjenstår
          </Badge>
          <Badge variant="secondary" className="tabular">
            {formatKr(openStake)} å plassere
          </Badge>
        </div>
      )}

      {tracked.length === 0 && combos.length === 0 && (
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
              <CardAction>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/kamp/${t.eventId}`}>
                    <PencilIcon /> Rediger
                  </Link>
                </Button>
              </CardAction>
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

      {combos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Kombinasjoner</CardTitle>
            <CardDescription>
              Dobbel og trippel på riktig resultat: alle kampene må treffe. Legges inn som kombinasjonsspill i
              Oddsen.
            </CardDescription>
            <CardAction>
              <Button asChild size="sm" variant="outline">
                <Link href="/kombi">
                  <PencilIcon /> Rediger
                </Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <ComboBetsTable
              combos={combos}
              renderCheck={(c) => (
                <ComboCheck
                  comboId={c.id}
                  placed={c.placed}
                  label={`Plassert: ${c.legs.map((l) => `${l.home}–${l.away}`).join(" + ")}`}
                />
              )}
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
