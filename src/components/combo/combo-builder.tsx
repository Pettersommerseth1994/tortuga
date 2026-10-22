"use client"

import { keepPreviousData, useQueries } from "@tanstack/react-query"
import { useMemo, useState, useTransition } from "react"
import { InfoIcon, Loader2Icon, LockIcon, TriangleAlertIcon } from "lucide-react"
import { toast } from "sonner"

import { Amount } from "@/components/amount"
import type { Payload } from "@/components/match/live-match"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import { Button } from "@/components/ui/button"
import { formatKr, formatNumber, formatKickoff, parseOdds } from "@/lib/format"
import {
  bestSingles,
  buildCombos,
  comboKey,
  rankCombos,
  type Combo,
  type ComboLeg,
  type ComboSort,
  type LockCombosInput,
} from "@/lib/model/combos"
import { analysePreMatch } from "@/lib/model/prematch"
import { kellyPlan, stakePlan } from "@/lib/model/stakes"
import { loadDraft } from "@/lib/plan-draft"
import { cn } from "@/lib/utils"

export type ComboCandidate = { id: string; homeName: string; awayName: string; kickoff: string }
type Kind = "pre" | "ht"

const MAX_LEGS = 3
const TOP_OPTIONS = [5, 10, 15]

const pctText = (p: number) => `${formatNumber(p * 100, p < 0.01 ? 2 : 1)} %`

/** Verdi som forventet gevinst per krone, i prosent: positiv grønn, negativ rød. */
function ValuePct({ value }: { value: number }) {
  const pct = (value - 1) * 100
  const r = Math.round(pct * 10) / 10
  return (
    <span className={cn("tabular font-semibold", r > 0 && "text-green-700 dark:text-green-400", r < 0 && "text-bear")}>
      {r > 0 ? "+" : r < 0 ? "−" : ""}
      {formatNumber(Math.abs(pct), 1)} %
    </span>
  )
}

/**
 * Kombinasjoner av «riktig resultat» på tvers av kamper: velg to eller tre, så rangerer
 * Tortuga kombinasjonene og fordeler innsatsen. Bruker oddsene du allerede har lagt inn
 * (eller lest fra bilde) på hver kamp, og modellens sannsynligheter.
 */
