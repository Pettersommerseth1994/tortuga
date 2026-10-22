import { test } from "node:test"
import assert from "node:assert/strict"

import { clearDraft, isDefault, loadDraft, parseDraft, saveDraft } from "../src/lib/plan-draft"

function memory() {
  const m = new Map<string, string>()
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    keys: () => [...m.keys()],
  }
}

const draft = {
  odds: { "1-1": "7,65" },
  scanned: { "0-1": "8", "0-0": "13,5" },
  budget: "800",
  strategy: "kelly" as const,
  kellyFraction: 0.25,
}

test("a saved draft comes back unchanged", () => {
  const s = memory()
  const t = saveDraft("401", "pre", draft, s)
  assert.ok(t && t > 0)
  const got = loadDraft("401", "pre", s)!
  assert.deepEqual({ ...got, savedAt: 0 }, { ...draft, savedAt: 0 })
})

test("drafts are kept per match and per bet kind", () => {
  const s = memory()
  saveDraft("401", "pre", draft, s)
  saveDraft("401", "ht", { ...draft, budget: "300" }, s)
  saveDraft("402", "pre", { ...draft, budget: "100" }, s)
  assert.equal(loadDraft("401", "pre", s)!.budget, "800")
  assert.equal(loadDraft("401", "ht", s)!.budget, "300")
  assert.equal(loadDraft("402", "pre", s)!.budget, "100")
  assert.equal(loadDraft("403", "pre", s), null)
})

test("an empty default draft is removed instead of stored", () => {
  const s = memory()
  saveDraft("401", "pre", draft, s)
  assert.equal(s.keys().length, 1)
  saveDraft("401", "pre", { odds: {}, scanned: {}, budget: "500", strategy: "equal", kellyFraction: 0.5 }, s)
  assert.equal(s.keys().length, 0)
  assert.equal(isDefault({ ...draft }), false)
})

test("clear removes only that draft", () => {
  const s = memory()
  saveDraft("401", "pre", draft, s)
  saveDraft("401", "ht", draft, s)
  clearDraft("401", "pre", s)
  assert.equal(loadDraft("401", "pre", s), null)
  assert.ok(loadDraft("401", "ht", s))
})

test("damaged or hostile storage never crashes and is sanitised", () => {
  assert.equal(parseDraft("{not json"), null)
  assert.equal(parseDraft("null"), null)
  assert.equal(parseDraft(null), null)
  const p = parseDraft(
    JSON.stringify({
      odds: { "1-1": "7,65", "<script>": "8", "2-2": "<img>", "3-3": 5, "12345-1": "9" },
      scanned: "nope",
      budget: "-5",
      strategy: "wild",
      kellyFraction: 7,
    })
  )!
  assert.deepEqual(p.odds, { "1-1": "7,65" })
  assert.deepEqual(p.scanned, {})
  assert.equal(p.budget, "500")
  assert.equal(p.strategy, "equal")
  assert.equal(p.kellyFraction, 0.5)
})

test("blocked or full storage does not throw", () => {
  const broken = {
    getItem: () => {
      throw new Error("denied")
    },
    setItem: () => {
      throw new Error("quota")
    },
    removeItem: () => {
      throw new Error("denied")
    },
  }
  assert.equal(loadDraft("401", "pre", broken), null)
  assert.equal(saveDraft("401", "pre", draft, broken), null)
  assert.doesNotThrow(() => clearDraft("401", "pre", broken))
  assert.equal(saveDraft("401", "pre", draft, null), null)
})
