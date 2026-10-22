"use client"

import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { AlertCircleIcon, FlaskConicalIcon, InfoIcon, RadioIcon } from "lucide-react"

import type { MatchDetail } from "@/lib/football/types"
import { formatKickoff, formatNumber, formatProb } from "@/lib/format"
import type { MatchView } from "@/lib/match-view"
import type { Scenario } from "@/lib/model/analysis"
import { cn } from "@/lib/utils"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import type { BetKind } from "./plan-panel"
import { PreMatchSection } from "./prematch-section"
import { ScenarioGrid } from "./scenario-grid"
import { StatsCompare } from "./stats-compare"
import { TeamBadge } from "./team-badge"
import { TeamPanel } from "./team-panel"

export type Payload = { match: MatchDetail; view: MatchView }

const REMOVE_OPTIONS = [3, 4, 5]

function pollInterval(match: MatchDetail): number | false {
  if (match.status === "live" || match.status === "halftime") return 15_000
  if (match.status === "scheduled") {
    const msToKick = new Date(match.kickoff).getTime() - Date.now()
    return msToKick < 45 * 60_000 ? 30_000 : false
  }
  return false
}

/**
 * Kampvisningen: resultattavle, ni scenarioer, begrunnelse, statistikk og lag.
 * Datahenting og lagring av planen injiseres, slik at samme visning brukes både
 * av den lokale appen (serverdata, database) og av Pages-versjonen (direkte mot
 * ESPN, nettleserlagring).
 */