export function ComboBuilder({
  matches,
  fetchPayload,
  renderMatchLink,
  onLock,
}: {
  matches: ComboCandidate[]
  fetchPayload: (id: string, opts: { h: number; a: number; remove: number; manual: boolean }) => Promise<Payload>
  renderMatchLink: (id: string, children: React.ReactNode) => React.ReactNode
  /** Lagrer kombinasjonene i sjekklisten (databasen lokalt, nettleserlagring på Pages). */
  onLock: (input: LockCombosInput) => Promise<{ ok: true } | { ok: false; error: string }>
}) {
  const [locking, startLock] = useTransition()
  const [selected, setSelected] = useState<string[]>(() => matches.slice(0, MAX_LEGS).map((m) => m.id))
  const [kind, setKind] = useState<Kind>("pre")
  const [sortBy, setSortBy] = useState<ComboSort>("value")
  const [topK, setTopK] = useState(10)
  const [budget, setBudget] = useState("500")
  const [strategy, setStrategy] = useState<"equal" | "kelly">("equal")
  const [kellyFraction, setKellyFraction] = useState(0.5)

  // Samme nøkkel som kampsiden, så ferdig hentede kamper gjenbrukes.
  const queries = useQueries({
    queries: selected.map((id) => ({
      queryKey: ["match", id, 0, 0, 4, false],
      queryFn: () => fetchPayload(id, { h: 0, a: 0, remove: 4, manual: false }),
      placeholderData: keepPreviousData,
      refetchInterval: 30_000,
    })),
  })

  // `queries` er en ny liste hver render; tidsstemplene sier når noe faktisk er hentet på nytt.
  const dataVersion = queries.map((q) => `${q.dataUpdatedAt}:${q.isError}`).join(",")

  const perMatch = useMemo(() => {
    return selected.map((id, i) => {
      const payload = queries[i]?.data
      const cand = matches.find((m) => m.id === id)
      if (!payload) return { id, cand, loading: !queries[i]?.isError, error: queries[i]?.isError ?? false, legs: [] as ComboLeg[], label: cand ? `${cand.homeName}–${cand.awayName}` : id, status: "" , usable: false, oddsCount: 0 }
      const { match, view } = payload
      const usable = kind === "pre" ? match.status === "scheduled" : match.status === "live" || match.status === "halftime"
      const draft = typeof window === "undefined" ? null : loadDraft(id, kind)
      const oddsMap = { ...(draft?.scanned ?? {}), ...(draft?.odds ?? {}) }
      const scenarios =
        kind === "pre"
          ? analysePreMatch({ home: match.home.shortName, away: match.away.shortName, prior: view.prior, keepCount: 25 }).scenarios
          : view.analysis.scenarios
      const legs: ComboLeg[] = usable
        ? scenarios.flatMap((s) => {
            const o = parseOdds(oddsMap[`${s.home}-${s.away}`] ?? "")
            return o ? [{ matchId: id, home: s.home, away: s.away, probability: s.probability, odds: o }] : []
          })
        : []
      return {
        id,
        cand,
        loading: false,
        error: false,
        legs,
        label: `${match.home.shortName}–${match.away.shortName}`,
        status: match.statusLabel,
        usable,
        oddsCount: Object.keys(oddsMap).length,
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, kind, matches, dataVersion])

  const ready = perMatch.length >= 2 && perMatch.every((m) => m.legs.length > 0)
  const legsPerMatch = useMemo(() => perMatch.map((m) => m.legs), [perMatch])
  const combos = useMemo(() => (ready ? buildCombos(legsPerMatch) : []), [ready, legsPerMatch])
  const ranked = useMemo(() => rankCombos(combos, sortBy, topK), [combos, sortBy, topK])
  const bestByValue = useMemo(() => rankCombos(combos, "value", 1)[0] as Combo | undefined, [combos])
  const singles = useMemo(() => (ready ? bestSingles(legsPerMatch) : []), [ready, legsPerMatch])
  const bestSingle = singles.reduce<(typeof singles)[number] | null>((b, s) => (!b || s.value > b.value ? s : b), null)

  const budgetNum = Number.parseInt(budget, 10)
  const plan = useMemo(() => {
    if (!ready || !(budgetNum > 0) || ranked.length === 0) return null
    const legs = ranked.map((c) => ({ key: comboKey(c), probability: c.probability, odds: c.odds }))
    return strategy === "kelly" ? kellyPlan(legs, budgetNum, kellyFraction) : stakePlan(legs, budgetNum)
  }, [ready, budgetNum, ranked, strategy, kellyFraction])
  const rowFor = (c: Combo) => plan?.rows.find((r) => r.key === comboKey(c))
  const stakedCombos = ranked.filter((c) => (rowFor(c)?.stake ?? 0) > 0)

  const labelOf = (id: string) => perMatch.find((m) => m.id === id)?.label ?? id

  function toggle(id: string) {
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= MAX_LEGS ? cur : [...cur, id]))
  }

  function lock() {
    startLock(async () => {
      const res = await onLock({
        kind,
        combos: stakedCombos.map((c) => ({
          legs: c.legs.map((l) => {
            const cand = matches.find((m) => m.id === l.matchId)
            return {
              eventId: l.matchId,
              homeName: cand?.homeName ?? "",
              awayName: cand?.awayName ?? "",
              home: l.home,
              away: l.away,
            }
          }),
          probability: c.probability,
          odds: c.odds,
          stake: rowFor(c)!.stake,
        })),
      })
      if (!res.ok) toast.error(res.error)
      else toast.success("Kombinasjonene er låst — se sjekklisten.")
    })
  }

  function copy() {
    const lines = stakedCombos.map((c) => {
      const r = rowFor(c)!
      return `${c.legs.map((l) => `${labelOf(l.matchId)} ${l.home}–${l.away}`).join(" + ")} @ ${formatNumber(c.odds)} — ${formatKr(r.stake)}`
    })
    void navigator.clipboard.writeText(`Tortuga · ${selected.length === 2 ? "dobbel" : "trippel"}, riktig resultat\n${lines.join("\n")}`)
  }

  const exampleCombo = bestByValue ?? ranked[0]

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Kombinasjoner</h1>
        <p className="text-sm text-muted-foreground">
          Dobbel eller trippel på riktig resultat: ett resultat per kamp, og alle må treffe.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <InfoIcon className="size-4" /> Økes oddsen?
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm">
          <p>
            <strong>Ja, oddsen ganges.</strong> Men det gjør sannsynligheten også, og bookmakerens margin
            med dem. Du får mye høyere odds, men treffer mye sjeldnere, og marginen vokser med hvert
            ben.
          </p>
          <ul className="grid list-disc gap-1 pl-5 text-muted-foreground">
            <li>Odds: 8,00 × 7,65 = 61,20.</li>
            <li>Sannsynlighet: 12 % × 11 % ≈ 1,3 %.</li>
            <li>
              Verdi (sannsynlighet × odds, over 1 = positiv forventning) ganges også: 0,96 × 0,84 = 0,81. To
              ben litt under 1 gir en kombinasjon langt under 1.
            </li>
            <li>
              <strong className="text-foreground">Tommelregel:</strong> å legge til et ben forbedrer forventet verdi
              bare hvis benet selv har verdi over 1. Ellers er enkeltbetet bedre.
            </li>
          </ul>
          <p className="text-xs text-muted-foreground">
            Sjekk i Oddsen at «riktig resultat» faktisk kan kombineres på tvers av kamper. Det kan være
            begrensninger på enkelte markeder.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Velg kamper</CardTitle>
          <CardDescription>
            Velg to eller tre av kampene dine. Oddsene hentes fra det du har lagt inn eller lest fra bilde på
            hver kamp.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {matches.length < 2 && (
            <Alert>
              <InfoIcon />
              <AlertTitle>Du trenger minst to kamper</AlertTitle>
              <AlertDescription>
                Ta med to eller tre kamper på Kamper-siden, åpne hver og legg inn odds (eller les dem fra
                bilde), og kom tilbake hit.
              </AlertDescription>
            </Alert>
          )}

          <div className="grid gap-2">
            {matches.map((m) => {
              const pm = perMatch.find((p) => p.id === m.id)
              const on = selected.includes(m.id)
              return (
                <label key={m.id} className="flex cursor-pointer flex-wrap items-center gap-3 rounded-lg border px-3 py-2">
                  <input
                    type="checkbox"
                    className="size-4"
                    checked={on}
                    disabled={!on && selected.length >= MAX_LEGS}
                    onChange={() => toggle(m.id)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">
                      {m.homeName} – {m.awayName}
                    </span>
                    <span className="block text-xs text-muted-foreground">{formatKickoff(m.kickoff)}</span>
                  </span>
                  {on && pm && (
                    <span className="text-xs">
                      {pm.loading ? (
                        <span className="text-muted-foreground">Henter …</span>
                      ) : pm.error ? (
                        <span className="text-bear">Kunne ikke hente</span>
                      ) : !pm.usable ? (
                        <span className="text-bear">
                          {kind === "pre" ? "Har startet — ikke lenger før kamp" : "Ikke i gang — pauseodds gjelder først når kampen spilles"}
                        </span>
                      ) : pm.legs.length === 0 ? (
                        renderMatchLink(m.id, <span className="text-bear underline underline-offset-4">Ingen odds lagret — legg inn</span>)
                      ) : (
                        <Badge variant="secondary" className="tabular">
                          {pm.legs.length} resultater med odds
                        </Badge>
                      )}
                    </span>
                  )}
                </label>
              )
            })}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <fieldset className="grid gap-1.5">
              <Label>Spilletype</Label>
              <div className="flex gap-2" role="radiogroup" aria-label="Spilletype">
                {(
                  [
                    ["pre", "Før kamp"],
                    ["ht", "Ved pause"],
                  ] as const
                ).map(([v, label]) => (
                  <button
                    key={v}
                    type="button"
                    role="radio"
                    aria-checked={kind === v}
                    onClick={() => setKind(v)}
                    className={cn("rounded-md border px-3 py-1.5 text-sm font-medium transition-colors", kind === v ? "bg-primary text-primary-foreground" : "hover:bg-accent")}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset className="grid gap-1.5">
              <Label>Rangér etter</Label>
              <div className="flex gap-2" role="radiogroup" aria-label="Rangering">
                {(
                  [
                    ["value", "Best verdi"],
                    ["probability", "Mest sannsynlig"],
                  ] as const
                ).map(([v, label]) => (
                  <button
                    key={v}
                    type="button"
                    role="radio"
                    aria-checked={sortBy === v}
                    onClick={() => setSortBy(v)}
                    className={cn("rounded-md border px-3 py-1.5 text-sm font-medium transition-colors", sortBy === v ? "bg-primary text-primary-foreground" : "hover:bg-accent")}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>
        </CardContent>
      </Card>

      {ready && bestByValue && (
        <Alert variant={bestByValue.value >= 1 ? "default" : "destructive"}>
          {bestByValue.value >= 1 ? <InfoIcon /> : <TriangleAlertIcon />}
          <AlertTitle>
            {bestByValue.value >= 1
              ? `Beste ${selected.length === 2 ? "dobbel" : "trippel"} har positiv forventet verdi ifølge modellen`
              : `Ingen ${selected.length === 2 ? "dobbel" : "trippel"} har positiv forventet verdi`}
          </AlertTitle>
          <AlertDescription className="grid gap-1">
            <span>
              Beste kombinasjon:{" "}
              {bestByValue.legs.map((l) => `${labelOf(l.matchId)} ${l.home}–${l.away}`).join(" + ")}, odds{" "}
              {formatNumber(bestByValue.odds)}, sannsynlighet {pctText(bestByValue.probability)}, verdi{" "}
              <ValuePct value={bestByValue.value} />.
            </span>
            {bestSingle && (
              <span>
                Beste enkeltbet: {labelOf(bestSingle.matchId)} {bestSingle.home}–{bestSingle.away}, verdi{" "}
                <ValuePct value={bestSingle.value} />.{" "}
                {bestSingle.value >= bestByValue.value
                  ? "Enkeltbetet er bedre enn alle kombinasjonene. Kombinasjoner hjelper bare når hvert ben har verdi."
                  : "Kombinasjonen slår det beste enkeltbetet, fordi alle benene har verdi."}
              </span>
            )}
            {exampleCombo && (
              <span className="text-xs text-muted-foreground">
                Regnestykket for den beste: odds{" "}
                {exampleCombo.legs.map((l) => formatNumber(l.odds)).join(" × ")} = {formatNumber(exampleCombo.odds)};
                sannsynlighet {exampleCombo.legs.map((l) => pctText(l.probability)).join(" × ")} = {pctText(exampleCombo.probability)};
                verdi {exampleCombo.legs.map((l) => formatNumber(l.probability * l.odds)).join(" × ")} = {formatNumber(exampleCombo.value)}.
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}

      {ready && ranked.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Rangerte kombinasjoner</CardTitle>
            <CardDescription>
              {sortBy === "value" ? "Høyest verdi først" : "Høyest sannsynlighet først"}. Bare én kombinasjon kan
              treffe, så innsatsen fordeles som for enkeltbet.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="flex flex-wrap items-end gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="combo-budget">Budsjett (kr)</Label>
                <Input id="combo-budget" inputMode="numeric" className="w-32 tabular" value={budget} onChange={(e) => setBudget(e.target.value.replace(/\D/g, ""))} />
              </div>
              <div className="grid gap-1.5">
                <Label>Antall kombinasjoner</Label>
                <div className="flex gap-1.5">
                  {TOP_OPTIONS.map((n) => (
                    <button key={n} type="button" onClick={() => setTopK(n)} className={cn("tabular rounded-md border px-2.5 py-1.5 text-sm font-medium transition-colors", topK === n ? "bg-primary text-primary-foreground" : "hover:bg-accent")}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label>Fordeling</Label>
                <div className="flex gap-1.5" role="radiogroup" aria-label="Fordeling av innsatsen">
                  {(
                    [
                      ["equal", "Lik utbetaling"],
                      ["kelly", "Verdi (Kelly)"],
                    ] as const
                  ).map(([v, label]) => (
                    <button key={v} type="button" role="radio" aria-checked={strategy === v} onClick={() => setStrategy(v)} className={cn("rounded-md border px-3 py-1.5 text-sm font-medium transition-colors", strategy === v ? "bg-primary text-primary-foreground" : "hover:bg-accent")}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {strategy === "kelly" && (
                <div className="grid gap-1.5">
                  <Label>Andel av Kelly</Label>
                  <div className="flex gap-1.5">
                    {([0.25, 0.5, 1] as const).map((f) => (
                      <button key={f} type="button" onClick={() => setKellyFraction(f)} className={cn("tabular rounded-md border px-2.5 py-1.5 text-sm font-medium transition-colors", kellyFraction === f ? "bg-primary text-primary-foreground" : "hover:bg-accent")}>
                        {f === 1 ? "full" : f === 0.5 ? "½" : "¼"}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {plan?.noValue && (
              <Alert>
                <InfoIcon />
                <AlertDescription>
                  Kelly anbefaler å ikke spille noen av disse: ingen har verdi over 1. Velg «Lik utbetaling» hvis du
                  vil spille uansett, men det er et spill uten fordel ifølge modellen.
                </AlertDescription>
              </Alert>
            )}
            {plan?.tooSmall && (
              <Alert>
                <InfoIcon />
                <AlertDescription>
                  Det finnes verdi (best <ValuePct value={bestByValue?.value ?? 1} />), men Kelly-innsatsen blir under
                  1 kr fordi sannsynligheten er så lav. Kelly satser nesten ingenting på lange skudd, selv med fordel.
                  Det er riktig matematikk, men ikke noe å spille for. Velg «Lik utbetaling» hvis du vil spille uansett.
                </AlertDescription>
              </Alert>
            )}

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kombinasjon</TableHead>
                  <TableHead className="text-right">Odds</TableHead>
                  <TableHead className="text-right">Sannsynlighet</TableHead>
                  <TableHead className="text-right">Verdi</TableHead>
                  <TableHead className="text-right">Innsats</TableHead>
                  <TableHead className="text-right">Utbetaling</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ranked.map((c) => {
                  const r = rowFor(c)
                  return (
                    <TableRow key={comboKey(c)}>
                      <TableCell>
                        <div className="grid gap-0.5">
                          {c.legs.map((l) => (
                            <span key={l.matchId} className="text-sm">
                              <span className="text-muted-foreground">{labelOf(l.matchId)}</span>{" "}
                              <span className="tabular font-semibold">
                                {l.home}–{l.away}
                              </span>
                            </span>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="tabular text-right">{formatNumber(c.odds)}</TableCell>
                      <TableCell className="tabular text-right">{pctText(c.probability)}</TableCell>
                      <TableCell className="text-right">
                        <ValuePct value={c.value} />
                      </TableCell>
                      <TableCell className={cn("tabular text-right", r && r.stake === 0 && "text-muted-foreground")}>
                        {r && r.stake > 0 ? formatKr(r.stake) : "–"}
                      </TableCell>
                      <TableCell className="tabular text-right">{r?.payout != null ? formatKr(r.payout) : "–"}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>

            {plan && stakedCombos.length > 0 && plan.expectedNet !== null && (
              <div className="grid gap-1.5 rounded-lg border p-3 text-sm">
                <p>
                  Total innsats <span className="tabular font-medium">{formatKr(plan.totalStake)}</span>. Forventet
                  resultat, i snitt over mange: <Amount value={plan.expectedNet} />
                </p>
                <p>
                  Treffer en av dem ({pctText(stakedCombos.reduce((s, c) => s + c.probability, 0))} ifølge modellen):{" "}
                  <Amount value={Math.min(...stakedCombos.map((c) => rowFor(c)?.payout ?? 0)) - plan.totalStake} />
                  {" "}til{" "}
                  <Amount value={Math.max(...stakedCombos.map((c) => rowFor(c)?.payout ?? 0)) - plan.totalStake} />
                </p>
                <p>
                  Treffer ingen ({pctText(1 - stakedCombos.reduce((s, c) => s + c.probability, 0))}):{" "}
                  <Amount value={-plan.totalStake} />
                </p>
                <p className="text-xs text-muted-foreground">
                  Kombinasjoner treffer sjelden. Sannsynligheten for at <em>noen</em> av dem treffer er lav selv
                  med mange, så et tap er det vanlige utfallet.
                </p>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={lock} disabled={stakedCombos.length === 0 || locking}>
                {locking ? <Loader2Icon className="animate-spin" /> : <LockIcon />}
                Lås kombinasjonene → sjekkliste
              </Button>
              <Button type="button" variant="outline" onClick={copy} disabled={stakedCombos.length === 0}>
                Kopier
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Låser de {stakedCombos.length} kombinasjonene med innsats. Plasserte kombinasjoner røres ikke ved ny
              låsing; resten av samme kamper erstattes.
            </p>
          </CardContent>
        </Card>
      )}

      {selected.length >= 2 && !ready && perMatch.every((m) => !m.loading) && (
        <Alert>
          <InfoIcon />
          <AlertTitle>Mangler odds</AlertTitle>
          <AlertDescription>
            Hver valgt kamp må ha odds for «{kind === "pre" ? "Før kamp" : "Ved pause"}». Åpne kampene som er merket
            rødt over og legg inn odds eller les dem fra bilde. De lagres automatisk.
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
