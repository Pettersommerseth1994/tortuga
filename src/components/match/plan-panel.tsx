"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { ClipboardCopyIcon, ExternalLinkIcon, Loader2Icon, LockIcon } from "lucide-react"
import { toast } from "sonner"

import { formatKr, formatNumber, formatProb, parseOdds } from "@/lib/format"
import type { Scenario } from "@/lib/model/analysis"
import { clearDraft, loadDraft, saveDraft } from "@/lib/plan-draft"
import { kellyPlan, stakePlan } from "@/lib/model/stakes"
import { cn } from "@/lib/utils"
import { OddsImageImport } from "./odds-image-import"
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
  eventId,
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
  /** Kampens ID hos dataleverandøren; utkastet (odds m.m.) lagres per kamp og spilletype. */
  eventId: string
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
  // «equal»: lik utbetaling (jevnest). «kelly»: verdi — bare der modellen ser en fordel.
  const [strategy, setStrategy] = useState<"equal" | "kelly">("equal")
  const [kellyFraction, setKellyFraction] = useState(0.5)
  const [odds, setOdds] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      (tracked?.bets ?? [])
        .filter((b) => b.odds)
        .map((b) => [`${b.homeGoals}-${b.awayGoals}`, String(b.odds).replace(".", ",")])
    )
  )

  // Odds lest fra bilde. Egne innskrivinger (`odds`) går foran, og lest odds
  // gjelder også resultater som tas med senere.
  const [scanned, setScanned] = useState<Record<string, string>>({})
  const oddsText = (s: Scenario) => odds[key(s)] ?? scanned[key(s)] ?? ""

  // Utkastet lastes etter første visning (ikke under serverrendering) og lagres ved hver endring,
  // så odds, budsjett og fordeling overlever faneskifte og omlasting.
  const [loaded, setLoaded] = useState(false)
  /* eslint-disable react-hooks/set-state-in-effect --
     Synkroniserer med localStorage etter hydrering; det kan ikke gjøres under rendering
     uten å gi ulik HTML på server og klient. */
  useEffect(() => {
    const d = loadDraft(eventId, kind)
    if (d) {
      setOdds((prev) => ({ ...prev, ...d.odds }))
      setScanned(d.scanned)
      setBudget(d.budget)
      setStrategy(d.strategy)
      setKellyFraction(d.kellyFraction)
    }
    setLoaded(true)
  }, [eventId, kind])
  /* eslint-enable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (loaded) saveDraft(eventId, kind, { odds, scanned, budget, strategy, kellyFraction })
  }, [loaded, eventId, kind, odds, scanned, budget, strategy, kellyFraction])

  const storedOdds = useMemo(() => {
    const all = { ...scanned, ...odds }
    return Object.entries(all)
      .filter(([, v]) => parseOdds(v) !== null)
      .sort(([a], [b]) => a.localeCompare(b))
  }, [odds, scanned])

  const sorted = useMemo(
    () => [...kept].sort((a, b) => b.probability - a.probability),
    [kept]
  )

  const budgetNum = Number.parseInt(budget, 10)
  const budgetOk = Number.isFinite(budgetNum) && budgetNum > 0

  const plan = useMemo(() => {
    if (!budgetOk) return null
    const legs = sorted.map((s) => ({
      key: key(s),
      probability: s.probability,
      odds: parseOdds(odds[key(s)] ?? scanned[key(s)] ?? ""),
    }))
    return strategy === "kelly" ? kellyPlan(legs, budgetNum, kellyFraction) : stakePlan(legs, budgetNum)
  }, [sorted, odds, scanned, budgetNum, budgetOk, strategy, kellyFraction])

  const rowFor = (s: Scenario) => plan?.rows.find((r) => r.key === key(s))

  // Bare resultater det faktisk satses på (Kelly kan sette innsatsen til 0).
  const staked = sorted.filter((s) => (rowFor(s)?.stake ?? 0) > 0)
  // Beste «modellens sannsynlighet × odds»; over 1 betyr at oddsen er høyere enn modellen tilsier.
  const bestValue = sorted.reduce(
    (best, s) => {
      const o = parseOdds(oddsText(s))
      const v = o ? s.probability * o : 0
      return v > best.v ? { v, label: `${s.home}–${s.away}` } : best
    },
    { v: 0, label: "" }
  )

  // Hva ett treff gir (utbetaling minus total innsats), og modellens sjanse for at noe treffer.
  const coverage = staked.reduce((sum, s) => sum + s.probability, 0)
  const payouts = staked.flatMap((s) => {
    const r = rowFor(s)
    return r?.payout == null ? [] : [r.payout]
  })
  const hitMin = payouts.length ? Math.min(...payouts) - (plan?.totalStake ?? 0) : 0
  const hitMax = payouts.length ? Math.max(...payouts) - (plan?.totalStake ?? 0) : 0

  const lockedElsewhere =
    tracked?.lockedScore && tracked.lockedScore !== key(basisScore)
      ? tracked.lockedScore
      : null

  function checklistText() {
    const lines = staked.map((s) => {
      const r = rowFor(s)
      const o = parseOdds(oddsText(s))
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
        legs: staked.map((s) => ({
          homeGoals: s.home,
          awayGoals: s.away,
          probability: s.probability,
          odds: parseOdds(oddsText(s)),
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

      <div className="grid gap-2">
        <Label>Fordeling av innsatsen</Label>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Fordeling av innsatsen">
          {(
            [
              ["equal", "Lik utbetaling"],
              ["kelly", "Verdi (Kelly)"],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={strategy === v}
              onClick={() => setStrategy(v)}
              className={cn(
                "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
                strategy === v ? "bg-primary text-primary-foreground" : "hover:bg-accent"
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {strategy === "kelly" ? (
          <div className="grid gap-2 text-xs text-muted-foreground">
            <p>
              Satser bare på resultater der modellens sannsynlighet × odds er høy nok, og mest der
              fordelen er størst. Budsjettet er taket; det som ikke trengs, beholdes. Krever odds.
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              <span>Andel av full Kelly:</span>
              {([0.25, 0.5, 1] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setKellyFraction(f)}
                  className={cn(
                    "rounded-md border px-2 py-0.5 text-xs font-medium tabular transition-colors",
                    kellyFraction === f ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                  )}
                >
                  {f === 1 ? "full" : f === 0.5 ? "½" : "¼"}
                </button>
              ))}
              <span>(½ anbefales: modellen kan ta feil)</span>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Alle treff gir omtrent lik utbetaling. Jevnest mulig, men tar ikke hensyn til hvilke odds som er gode.
          </p>
        )}
      </div>

      <OddsImageImport
        home={home}
        away={away}
        rowKeys={sorted.map(key)}
        onImport={(found) => {
          setScanned((prev) => ({ ...prev, ...found }))
          // Nylig lest odds skal gjelde, også over det som sto der fra før.
          setOdds((prev) => {
            const next = { ...prev }
            for (const k of Object.keys(found)) delete next[k]
            return next
          })
        }}
      />

      {storedOdds.length > 0 && (
        <div className="grid gap-1.5 text-xs text-muted-foreground">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>
              Odds for {storedOdds.length} resultater lagres automatisk for denne kampen i denne
              nettleseren.
            </span>
            <Button
              type="button"
              size="xs"
              variant="ghost"
              onClick={() => {
                setOdds({})
                setScanned({})
                clearDraft(eventId, kind)
              }}
            >
              Tøm odds
            </Button>
          </div>
          <details>
            <summary className="cursor-pointer">Vis lagrede odds</summary>
            <ul className="tabular mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
              {storedOdds.map(([k, v]) => (
                <li key={k}>
                  <span className="font-medium text-foreground">{k.replace("-", "–")}</span> {v}
                </li>
              ))}
            </ul>
          </details>
        </div>
      )}

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
                    value={oddsText(s)}
                    onChange={(e) =>
                      setOdds((o) => ({ ...o, [key(s)]: e.target.value.replace(/[^\d.,]/g, "") }))
                    }
                  />
                </TableCell>
                <TableCell className={cn("tabular text-right", r && r.stake === 0 && "text-muted-foreground")}>
                  {r && r.stake > 0 ? formatKr(r.stake) : "–"}
                </TableCell>
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
              : plan.mode === "kelly"
                ? `verdi-fordelt (${kellyFraction === 1 ? "full" : kellyFraction === 0.5 ? "halv" : "kvart"} Kelly); resten av budsjettet beholdes.`
                : "fordelt etter modellens sannsynlighet. Legg inn odds for å fordele etter utbetaling."}
          </p>
          {plan.noValue && (
            <Alert>
              <AlertDescription>
                {bestValue.v > 0 ? (
                  <>
                    Ingen av resultatene har positiv forventet verdi: modellens sannsynlighet × odds er
                    under 1 for alle (best er {bestValue.label} med {formatNumber(bestValue.v)}).
                    Kelly anbefaler derfor å ikke spille. Velg «Lik utbetaling» hvis du vil spille
                    uansett, men da er det et spill uten fordel ifølge modellen.
                  </>
                ) : (
                  <>Legg inn odds på resultatene (eller les dem fra bilde) for å beregne verdi-fordelingen.</>
                )}
              </AlertDescription>
            </Alert>
          )}
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
            <div className="grid gap-1.5 rounded-lg border p-3 text-foreground">
              <p>
                Forventet resultat, i snitt over mange kamper:{" "}
                <Amount value={plan.expectedNet} />
              </p>
              <p>
                Treffer ett av dem ({formatProb(coverage)} ifølge modellen):{" "}
                <Amount value={hitMin} />
                {hitMax - hitMin > 1 && (
                  <>
                    {" "}til <Amount value={hitMax} />
                  </>
                )}
              </p>
              <p>
                Treffer ingen ({formatProb(1 - coverage)}): <Amount value={-plan.totalStake} />
              </p>
              <p className="text-xs text-muted-foreground">
                Et minustall er et tap. «Forventet» veier gevinsten ved treff mot tapet ved bom, med
                modellens sannsynligheter. Modellen er en enkel Poisson-modell, og bokmakerne har mer
                informasjon enn den.
              </p>
            </div>
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
          <Button onClick={lock} disabled={pending || locked || staked.length === 0}>
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

/** Beløp med fortegn og farge: gevinst mørkegrønn med +, tap rød med minus. */
function Amount({ value }: { value: number }) {
  const v = Math.round(value)
  return (
    <span
      className={cn(
        "tabular font-semibold",
        v > 0 && "text-green-700 dark:text-green-400",
        v < 0 && "text-bear"
      )}
    >
      {v > 0 ? "+" : v < 0 ? "−" : ""}
      {formatKr(Math.abs(v))}
    </span>
  )
}
