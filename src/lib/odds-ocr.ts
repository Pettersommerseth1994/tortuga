/**
 * Leser odds for «riktig resultat» ut av skjermbilder fra Oddsen (Norsk Tipping).
 *
 * Alt skjer i nettleseren med tesseract.js — bildet sendes ikke noe sted. Oppsettet
 * er tre kolonner (hjemmeseier / uavgjort / borteseier) med en rute per resultat:
 * «1-0   13,00». Kolonnene gjør at vanlig tekstflyt blander radene, så vi
 * parer sammen resultat og odds etter plassering i bildet i stedet.
 *
 * Oddsene leses sikkert (tall med desimaler), men resultat-etikettene kan bli feil
 * på lys-blå bakgrunn («1-1» → «iil»). De som mangler leses derfor på nytt, rute for
 * rute, med bare sifre og bindestrek tillatt.
 */

export type OcrWord = {
  text: string
  x0: number
  y0: number
  x1: number
  y1: number
  confidence: number
}

export type FoundOdds = { home: number; away: number; odds: number }

const SCORE = /^(\d)\s*[-–—−]\s*(\d)$/
const ODDS = /^(\d{1,4})[.,](\d{2})$/

export function toOdds(text: string): number | null {
  const m = ODDS.exec(text.trim())
  if (!m) return null
  const v = Number.parseFloat(`${m[1]}.${m[2]}`)
  return v > 1 && v <= 1000 ? v : null
}

export function toScore(text: string): { home: number; away: number } | null {
  const m = SCORE.exec(text.trim())
  return m ? { home: Number(m[1]), away: Number(m[2]) } : null
}

const cy = (w: OcrWord) => (w.y0 + w.y1) / 2
const h = (w: OcrWord) => w.y1 - w.y0

/**
 * Parer resultat og odds fra ord med plassering. Hver odds hører til resultatet
 * på samme rad som ligger nærmest til venstre for den, uten at en annen odds
 * står imellom. Odds uten resultat returneres i `unresolved`, så de kan leses på nytt.
 */
export function pairOddsFromWords(words: OcrWord[]): {
  pairs: FoundOdds[]
  unresolved: OcrWord[]
} {
  const odds = words.filter((w) => toOdds(w.text) !== null)
  const scores = words.filter((w) => toScore(w.text) !== null)

  const pairs: FoundOdds[] = []
  const unresolved: OcrWord[] = []

  for (const o of odds) {
    const tol = Math.max(h(o), 12) * 0.8
    const sameRow = (w: OcrWord) => Math.abs(cy(w) - cy(o)) < tol

    // Nærmeste odds til venstre på samme rad setter venstregrensen for etiketten.
    const leftBound = Math.max(
      0,
      ...odds.filter((p) => p !== o && sameRow(p) && p.x1 <= o.x0).map((p) => p.x1)
    )

    const label = scores
      .filter((s) => sameRow(s) && s.x1 <= o.x0 && s.x0 >= leftBound)
      .sort((a, b) => b.x1 - a.x1)[0] // nærmest odds

    const sc = label ? toScore(label.text) : null
    if (sc) pairs.push({ ...sc, odds: toOdds(o.text)! })
    else unresolved.push(o)
  }

  return { pairs, unresolved }
}

/**
 * Les et resultat fra en enkelt rute selv når OCR har rotet med tegnene:
 * «1-1», «11» (bindestreken falt bort) og «iil» (bindestreken lest som «i», 1-ere
 * lest som «i»/«l»).
 */
export function parseLooseScore(text: string): { home: number; away: number } | null {
  const strict = toScore(text)
  if (strict) return strict

  const s = text.replace(/\s+/g, "")
  const digit = (c: string): number | null => {
    if (/\d/.test(c)) return Number(c)
    if ("iIl|!".includes(c)) return 1
    if ("oO".includes(c)) return 0
    return null
  }

  // Tre tegn med en bindestrek-lignende midt: «iil», «1l1», «1_1».
  if (s.length === 3 && "-–—−_iIl|!~.".includes(s[1])) {
    const a = digit(s[0]), b = digit(s[2])
    if (a !== null && b !== null) return { home: a, away: b }
  }
  // To tegn: bindestreken falt bort («11»).
  if (s.length === 2) {
    const a = digit(s[0]), b = digit(s[1])
    if (a !== null && b !== null) return { home: a, away: b }
  }
  return null
}

/**
 * Sjekker om de to lagnavnene finnes i teksten, og i hvilken rekkefølge. Brukes
 * til å fange feil kamp eller byttet hjemme/borte før oddsene fylles inn.
 */
export function checkTeams(
  text: string,
  home: string,
  away: string
): "ok" | "swapped" | "unknown" {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/ø/g, "o")
      .replace(/æ/g, "ae")
      .replace(/å/g, "a")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
  const hay = norm(text)
  const key = (name: string) => {
    const tokens = norm(name).split(" ").filter((t) => t.length >= 4)
    return tokens.sort((a, b) => b.length - a.length)[0]?.slice(0, 5)
  }
  const hk = key(home)
  const ak = key(away)
  const hi = hk ? hay.indexOf(hk) : -1
  const ai = ak ? hay.indexOf(ak) : -1
  if (hi < 0 || ai < 0) return "unknown"
  return hi < ai ? "ok" : "swapped"
}

