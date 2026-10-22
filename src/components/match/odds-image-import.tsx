"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ImageUpIcon, Loader2Icon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"

type Summary = {
  found: number
  filled: number
  missing: string[]
  unresolved: number
  teams: "ok" | "swapped" | "unknown"
}

/**
 * Last opp (eller lim inn) ett eller flere skjermbilder av «riktig resultat» fra
 * Oddsen, så fylles oddsfeltene automatisk. Bildet leses i nettleseren og sendes
 * ikke noe sted. Resultatet vises slik at du kan kontrollere det: OCR kan ta feil.
 */
export function OddsImageImport({
  home,
  away,
  rowKeys,
  onImport,
}: {
  home: string
  away: string
  /** Resultatene i planen akkurat nå («2-1», …), for å vise hva som ble fylt. */
  rowKeys: string[]
  /** Alle leste odds, nøklet på «hjemme-borte», som tekst med komma. */
  onImport: (odds: Record<string, string>) => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [stage, setStage] = useState("")
  const [summary, setSummary] = useState<Summary | null>(null)

  const run = useCallback(
    async (files: File[]) => {
      const images = files.filter((f) => f.type.startsWith("image/"))
      if (images.length === 0) {
        toast.error("Det må være et bilde (skjermbilde fra Oddsen).")
        return
      }
      setBusy(true)
      setSummary(null)
      try {
        // Lastes først nå: tekstgjenkjenningen er stor og trengs sjelden.
        const { readOddsFromImages } = await import("@/lib/odds-ocr")
        const res = await readOddsFromImages(images, { home, away }, (s) => setStage(s))

        // Oddsen kan liste lagene i motsatt rekkefølge av ESPN; da snur vi resultatene.
        const flip = res.teams === "swapped"
        const map: Record<string, string> = {}
        for (const f of res.found) {
          const k = flip ? `${f.away}-${f.home}` : `${f.home}-${f.away}`
          map[k] = String(f.odds).replace(".", ",")
        }
        const filled = rowKeys.filter((k) => k in map).length
        setSummary({
          found: res.found.length,
          filled,
          missing: rowKeys.filter((k) => !(k in map)),
          unresolved: res.unresolved,
          teams: res.teams,
        })

        if (res.found.length === 0) {
          toast.error("Fant ingen odds i bildet. Bruk et skjermbilde som viser resultat og odds tydelig.")
        } else {
          onImport(map)
          toast.success(
            flip
              ? "Lagene stod i motsatt rekkefølge i bildet, så resultatene er snudd."
              : `Leste ${res.found.length} odds fra bildet.`
          )
        }
      } catch (e) {
        console.error("[odds-ocr]", e)
        toast.error("Kunne ikke lese bildet. Sjekk nettforbindelsen (tekstgjenkjenningen lastes ned første gang) og prøv igjen.")
      } finally {
        setBusy(false)
        setStage("")
        if (input.current) input.current.value = ""
      }
    },
    [home, away, rowKeys, onImport]
  )

  // Lim inn et skjermbilde direkte (Cmd/Ctrl+V).
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files = [...(e.clipboardData?.files ?? [])].filter((f) => f.type.startsWith("image/"))
      if (files.length > 0 && !busy) {
        e.preventDefault()
        void run(files)
      }
    }
    window.addEventListener("paste", onPaste)
    return () => window.removeEventListener("paste", onPaste)
  }, [run, busy])

  return (
    <div className="grid gap-2 rounded-lg border border-dashed p-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={input}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          id="odds-image"
          onChange={(e) => void run([...(e.target.files ?? [])])}
        />
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={busy}
          onClick={() => input.current?.click()}
        >
          {busy ? <Loader2Icon className="animate-spin" /> : <ImageUpIcon />}
          {busy ? stage || "Leser …" : "Les odds fra bilde"}
        </Button>
        <span className="text-xs text-muted-foreground">
          Last opp skjermbilder fra Oddsen eller lim inn med Cmd/Ctrl+V.
        </span>
      </div>

      {summary && (
        <div className="grid gap-1.5 text-xs">
          <p>
            Leste <span className="tabular font-medium">{summary.found}</span> odds · fylte{" "}
            <span className="tabular font-medium">
              {summary.filled} av {summary.filled + summary.missing.length}
            </span>{" "}
            rader.
          </p>
          {summary.missing.length > 0 && (
            <p className="text-bear">
              Mangler odds for {summary.missing.map((k) => k.replace("-", "–")).join(", ")}. Last opp
              flere bilder (scroll listen i Oddsen) eller skriv dem inn.
            </p>
          )}
          {summary.unresolved > 0 && (
            <p className="text-bear">
              {summary.unresolved} odds i bildet kunne ikke knyttes til et resultat og er hoppet over.
            </p>
          )}
          {summary.teams === "unknown" && (
            <p className="text-bear">
              Fant ikke lagnavnene i bildet. Sjekk at det er riktig kamp, og at resultatene står
              som {home}–{away}.
            </p>
          )}
          {summary.teams === "swapped" && (
            <p className="text-muted-foreground">
              Bildet har {away} først; resultatene er snudd til {home}–{away}.
            </p>
          )}
        </div>
      )}
      <p className="text-[11px] text-muted-foreground">
        Bildet leses i nettleseren din og sendes ikke noe sted. Tekstgjenkjenning kan ta feil — kontroller tallene.
      </p>
    </div>
  )
}
