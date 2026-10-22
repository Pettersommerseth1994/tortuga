import { test } from "node:test"
import assert from "node:assert/strict"

import { bestSingles, buildCombos, comboKey, rankCombos, type ComboLeg } from "../src/lib/model/combos"
import { kellyPlan, stakePlan } from "../src/lib/model/stakes"

const leg = (matchId: string, home: number, away: number, probability: number, odds: number): ComboLeg => ({
  matchId, home, away, probability, odds,
})

const A = [leg("A", 0, 1, 0.12, 8), leg("A", 1, 1, 0.11, 7.65), leg("A", 0, 0, 0.07, 13.5)]
const B = [leg("B", 1, 0, 0.14, 7.5), leg("B", 2, 1, 0.09, 12)]
const C = [leg("C", 1, 1, 0.1, 9), leg("C", 0, 0, 0.05, 20)]

test("a double multiplies odds, probability and value", () => {
  const c = buildCombos([A, B])
  assert.equal(c.length, A.length * B.length)
  const d = c.find((x) => comboKey(x) === "A:0-1|B:1-0")!
  assert.ok(Math.abs(d.odds - 8 * 7.5) < 1e-9)
  assert.ok(Math.abs(d.probability - 0.12 * 0.14) < 1e-12)
  assert.ok(Math.abs(d.value - 0.12 * 8 * 0.14 * 7.5) < 1e-9)
})

test("a treble has one leg per match and A×B×C combinations", () => {
  const c = buildCombos([A, B, C])
  assert.equal(c.length, A.length * B.length * C.length)
  assert.ok(c.every((x) => x.legs.length === 3 && new Set(x.legs.map((l) => l.matchId)).size === 3))
})

test("fewer than two matches, or a match without candidates, gives no combinations", () => {
  assert.deepEqual(buildCombos([A]), [])
  assert.deepEqual(buildCombos([A, []]), [])
})

test("candidates per match are trimmed to the most likely ones", () => {
  assert.equal(buildCombos([A, B], 2).length, 2 * 2)
})

test("adding a leg helps expected value only if the leg itself has value above 1", () => {
  const good = [leg("G", 1, 0, 0.2, 8)] //  p·o = 1,6
  const bad = [leg("X", 1, 0, 0.2, 4)] //   p·o = 0,8
  const single = leg("A", 0, 1, 0.5, 2.2) // p·o = 1,1
  const withGood = buildCombos([[single], good])[0]
  const withBad = buildCombos([[single], bad])[0]
  assert.ok(withGood.value > single.probability * single.odds)
  assert.ok(withBad.value < single.probability * single.odds)
})

test("two negative-value legs compound the margin: the double is worse than either single", () => {
  const a = leg("A", 0, 1, 0.12, 8) // 0,96
  const b = leg("B", 1, 0, 0.14, 6) // 0,84
  const d = buildCombos([[a], [b]])[0]
  assert.ok(d.value < a.probability * a.odds && d.value < b.probability * b.odds)
})

test("ranking by value and by probability can disagree", () => {
  const c = buildCombos([A, B])
  const byValue = rankCombos(c, "value", 1)[0]
  const byProb = rankCombos(c, "probability", 1)[0]
  assert.ok(byValue.value >= byProb.value)
  assert.ok(byProb.probability >= byValue.probability)
  assert.equal(rankCombos(c, "value", 3).length, 3)
})

test("best singles: highest p·odds per match", () => {
  const s = bestSingles([A, B])
  assert.equal(s.length, 2)
  assert.equal(s[0].matchId, "A")
  assert.ok(Math.abs(s[0].value - 0.12 * 8) < 1e-9) // 0,96 slår 0,11·7,65 = 0,84 og 0,07·13,5 = 0,945
})

test("combinations are mutually exclusive, so equal-return stakes pay the same whichever hits", () => {
  const top = rankCombos(buildCombos([A, B]), "probability", 4)
  const plan = stakePlan(
    top.map((c) => ({ key: comboKey(c), probability: c.probability, odds: c.odds })),
    100_000 // stort budsjett, så avrunding til hele kroner ikke spiller inn
  )
  assert.equal(plan.mode, "equal-return")
  const pay = plan.rows.map((r) => r.payout!)
  assert.ok((Math.max(...pay) - Math.min(...pay)) / Math.max(...pay) < 0.005)
})

test("kelly over combinations stakes only combinations with value above 1", () => {
  const good = [leg("G", 1, 0, 0.2, 9)] //  1,8
  const ok = [leg("H", 1, 1, 0.25, 4.4)] //  1,1
  const combos = buildCombos([good, ok])
  const plan = kellyPlan(
    combos.map((c) => ({ key: comboKey(c), probability: c.probability, odds: c.odds })),
    1000,
    1
  )
  assert.equal(plan.noValue, false)
  assert.ok(plan.totalStake > 0 && plan.totalStake < 1000)
})

import { comboSetKey, comboSignature, mergeLockedCombos, type LockCombo } from "../src/lib/model/combos"

const lg = (eventId: string, home: number, away: number) => ({ eventId, homeName: "H" + eventId, awayName: "A" + eventId, home, away })
const lc = (legs: ReturnType<typeof lg>[], stake = 50): LockCombo => ({ legs, probability: 0.01, odds: 100, stake })

test("set key and signature ignore leg order", () => {
  assert.equal(comboSetKey([lg("402", 0, 0), lg("401", 1, 1)]), "401|402")
  assert.equal(comboSignature([lg("402", 2, 1), lg("401", 1, 0)]), "401:1-0|402:2-1")
})

test("locking replaces unplaced combos of the same set and kind, and keeps placed ones", () => {
  let n = 0
  const id = () => `id${++n}`
  const first = mergeLockedCombos([], { kind: "pre", combos: [lc([lg("401", 1, 0), lg("402", 2, 1)]), lc([lg("401", 0, 1), lg("402", 0, 0)])] }, id, 1)
  assert.equal(first.length, 2)
  // Brukeren plasserer den første:
  const placed = first.map((c, i) => (i === 0 ? { ...c, placed: true } : c))
  // Ny låsing med en annen kombinasjon, og den allerede plasserte på nytt:
  const second = mergeLockedCombos(
    placed,
    { kind: "pre", combos: [lc([lg("401", 1, 0), lg("402", 2, 1)]), lc([lg("401", 2, 2), lg("402", 1, 1)])] },
    id,
    2
  )
  const sigs = second.map((c) => c.signature).sort()
  assert.deepEqual(sigs, ["401:1-0|402:2-1", "401:2-2|402:1-1"])
  assert.equal(second.find((c) => c.signature === "401:1-0|402:2-1")!.placed, true) // urørt
  assert.equal(second.filter((c) => c.signature === "401:1-0|402:2-1").length, 1) // ikke duplisert
})

test("other sets and the other bet kind are untouched by a lock", () => {
  let n = 0
  const id = () => `id${++n}`
  const other = mergeLockedCombos([], { kind: "pre", combos: [lc([lg("401", 1, 0), lg("403", 1, 0)])] }, id, 1)
  const ht = mergeLockedCombos(other, { kind: "ht", combos: [lc([lg("401", 1, 0), lg("402", 1, 0)])] }, id, 2)
  const again = mergeLockedCombos(ht, { kind: "pre", combos: [lc([lg("401", 0, 0), lg("402", 0, 0)])] }, id, 3)
  assert.equal(again.length, 3)
  assert.ok(again.some((c) => c.setKey === "401|403"))
  assert.ok(again.some((c) => c.kind === "ht"))
})