export function LiveMatch({
  id,
  initial,
  fetchPayload,
  renderPlan,
  lockedPreKeys,
}: {
  id: string
  /** Ferdig hentet data til første visning (server). Utelates på Pages. */
  initial?: Payload
  fetchPayload: (opts: { h: number; a: number; remove: number; manual: boolean }) => Promise<Payload>
  /** Resultatene i den låste førkampsplanen, så «rediger» åpner med dem valgt. */
  lockedPreKeys?: string[]
  /**
   * Betting-panelet. «pre» = sluttresultat før avspark (basis 0–0), «ht» = ved
   * pause (basis = stillingen). Får de valgte scenarioene.
   */
  renderPlan: (args: {
    kind: BetKind
    match: MatchDetail
    kept: Scenario[]
    basis: { home: number; away: number }
  }) => React.ReactNode
}) {
  const [sim, setSim] = useState({ h: 0, a: 0 })
  const [removeCount, setRemoveCount] = useState(4)
  // Skriv inn pausestillingen selv, også mens kampen pågår (feeden kan henge).
  const [manual, setManual] = useState(false)
  const [tab, setTab] = useState<string | null>(null)

  const initialKey = sim.h === 0 && sim.a === 0 && removeCount === 4 && !manual
  const { data, isFetching, isError } = useQuery<Payload>({
    queryKey: ["match", id, sim.h, sim.a, removeCount, manual],
    queryFn: () => fetchPayload({ h: sim.h, a: sim.a, remove: removeCount, manual }),
    initialData: initialKey ? initial : undefined,
    placeholderData: keepPreviousData,
    refetchInterval: (q) => (q.state.data ? pollInterval(q.state.data.match) : false),
  })

  if (!data) return <p className="text-sm text-muted-foreground">Henter kamp …</p>
  const { match, view } = data
  const { analysis } = view
  const isLive = match.status === "live" || match.status === "halftime"
  const started = match.status !== "scheduled"
  const kept = analysis.scenarios.filter((s) => s.keep)
  const actual = view.mode === "replay" ? { home: match.homeScore, away: match.awayScore } : undefined
  const actualKept = actual && kept.some((s) => s.home === actual.home && s.away === actual.away)
  const liveNow = match.status === "live" || match.status === "halftime"
  const activeTab = tab ?? (match.status === "scheduled" ? "pre" : "ht")

  return (
    <div className="flex flex-col gap-6">
      {/* ---------------------------------------------------- Resultattavle */}
      <Card className="gap-4 py-5">
        <CardContent className="grid gap-4 px-5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
            <span>
              {match.competition.name} · {formatKickoff(match.kickoff)}
              {match.venue ? ` · ${match.venue}` : ""}
            </span>
            {isLive ? (
              <Badge variant="bear" className="gap-1.5">
                <span className="size-1.5 animate-pulse rounded-full bg-bear" />
                Live · {match.statusLabel}
              </Badge>
            ) : (
              <Badge variant="secondary">{match.statusLabel}</Badge>
            )}
          </div>

          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <div className="flex flex-col items-center gap-2 text-center sm:flex-row sm:justify-end sm:text-right">
              <span className="order-2 text-sm font-semibold sm:order-1 sm:text-lg">{match.home.name}</span>
              <TeamLogo name={match.home.name} logo={match.home.logo} className="order-1 sm:order-2" />
            </div>
            <div className="tabular text-center text-4xl font-semibold sm:text-5xl">
              {started ? `${match.homeScore}–${match.awayScore}` : "–"}
              {match.halftime && (
                <div className="text-xs font-normal text-muted-foreground">
                  pause {match.halftime.home}–{match.halftime.away}
                </div>
              )}
            </div>
            <div className="flex flex-col items-center gap-2 text-center sm:flex-row sm:text-left">
              <TeamLogo name={match.away.name} logo={match.away.logo} />
              <span className="text-sm font-semibold sm:text-lg">{match.away.name}</span>
            </div>
          </div>

          {match.events.length > 0 && (
            <ul className="tabular flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {match.events.map((e, i) => (
                <li key={i} className={cn(e.type === "red" && "text-bear")}>
                  {e.minute} {e.type === "goal" ? "⚽" : e.type === "yellow" ? "🟨" : "🟥"} {e.text.replace(/\s+(Goal|Yellow Card|Red Card)\b.*$/i, "")}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="pre">Før kamp</TabsTrigger>
          <TabsTrigger value="ht">Ved pause</TabsTrigger>
        </TabsList>

        <TabsContent value="pre" className="mt-4">
          <PreMatchSection
            match={match}
            prior={view.prior}
            lockedKeys={lockedPreKeys}
            renderPlan={({ kept: preKept }) =>
              renderPlan({ kind: "pre", match, kept: preKept, basis: { home: 0, away: 0 } })
            }
          />
        </TabsContent>

        <TabsContent value="ht" className="mt-4 flex flex-col gap-6">
          <ModeBanner view={view} match={match} isFetching={isFetching} isError={isError} />

      {/* ----------------------------------------------- Scenarioer + plan */}
      <div className="grid gap-6 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader>
            <CardTitle>Ved pause: ni scenarioer</CardTitle>
            <CardDescription>
              Sluttresultat når hvert lag scorer 0, 1 eller 2 mål til fra{" "}
              <span className="tabular font-medium text-foreground">
                {view.basis.home}–{view.basis.away}
              </span>
              . Hold over en rute for begrunnelse.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            {liveNow && (
              <label className="flex w-fit cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={manual}
                  onChange={(e) => {
                    if (e.target.checked) setSim({ h: match.homeScore, a: match.awayScore })
                    setManual(e.target.checked)
                  }}
                />
                Skriv inn stillingen selv
                <span className="text-xs text-muted-foreground">
                  (live-stilling er {match.homeScore}–{match.awayScore})
                </span>
              </label>
            )}

            {(view.mode === "simulation" || manual) && (
              <div className="flex flex-wrap items-end gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="sim-h">
                    {manual ? "Stilling" : "Pausestilling (hva-om)"}: {match.home.shortName}
                  </Label>
                  <Input
                    id="sim-h"
                    type="number"
                    min={0}
                    max={9}
                    className="w-20 tabular"
                    value={sim.h}
                    onChange={(e) => setSim((s) => ({ ...s, h: clampInt(e.target.value) }))}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="sim-a">{match.away.shortName}</Label>
                  <Input
                    id="sim-a"
                    type="number"
                    min={0}
                    max={9}
                    className="w-20 tabular"
                    value={sim.a}
                    onChange={(e) => setSim((s) => ({ ...s, a: clampInt(e.target.value) }))}
                  />
                </div>
              </div>
            )}

            <ScenarioGrid
              analysis={analysis}
              home={match.home.shortName}
              away={match.away.shortName}
              actual={actual}
            />

            <div className="grid gap-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Sjanse for at sluttresultatet er blant de {kept.length} beholdte
                </span>
                <span className="tabular font-semibold">{formatProb(analysis.keptProbability)}</span>
              </div>
              <Progress value={analysis.keptProbability * 100} />
              <p className="text-xs text-muted-foreground">
                Alle ni dekker {formatProb(analysis.gridProbability)}; resten er scenarier med
                3+ mål til for ett av lagene.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">Stryk de</span>
              {REMOVE_OPTIONS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRemoveCount(n)}
                  className={cn(
                    "rounded-md border px-2.5 py-1 text-xs font-medium tabular transition-colors",
                    removeCount === n ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                  )}
                >
                  {n}
                </button>
              ))}
              <span className="text-muted-foreground">minst sannsynlige (standard 4 av 9)</span>
            </div>

            {actual && (
              <Alert variant={actualKept ? "default" : "destructive"}>
                <InfoIcon />
                <AlertTitle>
                  Sluttresultat {actual.home}–{actual.away} {actualKept ? "var blant de beholdte" : "ble strøket"}
                </AlertTitle>
                <AlertDescription>
                  Dette er kampens faktiske resultat mot hva modellen ville gitt ved pause. Én kamp
                  sier lite om modellen — det er sånn det går over mange.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Betting-plan ved pause</CardTitle>
            <CardDescription>
              Riktig resultat (sluttresultat) på de {kept.length} beholdte.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {renderPlan({ kind: "ht", match, kept, basis: view.basis })}
          </CardContent>
        </Card>
      </div>

      {/* ----------------------------------------------------- Begrunnelse */}
      <Card>
        <CardHeader>
          <CardTitle>Hvorfor disse?</CardTitle>
          <CardDescription>Faktorene modellen har lagt til grunn.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          <ul className="grid gap-2 text-sm">
            {analysis.factors.map((f, i) => (
              <li key={i} className="flex gap-2">
                <span
                  aria-hidden
                  className={cn(
                    "mt-1.5 size-1.5 shrink-0 rounded-full",
                    f.tone === "home" ? "bg-brand" : f.tone === "away" ? "bg-brand-light" : "bg-muted-foreground/50"
                  )}
                />
                {f.text}
              </li>
            ))}
          </ul>

          <div className="grid gap-1.5 sm:grid-cols-2">
            {[...analysis.scenarios]
              .sort((a, b) => a.rank - b.rank)
              .map((s) => (
                <p
                  key={`${s.home}-${s.away}`}
                  className={cn(
                    "rounded-md border px-3 py-2 text-xs",
                    s.keep ? "border-bull/30" : "border-dashed text-muted-foreground"
                  )}
                >
                  <span className="tabular mr-1 font-semibold text-foreground">
                    {s.home}–{s.away}
                  </span>
                  {s.why}
                </p>
              ))}
          </div>
        </CardContent>
      </Card>
        </TabsContent>
      </Tabs>

      {/* ------------------------------------------------ Statistikk og lag */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Kampstatistikk</CardTitle>
            <CardDescription>
              {analysis.xg
                ? `xG-proxy: ${formatNumber(analysis.xg.home)} – ${formatNumber(analysis.xg.away)}`
                : "Hittil i kampen"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <StatsCompare stats={match.stats} home={match.home.shortName} away={match.away.shortName} />
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:col-span-2 lg:grid-cols-2">
          <TeamPanel team={match.homeTeam} />
          <TeamPanel team={match.awayTeam} />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Forhåndsvurdering</CardTitle>
          <CardDescription>{view.prior.detail}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            {(
              [
                [match.home.shortName, view.prior.probs.home],
                ["Uavgjort", view.prior.probs.draw],
                [match.away.shortName, view.prior.probs.away],
              ] as const
            ).map(([label, p]) => (
              <div key={label} className="grid gap-1">
                <div className="flex justify-between text-sm">
                  <span>{label}</span>
                  <span className="tabular font-medium">{formatProb(p)}</span>
                </div>
                <Progress value={p * 100} />
              </div>
            ))}
          </div>
          <dl className="tabular grid content-start gap-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Forventede mål, hele kampen</dt>
              <dd className="font-medium">
                {formatNumber(view.prior.home)} – {formatNumber(view.prior.away)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Forventede mål igjen nå</dt>
              <dd className="font-medium">
                {formatNumber(analysis.remaining.home)} – {formatNumber(analysis.remaining.away)}
              </dd>
            </div>
            {match.odds && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{match.odds.provider} (H-U-B)</dt>
                <dd className="font-medium">
                  {formatNumber(match.odds.home)} · {formatNumber(match.odds.draw)} · {formatNumber(match.odds.away)}
                </dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>
    </div>
  )
}

function clampInt(v: string) {
  const n = Number.parseInt(v, 10)
  return Number.isFinite(n) ? Math.min(9, Math.max(0, n)) : 0
}

function TeamLogo({ name, logo, className }: { name: string; logo?: string; className?: string }) {
  return (
    <span className={className}>
      <TeamBadge name="" logo={logo} size={48} className="[&>span:last-child]:hidden" />
      <span className="sr-only">{name}</span>
    </span>
  )
}

function ModeBanner({
  view,
  match,
  isFetching,
  isError,
}: {
  view: MatchView
  match: MatchDetail
  isFetching: boolean
  isError: boolean
}) {
  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertCircleIcon />
        <AlertTitle>Mistet kontakten med dataleverandøren</AlertTitle>
        <AlertDescription>Viser siste kjente tall. Prøver igjen automatisk.</AlertDescription>
      </Alert>
    )
  }

  if (view.manual) {
    return (
      <Alert>
        <RadioIcon />
        <AlertTitle className="flex items-center gap-2">
          Stilling tastet inn for hånd
          {isFetching && <span className="text-xs font-normal text-muted-foreground">oppdaterer …</span>}
        </AlertTitle>
        <AlertDescription>
          Analysen bruker stillingen du skrev inn og live-statistikken. Skru av valget for å følge
          live-stillingen igjen.
        </AlertDescription>
      </Alert>
    )
  }

  const copy = {
    halftime: {
      icon: <RadioIcon />,
      title: "Pause — dette er øyeblikket",
      text: "Analysen bygger på stillingen og førsteomgangsstatistikken nå.",
    },
    live: {
      icon: <RadioIcon />,
      title: `Live · ${match.statusLabel}`,
      text: "Analysen oppdateres hvert 15. sekund. Tid igjen er tatt med i regnestykket.",
    },
    simulation: {
      icon: <FlaskConicalIcon />,
      title: "Hva-om-simulering",
      text: "Kampen har ikke startet. Velg en pausestilling nedenfor for å se hvordan planen ville sett ut. Uten førsteomgangsstatistikk er dette basert på forhåndsvurderingen alene.",
    },
    replay: {
      icon: <FlaskConicalIcon />,
      title: "Gjennomgang av ferdig kamp",
      text: "Modellen er kjørt på pausestillingen (uten statistikk, siden den vi har er fra hele kampen) for å se om sluttresultatet var blant de beholdte.",
    },
  }[view.mode]

  return (
    <Alert>
      {copy.icon}
      <AlertTitle className="flex items-center gap-2">
        {copy.title}
        {isFetching && <span className="text-xs font-normal text-muted-foreground">oppdaterer …</span>}
      </AlertTitle>
      <AlertDescription>{copy.text}</AlertDescription>
    </Alert>
  )
}
