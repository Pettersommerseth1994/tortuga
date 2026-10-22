/**
 * Kombinasjoner (dobbel / trippel) av «riktig resultat» på tvers av kamper.
 *
 * Én kombinasjon velger ett sluttresultat per kamp og vinner bare hvis *alle* treffer.
 * Kamper er uavhengige, så:
 *
 *   odds          = Π odds_i
 *   sannsynlighet = Π p_i
 *   verdi (p·odds) = Π (p_i · odds_i)        → forventet gevinst per krone = verdi − 1
 *
 * Verdien ganges altså også. Er hvert ben litt under 1 (bookmakerens margin), er
 * kombinasjonen enda lenger under: marginen vokser med hvert ben. Å legge til et ben
 * forbedrer forventet verdi bare hvis benet selv har verdi over 1.
 *
 * Fordi hver kamp ender med nøyaktig ett resultat, kan høyst én kombinasjon av et sett
 * treffe — de er gjensidig utelukkende, så samme innsatsfordeling som for enkeltbet
 * (`stakePlan` / `kellyPlan`) gjelder rett over.
 */

export type ComboLeg = {
  matchId: string
  home: number
  away: number
  probability: number
  /** Desimalodds for akkurat dette resultatet. */
  odds: number
}

export type Combo = {
  legs: ComboLeg[]
  odds: number
  probability: number
  /** probability × odds. Over 1 = positiv forventet verdi. */
  value: number
}

export type ComboSort = "value" | "probability"

/** Alle kombinasjoner (ett ben per kamp). Hver kamps kandidater beskjæres til de mest sannsynlige. */
export function buildCombos(perMatch: ComboLeg[][], topPerMatch = 12): Combo[] {
  if (perMatch.length < 2 || perMatch.some((m) => m.length === 0)) return []
  const trimmed = perMatch.map((legs) =>
    [...legs].sort((a, b) => b.probability - a.probability).slice(0, topPerMatch)
  )
  let acc: ComboLeg[][] = [[]]
  for (const legs of trimmed) {
    acc = acc.flatMap((prefix) => legs.map((l) => [...prefix, l]))
  }
  return acc.map((legs) => {
    const odds = legs.reduce((p, l) => p * l.odds, 1)
    const probability = legs.reduce((p, l) => p * l.probability, 1)
    return { legs, odds, probability, value: odds * probability }
  })
}

export function rankCombos(combos: Combo[], by: ComboSort, limit: number): Combo[] {
  const key = (c: Combo) => (by === "value" ? c.value : c.probability)
  return [...combos]
    .sort((a, b) => key(b) - key(a) || b.probability - a.probability)
    .slice(0, limit)
}

/** Beste enkeltbet (høyest p·odds) per kamp — målestokken en kombinasjon må slå. */
export function bestSingles(perMatch: ComboLeg[][]): (ComboLeg & { value: number })[] {
  return perMatch.flatMap((legs) => {
    if (legs.length === 0) return []
    const best = legs.reduce((b, l) => (l.probability * l.odds > b.probability * b.odds ? l : b))
    return [{ ...best, value: best.probability * best.odds }]
  })
}

/** Stabil nøkkel for en kombinasjon, til innsatsfordelingen. */
export const comboKey = (c: Combo) => c.legs.map((l) => `${l.matchId}:${l.home}-${l.away}`).join("|")

// --------------------------------------------------------------------------
// Låsing til sjekklisten

export type ComboKind = "pre" | "ht"

/** Ett ben slik det lagres i sjekklisten. */
export type LockedLeg = {
  eventId: string
  homeName: string
  awayName: string
  home: number
  away: number
}

/** En kombinasjon som skal låses inn. `stake` er hele kroner og alltid > 0. */
export type LockCombo = {
  legs: LockedLeg[]
  probability: number
  odds: number
  stake: number
}

export type LockCombosInput = { kind: ComboKind; combos: LockCombo[] }

/** Identifiserer settet med kamper («401|402»), uavhengig av rekkefølge. */
export const comboSetKey = (legs: Pick<LockedLeg, "eventId">[]) =>
  legs.map((l) => l.eventId).sort().join("|")

/** Identifiserer akkurat denne kombinasjonen av resultater. */
export const comboSignature = (legs: Pick<LockedLeg, "eventId" | "home" | "away">[]) =>
  [...legs]
    .sort((a, b) => a.eventId.localeCompare(b.eventId))
    .map((l) => `${l.eventId}:${l.home}-${l.away}`)
    .join("|")

/** Lagret kombinasjon (nettleserlagring på Pages og form på sjekklisten). */
export type StoredCombo = LockCombo & {
  id: string
  kind: ComboKind
  setKey: string
  signature: string
  placed: boolean
  createdAt: number
}

/**
 * Ny låsing av et sett kamper: allerede plasserte kombinasjoner røres ikke, resten av samme
 * sett og spilletype erstattes. Samme regel som for enkeltbet. Rene funksjoner, så regelen
 * kan testes uavhengig av lagringen.
 */
export function mergeLockedCombos(
  existing: StoredCombo[],
  input: LockCombosInput,
  makeId: () => string,
  now: number
): StoredCombo[] {
  const sets = new Set(input.combos.map((c) => comboSetKey(c.legs)))
  const kept = existing.filter(
    (e) => !(e.kind === input.kind && sets.has(e.setKey) && !e.placed)
  )
  const placedSignatures = new Set(
    kept.filter((e) => e.kind === input.kind).map((e) => e.signature)
  )
  const fresh: StoredCombo[] = input.combos
    .filter((c) => !placedSignatures.has(comboSignature(c.legs)))
    .map((c) => ({
      ...c,
      id: makeId(),
      kind: input.kind,
      setKey: comboSetKey(c.legs),
      signature: comboSignature(c.legs),
      placed: false,
      createdAt: now,
    }))
  return [...kept, ...fresh]
}
