import { ExternalLinkIcon } from "lucide-react"
import { Link } from "react-router"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatKickoff, formatKr, formatNumber, formatProb } from "@/lib/format"

import { setPlaced, useTracked } from "../lib/store"

const ODDSEN_URL = "https://www.norsk-tipping.no/sport/oddsen"

export function Checklist() {
  const tracked = useTracked()
  const allBets = tracked.flatMap((t) => t.bets)
  const open = allBets.filter((b) => !b.placed)
  const openStake = open.reduce((s, b) => s + (b.stake ?? 0), 0)

  return (
    <div className="flex flex-col gap-6">
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
            <Link to="/" className="underline underline-offset-4">
              Velg opptil tre på Kamper-siden
            </Link>
            .
          </AlertDescription>
        </Alert>
      )}

      {tracked.map((t) => {
        const stake = t.bets.reduce((s, b) => s + (b.stake ?? 0), 0)
        return (
          <Card key={t.eventId}>
            <CardHeader>
              <CardTitle>
                <Link to={`/kamp/${t.eventId}`} className="hover:underline">
                  {t.homeName} – {t.awayName}
                </Link>
              </CardTitle>
              <CardDescription>
                {formatKickoff(t.kickoff)}
                {t.lockedScore ? ` · plan låst på stillingen ${t.lockedScore}` : ""}
                {stake > 0 ? ` · ${formatKr(stake)} totalt` : ""}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {t.bets.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Ingen plan ennå.{" "}
                  <Link to={`/kamp/${t.eventId}`} className="underline underline-offset-4">
                    Lag og lås en plan
                  </Link>{" "}
                  — helst i pausen.
                </p>
              ) : (
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
                    {t.bets.map((b) => (
                      <TableRow key={`${b.homeGoals}-${b.awayGoals}`}>
                        <TableCell className="tabular font-semibold">
                          {t.homeName} {b.homeGoals}–{b.awayGoals} {t.awayName}
                        </TableCell>
                        <TableCell className="tabular text-right">{formatProb(b.probability)}</TableCell>
                        <TableCell className="tabular text-right">{b.odds ? formatNumber(b.odds) : "–"}</TableCell>
                        <TableCell className="tabular text-right">
                          {b.stake != null ? formatKr(b.stake) : "–"}
                        </TableCell>
                        <TableCell>
                          <label className="flex cursor-pointer items-center gap-2">
                            <input
                              type="checkbox"
                              className="size-5 accent-[var(--bull)]"
                              checked={b.placed}
                              onChange={(e) => setPlaced(t.eventId, b.homeGoals, b.awayGoals, e.target.checked)}
                              aria-label={`Plassert: ${b.homeGoals}–${b.awayGoals}`}
                            />
                            <span className={b.placed ? "text-xs text-bull" : "text-xs text-muted-foreground"}>
                              {b.placed ? "Plassert" : "Ikke plassert"}
                            </span>
                          </label>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
