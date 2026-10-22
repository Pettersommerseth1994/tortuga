import { test } from "node:test"
import assert from "node:assert/strict"

import { checkTeams, pairOddsFromWords, parseLooseScore, toOdds, toScore, type OcrWord } from "../src/lib/odds-ocr"

const w = (text: string, x0: number, y0: number, x1 = x0 + 80, y1 = y0 + 40): OcrWord => ({ text, x0, y0, x1, y1, confidence: 90 })

test("odds: decimal comma or point, plausible range only", () => {
  assert.equal(toOdds("13,00"), 13)
  assert.equal(toOdds("7.80"), 7.8)
  assert.equal(toOdds("1,00"), null) // ikke > 1
  assert.equal(toOdds("1234,00"), null) // urimelig høyt
  assert.equal(toOdds("13"), null)
  assert.equal(toOdds("4-3"), null)
})

test("score: hyphen variants", () => {
  assert.deepEqual(toScore("1-0"), { home: 1, away: 0 })
  assert.deepEqual(toScore("2–1"), { home: 2, away: 1 })
  assert.deepEqual(toScore("3 — 3"), { home: 3, away: 3 })
  assert.equal(toScore("10-0"), null)
  assert.equal(toScore("13,00"), null)
})

test("loose score repairs typical OCR damage", () => {
  assert.deepEqual(parseLooseScore("1-1"), { home: 1, away: 1 })
  assert.deepEqual(parseLooseScore("11"), { home: 1, away: 1 })
  assert.deepEqual(parseLooseScore("iil"), { home: 1, away: 1 })
  assert.deepEqual(parseLooseScore("0 - 2"), { home: 0, away: 2 })
  assert.equal(parseLooseScore("1-56"), null)
  assert.equal(parseLooseScore(""), null)
  assert.equal(parseLooseScore("abc"), null)
})

test("pairs score and odds by position across three columns, not text order", () => {
  // Tre kolonner på to rader. Rekkefølgen i listen er bevisst blandet.
  const words = [
    w("13,50", 505, 970), w("1-0", 72, 970), w("8,00", 796, 970),
    w("0-0", 349, 970), w("13,00", 229, 969), w("0-1", 625, 970),
    w("22,00", 227, 1070), w("2-0", 73, 1070),
    w("7,65", 522, 1069), w("9,00", 794, 1069), w("0-2", 625, 1070),
  ]
  const { pairs, unresolved } = pairOddsFromWords(words)
  const m = new Map(pairs.map((p) => [`${p.home}-${p.away}`, p.odds]))
  assert.equal(m.get("1-0"), 13)
  assert.equal(m.get("0-0"), 13.5)
  assert.equal(m.get("0-1"), 8)
  assert.equal(m.get("2-0"), 22)
  assert.equal(m.get("0-2"), 9)
  // 7,65 har ingen lesbar etikett (1-1 ble ikke gjenkjent) — skal ikke gjettes, men meldes.
  assert.equal(unresolved.length, 1)
  assert.equal(toOdds(unresolved[0].text), 7.65)
})

test("an odds value is never paired with a label from another row or across another odds", () => {
  const words = [w("1-0", 72, 970), w("13,00", 229, 1500)] // helt andre rader
  assert.equal(pairOddsFromWords(words).pairs.length, 0)

  // To odds på samme rad: etiketten hører til den nærmeste, ikke til begge.
  const two = [w("1-0", 72, 970), w("13,00", 229, 969), w("8,00", 500, 969)]
  const r = pairOddsFromWords(two)
  assert.equal(r.pairs.length, 1)
  assert.equal(r.pairs[0].odds, 13)
  assert.equal(r.unresolved.length, 1)
})

test("team check catches the right match, swapped sides, and a foreign screenshot", () => {
  const text = "UEFA Conference League\nFK Kauno Zalgiris\nBrann\nSpilltilbud"
  assert.equal(checkTeams(text, "Kauno Zalgiris", "SK Brann"), "ok")
  assert.equal(checkTeams(text, "SK Brann", "Kauno Zalgiris"), "swapped")
  assert.equal(checkTeams(text, "Lillestrom", "Real Sociedad"), "unknown")
})
