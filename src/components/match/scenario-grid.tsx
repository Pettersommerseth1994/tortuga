import { CheckIcon } from "lucide-react"

import type { Analysis, Scenario } from "@/lib/model/analysis"
import { formatProb } from "@/lib/format"
import { cn } from "@/lib/utils"

/**
 * Rutenett over sluttresultater: rader = hjemmelagets mål, kolonner = bortelagets.
 * Grønn = behold, grå = stryk.
 *
 *  - «add» (ved pause): 3×3 med mål *til* fra dagens stilling, «+0 … +2».
 *  - «final» (før kamp): 5×5 med sluttresultat fra 0–0.
 *
 * Med `onToggle` blir rutene klikkbare, så du kan overstyre modellens valg.
 */
export function ScenarioGrid({
  analysis,
  home,
  away,
  actual,
  mode = "add",
  isKept = (s) => s.keep,
  onToggle,
}: {
  analysis: Analysis
  home: string
  away: string
  /** Faktisk sluttresultat (kun ved gjennomgang av ferdig kamp). */
  actual?: { home: number; away: number }
  mode?: "add" | "final"
  isKept?: (s: Scenario) => boolean
  onToggle?: (s: Scenario) => void
}) {
  const size = Math.max(...analysis.scenarios.flatMap((s) => [s.addHome, s.addAway])) + 1
  const idx = Array.from({ length: size }, (_, i) => i)
  const cell = (i: number, j: number) =>
    analysis.scenarios.find((s) => s.addHome === i && s.addAway === j)!
  const compact = size > 3
  const label = (n: number) => (mode === "add" ? `+${n}` : String(n))

  return (
    <div className="grid gap-2">
      <div
        className="grid items-center gap-1.5 sm:gap-2"
        style={{ gridTemplateColumns: `auto repeat(${size}, minmax(0, 1fr))` }}
      >
        <div />
        {idx.map((j) => (
          <div key={j} className="text-center text-xs text-muted-foreground">
            <span className={cn(compact && "hidden sm:inline")}>{away} </span>
            <span className="tabular font-medium text-foreground">{label(j)}</span>
          </div>
        ))}

        {idx.map((i) => (
          <Row key={i}>
            <div className="pr-1 text-right text-xs text-muted-foreground">
              <span className={cn(compact && "hidden sm:inline")}>{home} </span>
              <span className="tabular font-medium text-foreground">{label(i)}</span>
            </div>
            {idx.map((j) => {
              const s = cell(i, j)
              const keep = isKept(s)
              const isActual = actual && actual.home === s.home && actual.away === s.away
              const className = cn(
                "relative grid gap-0.5 rounded-lg border text-center transition-colors",
                compact ? "p-1 sm:p-2" : "p-2 sm:p-3",
                keep
                  ? "border-bull/40 bg-bull/10"
                  : "border-dashed bg-muted/40 text-muted-foreground",
                onToggle && "cursor-pointer hover:border-foreground/40 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                isActual && "ring-2 ring-foreground"
              )
              const body = (
                <>
                  <span className={cn("tabular font-semibold", compact ? "text-sm sm:text-base" : "text-base sm:text-lg")}>
                    {s.home}–{s.away}
                  </span>
                  <span className="tabular text-xs">{formatProb(s.probability)}</span>
                  <span
                    className={cn(
                      "text-[10px] font-medium tracking-wide uppercase",
                      keep ? "text-bull" : "text-muted-foreground"
                    )}
                  >
                    {keep ? (compact ? "Med" : `Behold #${s.rank}`) : compact ? "Ut" : "Stryk"}
                  </span>
                  {isActual && (
                    <span className="absolute -top-2 -right-2 grid size-5 place-items-center rounded-full bg-foreground text-background">
                      <CheckIcon className="size-3" />
                    </span>
                  )}
                </>
              )
              return onToggle ? (
                <button
                  key={j}
                  type="button"
                  title={s.why}
                  aria-pressed={keep}
                  aria-label={`${s.home}–${s.away}, ${formatProb(s.probability)}, ${keep ? "med" : "ikke med"}`}
                  onClick={() => onToggle(s)}
                  className={className}
                >
                  {body}
                </button>
              ) : (
                <div key={j} title={s.why} className={className}>
                  {body}
                </div>
              )
            })}
          </Row>
        ))}
      </div>
    </div>
  )
}

/** Fragment med nøkkel — lar en rad bestå av flere direkte grid-barn. */
function Row({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
