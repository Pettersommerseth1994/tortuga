"use client"

import { useMemo, useState, useTransition } from "react"
import { ClipboardCopyIcon, ExternalLinkIcon, Loader2Icon, LockIcon } from "lucide-react"
import { toast } from "sonner"

import { formatKr, formatNumber, formatProb, parseOdds } from "@/lib/format"
import type { Scenario } from "@/lib/model/analysis"
import { stakePlan } from "@/lib/model/stakes"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export type BetKind = "pre" | "ht"

export type LockInput = {
  kind: BetKind
  score: string
  legs: {
    homeGoals: number
    awayGoals: number
    probability: number
    odds: number | null
    stake: number | null
  }[]
}

export type LockResult = { ok: true } | { ok: false; error: string }

export type TrackedState = {
  id: string
  lockedScore: string | null
  bets: { homeGoals: number; awayGoals: number; odds: number | null; stake: number | null; placed: boolean }[]
} | null

/** Alt vi vet om en tatt-med kamp: begge planene (før kamp og ved pause). */
export type TrackedAll = {
  id: string
  lockedScore: string | null
  preLocked: boolean
  bets: (NonNullable<TrackedState>["bets"][number] & { kind: BetKind })[]
} | null

/** Utsnittet av `TrackedAll` som gjelder én av planene. */
export function trackedForKind(t: TrackedAll, kind: BetKind): TrackedState {
  if (!t) return null
  return {
    id: t.id,
    lockedScore: kind === "pre" ? (t.preLocked ? "0-0" : null) : t.lockedScore,
    bets: t.bets.filter((b) => b.kind === kind),
  }
}

const ODDSEN_URL = "https://www.norsk-tipping.no/sport/oddsen"
const key = (s: { home: number; away: number }) => `${s.home}-${s.away}`

/**
 * Betting-planen: de beholdte scenarioene med innsatsfordeling. Odds legges inn
 * for hånd fra Oddsen — Tortuga har ikke tilgang til Norsk Tippings odds.
 */
