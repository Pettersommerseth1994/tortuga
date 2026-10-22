import { formatKr, formatNumber } from "@/lib/format"
import type { ComboKind, LockedLeg } from "@/lib/model/combos"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export type ComboRow = {
  id: string
  kind: ComboKind
  legs: LockedLeg[]
  odds: number
  probability: number
  stake: number | null
  placed: boolean
}

const pctText = (p: number) => `${formatNumber(p * 100, p < 0.01 ? 2 : 1)} %`

/**
 * Kombinasjoner i sjekklisten, gruppert på settet med kamper. Selve avkryssingen lages av den
 * som bruker tabellen (databasen lokalt, nettleserlagring på Pages).
 */
export function ComboBetsTable({
  combos,
  renderCheck,
}: {
  combos: ComboRow[]
  renderCheck: (c: ComboRow) => React.ReactNode
}) {
  const groups = new Map<string, ComboRow[]>()
  for (const c of combos) {
    const k = `${c.kind}:${[...c.legs.map((l) => l.eventId)].sort().join("|")}`
    groups.set(k, [...(groups.get(k) ?? []), c])
  }

  return (
    <div className="grid gap-6">
      {[...groups.entries()].map(([k, rows]) => {
        const first = rows[0]
        const title = first.legs.map((l) => `${l.homeName}–${l.awayName}`).join(" + ")
        return (
          <div key={k} className="grid gap-2">
            <h3 className="text-sm font-medium">
              {first.legs.length === 2 ? "Dobbel" : "Trippel"} ·{" "}
              {first.kind === "pre" ? "før kamp" : "ved pause"} · {title}
            </h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kombinasjon</TableHead>
                  <TableHead className="text-right">Odds</TableHead>
                  <TableHead className="text-right">Sannsynlighet</TableHead>
                  <TableHead className="text-right">Innsats</TableHead>
                  <TableHead className="w-36">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="grid gap-0.5">
                        {c.legs.map((l) => (
                          <span key={l.eventId} className="text-sm">
                            <span className="text-muted-foreground">
                              {l.homeName}–{l.awayName}
                            </span>{" "}
                            <span className="tabular font-semibold">
                              {l.home}–{l.away}
                            </span>
                          </span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="tabular text-right">{formatNumber(c.odds)}</TableCell>
                    <TableCell className="tabular text-right">{pctText(c.probability)}</TableCell>
                    <TableCell className="tabular text-right">
                      {c.stake != null ? formatKr(c.stake) : "–"}
                    </TableCell>
                    <TableCell>{renderCheck(c)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )
      })}
    </div>
  )
}
