"use client"

import { useMemo, useState } from "react"
import { InfoIcon, RotateCcwIcon } from "lucide-react"

import type { MatchDetail } from "@/lib/football/types"
import { formatProb } from "@/lib/format"
import type { Scenario } from "@/lib/model/analysis"
import { analysePreMatch } from "@/lib/model/prematch"
import type { Prior } from "@/lib/model/prior"
import { cn } from "@/lib/utils"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"

import { ScenarioGrid } from "./scenario-grid"

const KEEP_OPTIONS = [5, 7, 9, 12]
const DEFAULT_KEEP = 9
const key = (s: { home: number; away: number }) => `${s.home}-${s.away}`

/**
 * Spill før avspark: sluttresultat fra 0–0. Du plasserer dem og er ferdig —
 * ingen oppfølging underveis. Modellen foreslår de mest sannsynlige, men hver
 * rute kan slås av og på for hånd.
 */
export function PreMatchSection({
  match,
  prior,
  lockedKeys,
  renderPlan,
}: {
  match: MatchDetail
  prior: Prior
  /** Resultatene i den låste førkampsplanen («1-0», …). Åpner du kampen igjen, er de valgt fra start. */
  lockedKeys?: string[]
  renderPlan: (args: { kept: Scenario[] }) => React.ReactNode
}) {
  const [keepCount, setKeepCount] = useState(DEFAULT_KEEP)
  // Bare avvik fra modellens valg lagres; endrer du antall, nullstilles de. Med en låst plan
  // starter vi fra den, slik at «rediger» viser det du faktisk låste.
  const [override, setOverride] = useState<Record<string, boolean>>(() => {
    if (!lockedKeys || lockedKeys.length === 0) return {}
    const locked = new Set(lockedKeys)
    const model = analysePreMatch({
      home: match.home.shortName,
      away: match.away.shortName,
      prior,
      keepCount: DEFAULT_KEEP,
    })
    return Object.fromEntries(
      model.scenarios.flatMap((s) => (locked.has(key(s)) !== s.keep ? [[key(s), locked.has(key(s))]] : []))
    )
  })

  const analysis = useMemo(
    () =>
      analysePreMatch({
        home: match.home.shortName,
        away: match.away.shortName,
        prior,
        keepCount,
      }),
    [match.home.shortName, match.away.shortName, prior, keepCount]
  )

  const isKept = (s: Scenario) => override[key(s)] ?? s.keep
  const kept = analysis.scenarios.filter(isKept)
  const keptProbability = kept.reduce((sum, s) => sum + s.probability, 0)
  const nothingStarted = match.status === "scheduled"
  const finished = match.status === "finished"
  const actual = finished ? { home: match.homeScore, away: match.awayScore } : undefined
  const actualKept = actual && kept.some((s) => s.home === actual.home && s.away === actual.away)
  const overridden = Object.keys(override).length

  const toggle = (s: Scenario) =>
    setOverride((o) => {
      const next = { ...o }
      const want = !isKept(s)
      if (want === s.keep) delete next[key(s)]
      else next[key(s)] = want
      return next
    })

  return (
    <div className="grid gap-6">
      {!nothingStarted && !finished && (
        <Alert variant="destructive">
          <InfoIcon />
          <AlertTitle>Kampen har startet</AlertTitle>
          <AlertDescription>
            Spill før avspark kan ikke lenger plasseres. Bruk «Ved pause» når første omgang er over.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader>
            <CardTitle>Sluttresultat før avspark</CardTitle>
            <CardDescription>
              Sannsynlighet for hvert sluttresultat fra 0–0 til 4–4. Klikk på en rute for å ta den
              med eller ut. Plasseres én gang, og du trenger ikke følge kampen.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            <ScenarioGrid
              analysis={analysis}
              home={match.home.shortName}
              away={match.away.shortName}
              mode="final"
              actual={actual}
              isKept={isKept}
              onToggle={nothingStarted ? toggle : undefined}
            />

            <div className="grid gap-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Sjanse for at sluttresultatet er blant de {kept.length} valgte
                </span>
                <span className="tabular font-semibold">{formatProb(keptProbability)}</span>
              </div>
              <Progress value={keptProbability * 100} />
              <p className="text-xs text-muted-foreground">
                Alle 25 ruter dekker {formatProb(analysis.gridProbability)}; resten er resultater
                med 5+ mål for ett av lagene.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">Velg de</span>
              {KEEP_OPTIONS.map((n) => (
                <button
                  key={n}
                  type="button"
                  disabled={!nothingStarted}
                  onClick={() => {
                    setKeepCount(n)
                    setOverride({})
                  }}
                  className={cn(
                    "rounded-md border px-2.5 py-1 text-xs font-medium tabular transition-colors disabled:opacity-50",
                    keepCount === n ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                  )}
                >
                  {n}
                </button>
              ))}
              <span className="text-muted-foreground">mest sannsynlige</span>
              {overridden > 0 && (
                <Button size="xs" variant="ghost" onClick={() => setOverride({})}>
                  <RotateCcwIcon /> Nullstill egne valg ({overridden})
                </Button>
              )}
            </div>

            {actual && (
              <Alert variant={actualKept ? "default" : "destructive"}>
                <InfoIcon />
                <AlertTitle>
                  Sluttresultat {actual.home}–{actual.away}{" "}
                  {actualKept ? "var blant de valgte" : "var ikke blant de valgte"}
                </AlertTitle>
                <AlertDescription>
                  Faktisk resultat mot hva modellen ville foreslått før avspark. Én kamp sier lite.
                </AlertDescription>
              </Alert>
            )}

            <ul className="grid gap-2 text-sm">
              {analysis.factors.map((f, i) => (
                <li key={i} className="flex gap-2">
                  <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-muted-foreground/50" />
                  {f.text}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Betting-plan før kamp</CardTitle>
            <CardDescription>Riktig sluttresultat på de {kept.length} valgte.</CardDescription>
          </CardHeader>
          <CardContent>{renderPlan({ kept })}</CardContent>
        </Card>
      </div>
    </div>
  )
}