export function PlanPanel({
  kind,
  kept,
  basisScore,
  tracked,
  trackSlot,
  trackHint,
  onLock,
  home,
  away,
  locked,
}: {
  /** «pre» = sluttresultat før avspark, «ht» = ved pause. */
  kind: BetKind
  kept: Scenario[]
  basisScore: { home: number; away: number }
  tracked: TrackedState
  /** Vises i stedet for «Lås plan» når kampen ikke er tatt med ennå. */
  trackSlot: React.ReactNode
  /** Forklaring under knappene når kampen ikke kan tas med. */
  trackHint?: string
  /** Lagrer planen (serveraksjon lokalt, nettleserlagring på Pages). */
  onLock: (input: LockInput) => Promise<LockResult>
  home: string
  away: string
  /** Planen kan ikke lenger låses (kampen har startet eller er ferdig). */
  locked: boolean
}) {
  const [pending, start] = useTransition()
  const [budget, setBudget] = useState("500")
  const [odds, setOdds] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      (tracked?.bets ?? [])
        .filter((b) => b.odds)
        .map((b) => [`${b.homeGoals}-${b.awayGoals}`, String(b.odds).replace(".", ",")])
    )
  )

  const sorted = useMemo(
    () => [...kept].sort((a, b) => b.probability - a.probability),
    [kept]
  )

  const budgetNum = Number.parseInt(budget, 10)
  const budgetOk = Number.isFinite(budgetNum) && budgetNum > 0

  const plan = useMemo(
    () =>
      budgetOk
        ? stakePlan(
            sorted.map((s) => ({
              key: key(s),
              probability: s.probability,
              odds: parseOdds(odds[key(s)] ?? ""),
            })),
            budgetNum
          )
        : null,
    [sorted, odds, budgetNum, budgetOk]
  )

  const rowFor = (s: Scenario) => plan?.rows.find((r) => r.key === key(s))

  const lockedElsewhere =
    tracked?.lockedScore && tracked.lockedScore !== key(basisScore)
      ? tracked.lockedScore
      : null

  function checklistText() {
    const lines = sorted.map((s) => {
      const r = rowFor(s)
      const o = parseOdds(odds[key(s)] ?? "")
      return `${home} ${s.home}–${s.away} ${away}${o ? ` @ ${formatNumber(o)}` : ""}${r ? ` — ${formatKr(r.stake)}` : ""}`
    })
    const head =
      kind === "pre"
        ? "Tortuga · riktig sluttresultat, før avspark"
        : `Tortuga · riktig sluttresultat, ved pause (stilling ${key(basisScore)})`
    return `${head}\n${lines.join("\n")}`
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(checklistText())
      toast.success("Sjekklisten er kopiert.")
    } catch {
      toast.error("Kunne ikke kopiere. Marker teksten manuelt.")
    }
  }

  function lock() {
    if (!tracked) return
    start(async () => {
      const res = await onLock({
        kind,
        score: key(basisScore),
        legs: sorted.map((s) => ({
          homeGoals: s.home,
          awayGoals: s.away,
          probability: s.probability,
          odds: parseOdds(odds[key(s)] ?? ""),
          stake: rowFor(s)?.stake ?? null,
        })),
      })
      if (!res.ok) toast.error(res.error)
      else toast.success("Planen er låst — se sjekklisten.")
    })
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-2 sm:max-w-xs">
        <Label htmlFor="budget">Totalbudsjett for kampen (kr)</Label>
        <Input
          id="budget"
          inputMode="numeric"
          value={budget}
          onChange={(e) => setBudget(e.target.value.replace(/\D/g, ""))}
        />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Sluttresultat</TableHead>
            <TableHead className="text-right">Modell</TableHead>
            <TableHead className="w-28">Odds (Oddsen)</TableHead>
            <TableHead className="text-right">Innsats</TableHead>
            <TableHead className="text-right">Utbetaling</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((s) => {
            const r = rowFor(s)
            const placed = tracked?.bets.find(
              (b) => b.homeGoals === s.home && b.awayGoals === s.away
            )?.placed
            return (
              <TableRow key={key(s)}>
                <TableCell className="tabular font-semibold">
                  {s.home}–{s.away}
                  {placed && (
                    <span className="ml-2 text-xs font-normal text-bull">plassert</span>
                  )}
                </TableCell>
                <TableCell className="tabular text-right">{formatProb(s.probability)}</TableCell>
                <TableCell>
                  <Input
                    aria-label={`Odds for ${s.home}–${s.away}`}
                    inputMode="decimal"
                    placeholder="f.eks. 9,5"
                    className="h-8 tabular"
                    value={odds[key(s)] ?? ""}
                    onChange={(e) =>
                      setOdds((o) => ({ ...o, [key(s)]: e.target.value.replace(/[^\d.,]/g, "") }))
                    }
                  />
                </TableCell>
                <TableCell className="tabular text-right">{r ? formatKr(r.stake) : "–"}</TableCell>
                <TableCell className="tabular text-right">
                  {r?.payout != null ? formatKr(r.payout) : "–"}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>

      {plan && (
        <div className="grid gap-2 text-sm">
          <p className="text-muted-foreground">
            Total innsats <span className="tabular font-medium text-foreground">{formatKr(plan.totalStake)}</span>
            {" · "}
            {plan.mode === "equal-return"
              ? "fordelt slik at alle treff gir omtrent lik utbetaling."
              : "fordelt etter modellens sannsynlighet. Legg inn odds for å fordele etter utbetaling."}
          </p>
          {plan.overround !== null && plan.overround >= 1 && (
            <Alert variant="destructive">
              <AlertDescription>
                Oddsene summerer til {formatNumber(plan.overround)} (1/odds). Over 1,00 betyr at
                selv et treff gir mindre tilbake enn du satte inn — du tar tap uansett utfall.
                Vurder å droppe noen av dem eller la være.
              </AlertDescription>
            </Alert>
          )}
          {plan.expectedNet !== null && plan.overround !== null && plan.overround < 1 && (
            <p className="text-muted-foreground">
              Hvis modellen har rett, er forventet resultat{" "}
              <span className="tabular font-medium text-foreground">
                {plan.expectedNet >= 0 ? "+" : "−"}
                {formatKr(Math.abs(plan.expectedNet))}
              </span>
              . Modellen er en enkel Poisson-modell — bokmakerne har mer informasjon enn den.
            </p>
          )}
        </div>
      )}

      {lockedElsewhere && (
        <Alert>
          <AlertDescription>
            Planen din er låst på stillingen {lockedElsewhere}, men analysen gjelder nå{" "}
            {key(basisScore)}. Lås på nytt for å erstatte de bettene du ikke har plassert.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap gap-2">
        {tracked ? (
          <Button onClick={lock} disabled={pending || locked}>
            {pending ? <Loader2Icon className="animate-spin" /> : <LockIcon />}
            {tracked.lockedScore ? "Lås plan på nytt" : "Lås plan → sjekkliste"}
          </Button>
        ) : (
          trackSlot
        )}
        <Button variant="outline" onClick={copy}>
          <ClipboardCopyIcon /> Kopier
        </Button>
        <Button variant="outline" asChild>
          <a href={ODDSEN_URL} target="_blank" rel="noreferrer">
            Åpne Oddsen <ExternalLinkIcon />
          </a>
        </Button>
      </div>
      {!tracked && trackHint && (
        <p className="text-xs text-muted-foreground">{trackHint}</p>
      )}
    </div>
  )
}
