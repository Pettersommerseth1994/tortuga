import { test } from "node:test"
import assert from "node:assert/strict"

import { analyse, goalsShareAt, xgProxy, type AnalysisInput } from "../src/lib/model/analysis"
import { devig, fitRates } from "../src/lib/model/prior"
import { outcomeProbs, poissonPmf } from "../src/lib/model/poisson"
import { stakePlan } from "../src/lib/model/stakes"

const base: AnalysisInput = {
  home: "Liverpool",
  away: "Napoli",
  score: { home: 2, away: 1 },
  minute: 45,
  prior: { home: 1.9, away: 0.9, source: "odds", detail: "test", probs: { home: 0.6, draw: 0.22, away: 0.18 } },
  stats: null,
  redCards: { home: 0, away: 0 },
  removeCount: 4,
}

test("poisson pmf sums to 1", () => {
  const s = Array.from({ length: 30 }, (_, k) => poissonPmf(k, 2.3)).reduce((a, b) => a + b)
  assert.ok(Math.abs(s - 1) < 1e-9)
})

test("goalsShareAt is monotone from 0 to 1 and 45' ≈ first-half share", () => {
  assert.equal(goalsShareAt(0), 0)
  assert.equal(goalsShareAt(120), 1)
  assert.ok(Math.abs(goalsShareAt(45) - 0.455) < 1e-9)
  let prev = 0
  for (let m = 0; m <= 100; m++) {
    const v = goalsShareAt(m)
    assert.ok(v >= prev)
    prev = v
  }
})

test("devig removes margin", () => {
  const p = devig({ home: 1.8, draw: 3.6, away: 4.5 })
  assert.ok(Math.abs(p.home + p.draw + p.away - 1) < 1e-12)
})

test("fitRates reproduces market probabilities", () => {
  const target = devig({ home: 1.5, draw: 4.2, away: 6.0 })
  const { home, away } = fitRates(target, 2.9)
  const got = outcomeProbs(home, away)
  assert.ok(Math.abs(got.home - target.home) < 0.03)
  assert.ok(Math.abs(got.draw - target.draw) < 0.03)
  assert.ok(home > away)
})

test("nine scenarios, five kept, anchored on the current score", () => {
  const a = analyse(base)
  assert.equal(a.scenarios.length, 9)
  assert.equal(a.scenarios.filter((s) => s.keep).length, 5)
  const s21 = a.scenarios.find((s) => s.home === 2 && s.away === 1)!
  assert.equal(s21.addHome, 0)
  assert.equal(s21.addAway, 0)
  assert.ok(a.scenarios.some((s) => s.home === 4 && s.away === 3))
})

test("kept scenarios are never less likely than dropped ones", () => {
  const a = analyse(base)
  const minKept = Math.min(...a.scenarios.filter((s) => s.keep).map((s) => s.probability))
  const maxDropped = Math.max(...a.scenarios.filter((s) => !s.keep).map((s) => s.probability))
  assert.ok(minKept >= maxDropped)
})

test("weak, passive away side: 2 more away goals is dropped", () => {
  const a = analyse({
    ...base,
    stats: {
      home: { possession: 66, shots: 11, shotsOnTarget: 6, blocked: 2, corners: 5 },
      away: { possession: 34, shots: 2, shotsOnTarget: 0, blocked: 0, corners: 0 },
    },
  })
  const bad = a.scenarios.find((s) => s.addAway === 2)!
  assert.equal(bad.keep, false)
  assert.ok(a.remaining.home > a.remaining.away)
})

test("probabilities fall as time runs out; red card shifts rates", () => {
  const early = analyse({ ...base, minute: 45 })
  const late = analyse({ ...base, minute: 80 })
  assert.ok(late.remaining.home < early.remaining.home)
  assert.ok(late.scenarios.find((s) => s.addHome === 0 && s.addAway === 0)!.probability >
    early.scenarios.find((s) => s.addHome === 0 && s.addAway === 0)!.probability)

  const red = analyse({ ...base, redCards: { home: 0, away: 1 } })
  assert.ok(red.remaining.home > early.remaining.home)
  assert.ok(red.remaining.away < early.remaining.away)
})

test("xgProxy ranks on-target shots above off-target", () => {
  const a = xgProxy({ possession: 50, shots: 6, shotsOnTarget: 4, blocked: 0, corners: 0 })
  const b = xgProxy({ possession: 50, shots: 6, shotsOnTarget: 1, blocked: 0, corners: 0 })
  assert.ok(a > b)
})

test("stake plan: equal return pays the same whichever leg hits", () => {
  const plan = stakePlan(
    [
      { key: "a", probability: 0.3, odds: 6 },
      { key: "b", probability: 0.2, odds: 9 },
      { key: "c", probability: 0.1, odds: 15 },
    ],
    1000
  )
  assert.equal(plan.mode, "equal-return")
  const payouts = plan.rows.map((r) => r.payout!)
  assert.ok(Math.max(...payouts) - Math.min(...payouts) <= 20)
  assert.ok(plan.overround! > 0)
})

test("stake plan without odds falls back to probability weights", () => {
  const plan = stakePlan(
    [
      { key: "a", probability: 0.3 },
      { key: "b", probability: 0.1 },
    ],
    400
  )
  assert.equal(plan.mode, "probability")
  assert.equal(plan.rows[0].stake, 300)
  assert.equal(plan.rows[1].stake, 100)
  assert.equal(plan.rows[0].payout, null)
})
