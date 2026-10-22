import { CheckIcon } from "lucide-react"

import type { Analysis } from "@/lib/model/analysis"
import { GRID } from "@/lib/model/analysis"
import { formatProb } from "@/lib/format"
import { cn } from "@/lib/utils"

/**
 * De ni scenarioene som 3×3-rutenett: rader = mål til for hjemmelaget, kolonner
 * = mål til for bortelaget. Grønn = behold, grå = stryk.
 */
export function ScenarioGrid({
  analysis,
  home,
  away,
  actual,
}: {
  analysis: Analysis
  home: string
  away: string
  /** Faktisk sluttresultat (kun ved gjennomgang av ferdig kamp). */
  actual?: { home: number; away: number }
}) {
  const cols = Array.from({ length: GRID + 1 }, (_, i) => i)
  const cell = (i: number, j: number) =>
    analysis.scenarios.find((s) => s.addHome === i && s.addAway === j)!

  return (
    <div className="grid gap-2">
      <div
        className="grid items-center gap-2"
        style={{ gridTemplateColumns: "auto repeat(3, minmax(0, 1fr))" }}
      >
        <div />
        {cols.map((j) => (
          <div key={j} className="text-center text-xs text-muted-foreground">
            {away} <span className="tabular font-medium text-foreground">+{j}</span>
          </div>
        ))}

        {cols.map((i) => (
          <Row key={i}>
            <div className="pr-1 text-right text-xs text-muted-foreground">
              {home} <span className="tabular font-medium text-foreground">+{i}</span>
            </div>
            {cols.map((j) => {
              const s = cell(i, j)
              const isActual = actual && actual.home === s.home && actual.away === s.away
              return (
                <div
                  key={j}
                  title={s.why}
                  className={cn(
                    "relative grid gap-0.5 rounded-lg border p-2 text-center transition-colors sm:p-3",
                    s.keep
                      ? "border-bull/40 bg-bull/10"
                      : "border-dashed bg-muted/40 text-muted-foreground",
                    isActual && "ring-2 ring-foreground"
                  )}
                >
                  <span className="tabular text-base font-semibold sm:text-lg">
                    {s.home}–{s.away}
                  </span>
                  <span className="tabular text-xs">{formatProb(s.probability)}</span>
                  <span
                    className={cn(
                      "text-[10px] font-medium tracking-wide uppercase",
                      s.keep ? "text-bull" : "text-muted-foreground"
                    )}
                  >
                    {s.keep ? `Behold #${s.rank}` : "Stryk"}
                  </span>
                  {isActual && (
                    <span className="absolute -top-2 -right-2 grid size-5 place-items-center rounded-full bg-foreground text-background">
                      <CheckIcon className="size-3" />
                    </span>
                  )}
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