// ----------------------------------------------------------------------------
// Selve leseren (nettleser / node). tesseract.js lastes først når den brukes.

export type OcrResult = {
  found: FoundOdds[]
  /** Odds funnet i bildet, men uten lesbart resultat ved siden av. */
  unresolved: number
  teams: "ok" | "swapped" | "unknown"
}

type Progress = (stage: string, fraction: number) => void

/**
 * Gjør alle bildeformater (webp, jpg, heic i Safari …) om til PNG via canvas, så
 * tekstleseren får det samme uansett hvor skjermbildet kommer fra. Utenfor
 * nettleseren, eller hvis dekodingen feiler, brukes bildet som det er.
 */
async function toPng(image: Blob | string): Promise<Blob | string> {
  if (typeof image === "string" || typeof createImageBitmap !== "function" || typeof document === "undefined") {
    return image
  }
  try {
    const bmp = await createImageBitmap(image)
    const canvas = document.createElement("canvas")
    canvas.width = bmp.width
    canvas.height = bmp.height
    canvas.getContext("2d")!.drawImage(bmp, 0, 0)
    bmp.close?.()
    const png = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"))
    return png ?? image
  } catch {
    return image
  }
}

export async function readOddsFromImages(
  images: (Blob | string)[],
  teams: { home: string; away: string },
  onProgress?: Progress
): Promise<OcrResult> {
  const { createWorker } = await import("tesseract.js")

  onProgress?.("Laster tekstgjenkjenning …", 0)
  const general = await createWorker("eng")
  await general.setParameters({ tessedit_pageseg_mode: "11" as never })
  // Tre fallbacks for en enkelt resultat-rute, fra strengest til mest tilgivende.
  const line = await createWorker("eng")
  await line.setParameters({
    tessedit_pageseg_mode: "7" as never,
    tessedit_char_whitelist: "0123456789-",
  })
  const word = await createWorker("eng")
  await word.setParameters({
    tessedit_pageseg_mode: "8" as never,
    tessedit_char_whitelist: "0123456789-",
  })
  const loose = await createWorker("eng")
  await loose.setParameters({ tessedit_pageseg_mode: "7" as never })

  const best = new Map<string, FoundOdds>()
  let unresolvedCount = 0
  let allText = ""

  try {
    for (const [i, original] of images.entries()) {
      const image = await toPng(original)
      onProgress?.(`Leser bilde ${i + 1} av ${images.length} …`, i / images.length)
      const { data } = await general.recognize(image, {}, { blocks: true, text: true })
      allText += `\n${data.text}`

      const words: OcrWord[] = (data.blocks ?? []).flatMap((b) =>
        b.paragraphs.flatMap((p) =>
          p.lines.flatMap((l) =>
            l.words.map((w) => ({
              text: w.text,
              x0: w.bbox.x0,
              y0: w.bbox.y0,
              x1: w.bbox.x1,
              y1: w.bbox.y1,
              confidence: w.confidence,
            }))
          )
        )
      )

      const { pairs, unresolved } = pairOddsFromWords(words)
      for (const p of pairs) best.set(`${p.home}-${p.away}`, p)

      // Andre runde: les etiketten til venstre for hver odds uten resultat, med bare sifre.
      const allOdds = words.filter((w) => toOdds(w.text) !== null)
      for (const o of unresolved) {
        const tol = Math.max(o.y1 - o.y0, 12) * 0.8
        const leftBound = Math.max(
          0,
          ...allOdds
            .filter((p) => p !== o && Math.abs((p.y0 + p.y1) / 2 - (o.y0 + o.y1) / 2) < tol && p.x1 <= o.x0)
            .map((p) => p.x1)
        )
        const pad = Math.round((o.y1 - o.y0) * 0.5)
        const rect = {
          left: Math.round(leftBound),
          top: Math.max(0, o.y0 - pad),
          width: Math.max(10, Math.round(o.x0 - leftBound)),
          height: o.y1 - o.y0 + pad * 2,
        }
        const inset = { ...rect, left: rect.left + 8, width: Math.max(10, rect.width - 14) }
        const attempts: [typeof line, typeof rect][] = [
          [line, rect],
          [word, inset],
          [loose, rect],
        ]
        let sc: { home: number; away: number } | null = null
        for (const [worker, r] of attempts) {
          sc = parseLooseScore((await worker.recognize(image, { rectangle: r })).data.text)
          if (sc) break
        }
        if (sc) best.set(`${sc.home}-${sc.away}`, { ...sc, odds: toOdds(o.text)! })
        else unresolvedCount++
      }
    }
  } finally {
    await Promise.all([general.terminate(), line.terminate(), word.terminate(), loose.terminate()])
  }

  onProgress?.("Ferdig", 1)
  return {
    found: [...best.values()],
    unresolved: unresolvedCount,
    teams: checkTeams(allText, teams.home, teams.away),
  }
}
