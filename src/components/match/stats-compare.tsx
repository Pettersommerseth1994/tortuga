import type { StatPair } from "@/lib/football/types"
import { formatNumber } from "@/lib/format"

/** Side-ved-side-søyler for lagstatistikk. Hjemme til venstre, borte til høyre. */
export function StatsCompare({
  stats,
  home,
  away,
}: {
  stats: StatPair[]
  home: string
  away: string
}) {
  // Før avspark leverer ESPN alle tallene som null — da er det ingenting å vise.
  if (stats.length === 0 || stats.every((s) => s.home + s.away === 0)) {
    return (
      <p className="text-sm text-muted-foreground">
        Statistikk er tilgjengelig fra avspark.
      </p>
    )
  }

  return (
    <div className="grid gap-3">
      <div className="flex justify-between text-xs font-medium">
        <span>{home}</span>
        <span>{away}</span>
      </div>
      {stats.map((s) => {
        const total = s.home + s.away
        const hp = total === 0 ? 50 : (s.home / total) * 100
        return (
          <div key={s.key} className="grid gap-1">
            <div className="tabular flex items-center justify-between text-sm">
              <span className="font-medium">
                {s.percent ? formatNumber(s.home, 0) : s.home}
                {s.percent ? " %" : ""}
              </span>
              <span className="text-xs text-muted-foreground">{s.label}</span>
              <span className="font-medium">
                {s.percent ? formatNumber(s.away, 0) : s.away}
                {s.percent ? " %" : ""}
              </span>
            </div>
            <div className="flex h-1.5 gap-0.5 overflow-hidden rounded-full">
              <div className="rounded-l-full bg-brand" style={{ width: `${hp}%` }} />
              <div className="rounded-r-full bg-brand-light/60" style={{ width: `${100 - hp}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
