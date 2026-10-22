"use client"

import { useState } from "react"
import { AlertCircleIcon } from "lucide-react"

import { COMPETITIONS } from "@/lib/football/espn"
import { hasNorwegianTeam } from "@/lib/football/norway"
import type { MatchSummary } from "@/lib/football/types"
import { dayKey, formatDay } from "@/lib/format"
import { cn } from "@/lib/utils"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

/**
 * Kamplisten: turneringsfilter, «Norske lag», live, kommende og nylig ferdige.
 * Radene (og handlingsknappen på dem) lages av den som bruker komponenten.
 */
export function MatchSections({
  matches,
  renderRow,
  error,
  loading,
}: {
  matches: MatchSummary[]
  renderRow: (m: MatchSummary) => React.ReactNode
  error?: string | null
  loading?: boolean
}) {
  const [filter, setFilter] = useState<string>("all")

  const shown = filter === "all" ? matches : matches.filter((m) => m.competition.slug === filter)
  const live = shown.filter((m) => m.status === "live" || m.status === "halftime")
  const upcoming = shown.filter((m) => m.status === "scheduled")
  const finished = shown.filter((m) => m.status === "finished").reverse()

  // Norske lag: pågående og kommende først, deretter nylig ferdige.
  const norwegian = [
    ...live.filter(hasNorwegianTeam),
    ...upcoming.filter(hasNorwegianTeam),
    ...finished.filter(hasNorwegianTeam),
  ]

  const upcomingByDay = new Map<string, MatchSummary[]>()
  for (const m of upcoming) {
    const k = dayKey(m.kickoff)
    upcomingByDay.set(k, [...(upcomingByDay.get(k) ?? []), m])
  }

  const countFor = (slug: string) =>
    matches.filter((m) => m.competition.slug === slug && m.status !== "finished").length

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Turnering">
        {[{ slug: "all", name: "Alle", short: "" }, ...COMPETITIONS].map((c) => (
          <button
            key={c.slug}
            type="button"
            role="tab"
            aria-selected={filter === c.slug}
            onClick={() => setFilter(c.slug)}
            className={cn(
              "rounded-full border px-3 py-1 text-sm font-medium transition-colors",
              filter === c.slug ? "bg-primary text-primary-foreground" : "hover:bg-accent"
            )}
          >
            {c.name}
            {c.slug !== "all" && (
              <span className="tabular ml-1.5 text-xs opacity-70">{countFor(c.slug)}</span>
            )}
          </button>
        ))}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertTitle>Kunne ikke hente kamper</AlertTitle>
          <AlertDescription>
            Dataleverandøren svarte ikke ({error}). Prøver igjen automatisk.
          </AlertDescription>
        </Alert>
      )}

      <section className="flex flex-col gap-3 rounded-xl border border-brand/30 bg-brand/5 p-4">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-medium tracking-wide uppercase">
            <span aria-hidden>🇳🇴</span> Norske lag
          </h2>
          <p className="text-xs text-muted-foreground">
            Kamper der et norsk lag spiller, i alle turneringene over.
          </p>
        </div>
        {norwegian.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {loading
              ? "Henter kamper …"
              : "Ingen kamper med norske lag de neste ukene i valgt turnering."}
          </p>
        ) : (
          <div className="grid gap-2">
            {norwegian.map((m) => (
              <div key={m.id}>{renderRow(m)}</div>
            ))}
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
              <div key={m.id}>{renderRow(m)}</div>
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
            {loading ? "Henter kamper …" : "Ingen kommende kamper de neste tre ukene."}
          </p>
        )}
        {[...upcomingByDay.entries()].map(([day, list]) => (
          <div key={day} className="flex flex-col gap-2">
            <h3 className="text-sm font-medium capitalize">{formatDay(list[0].kickoff)}</h3>
            <div className="grid gap-2">
              {list.map((m) => (
                <div key={m.id}>{renderRow(m)}</div>
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
              <div key={m.id}>{renderRow(m)}</div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
