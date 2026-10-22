import { test } from "node:test"
import assert from "node:assert/strict"

import { isNorwegianTeam } from "../src/lib/football/norway"

test("recognises Norwegian clubs under ESPN's spellings", () => {
  for (const n of ["Lillestrom", "SK Brann", "Viking FK", "Bodo/Glimt", "Bodø/Glimt", "Molde FK", "Rosenborg", "Tromsø IL", "Aalesunds FK", "Vålerenga"]) {
    assert.equal(isNorwegianTeam(n), true, n)
  }
})

test("does not mistake Nordic or similarly named clubs for Norwegian", () => {
  for (const n of ["Mjällby AIF", "FC Nordsjælland", "F.C. København", "KuPS Kuopio", "Real Sociedad", "Viktoria Plzen", "Start Gjovik Fotball Utlandet", "Brannbergen", "Bayern Munich"]) {
    assert.equal(isNorwegianTeam(n), false, n)
  }
})
