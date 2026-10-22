import { test } from "node:test"
import assert from "node:assert/strict"

import type { MatchDetail, TeamInfo } from "../src/lib/football/types"
import { buildView } from "../src/lib/match-view"

const team = (id: string, name: string): TeamInfo => ({
  id,
  name,
  shortName: name,
  abbreviation: name.slice(0, 3).toUpperCase(),
  table: null,
  recent: [],
})

const base: MatchDetail = {
  id: "1",
  competition: { slug: "uefa.champions", name: "Champions League", short: "CL" },
  kickoff: "2026-11-03T20:00:00Z",
  status: "halftime",
  statusLabel: "Pause",
  minute: 45,
  home: team("1", "Liverpool"),
  away: team("2", "Napoli"),
  homeScore: 2,
  awayScore: 1,
  halftime: { home: 2, away: 1 },
  homeTeam: team("1", "Liverpool"),
  awayTeam: team("2", "Napoli"),
  stats: [
    { key: "possessionPct", label: "", home: 64, away: 36 },
    { key: "totalShots", label: "", home: 12, away: 3 },
    { key: "shotsOnTarget", label: "", home: 6, away: 1 },
    { key: "blockedShots", label: "", home: 2, away: 0 },
    { key: "wonCorners", label: "", home: 5, away: 1 },
  ],
  events: [],
  odds: { provider: "Test", home: 1.6, draw: 4.0, away: 5.5, overUnder: 2.5 },
  redCards: { home: 0, away: 0 },
}

test("halftime uses live score and stats", () => {
  const v = buildView(base)
  assert.equal(v.mode, "halftime")
  assert.deepEqual(v.basis, { home: 2, away: 1 })
  assert.equal(v.hasStats, true)
  assert.ok(v.analysis.xg && v.analysis.xg.home > v.analysis.xg.away)
  assert.equal(v.analysis.scenarios.filter((s) => s.keep).length, 5)
})

test("scheduled match is a what-if simulation with the chosen score", () => {
  const v = buildView({ ...base, status: "scheduled", minute: null, halftime: null, homeScore: 0, awayScore: 0, stats: [] }, { simScore: { home: 1, away: 0 } })
  assert.equal(v.mode, "simulation")
  assert.deepEqual(v.basis, { home: 1, away: 0 })
  assert.equal(v.hasStats, false)
})

test("finished match replays from the halftime score", () => {
  const v = buildView({ ...base, status: "finished", minute: 90, homeScore: 4, awayScore: 1, halftime: { home: 1, away: 0 } })
  assert.equal(v.mode, "replay")
  assert.deepEqual(v.basis, { home: 1, away: 0 })
  assert.equal(v.hasStats, false)
})

test("live in first-half stoppage time is treated as minute 45, not later", () => {
  const v = buildView({ ...base, status: "live", minute: 47, halftime: null })
  assert.equal(v.minute, 45)
})

test("live late in the second half leaves little to play for", () => {
  const early = buildView(base)
  const late = buildView({ ...base, status: "live", minute: 85 })
  assert.ok(late.analysis.remaining.home < early.analysis.remaining.home / 3)
})

test("removeCount is respected", () => {
  assert.equal(buildView(base, { removeCount: 3 }).analysis.scenarios.filter((s) => s.keep).length, 6)
  assert.equal(buildView(base, { removeCount: 5 }).analysis.scenarios.filter((s) => s.keep).length, 4)
})

test("manual score overrides the live score during halftime, but keeps live stats", () => {
  const live = buildView(base)
  const manual = buildView(base, { manual: true, simScore: { home: 0, away: 0 } })
  assert.equal(live.manual, false)
  assert.equal(manual.manual, true)
  assert.deepEqual(manual.basis, { home: 0, away: 0 })
  assert.equal(manual.hasStats, true)
  // Samme stats, annen stilling → andre sluttresultater i rutenettet.
  assert.notDeepEqual(
    manual.analysis.scenarios.map((s) => `${s.home}-${s.away}`),
    live.analysis.scenarios.map((s) => `${s.home}-${s.away}`)
  )
})

test("manual is ignored before kickoff and after the final whistle", () => {
  const scheduled = buildView(
    { ...base, status: "scheduled", minute: null, halftime: null, homeScore: 0, awayScore: 0, stats: [] },
    { manual: true, simScore: { home: 1, away: 1 } }
  )
  assert.equal(scheduled.manual, false)
  assert.deepEqual(scheduled.basis, { home: 1, away: 1 }) // hva-om gjelder uansett
  const finished = buildView(
    { ...base, status: "finished", minute: 90, homeScore: 3, awayScore: 0, halftime: { home: 1, away: 0 } },
    { manual: true, simScore: { home: 5, away: 5 } }
  )
  assert.equal(finished.manual, false)
  assert.deepEqual(finished.basis, { home: 1, away: 0 })
})

test("competition level moves the prior: Champions League is higher-scoring than Conference League", () => {
  const noOdds = { ...base, odds: null }
  const cl = buildView({ ...noOdds, competition: { slug: "uefa.champions", name: "", short: "CL" } })
  const ecl = buildView({ ...noOdds, competition: { slug: "uefa.europa.conf", name: "", short: "ECL" } })
  assert.ok(cl.prior.home + cl.prior.away > ecl.prior.home + ecl.prior.away)
})
