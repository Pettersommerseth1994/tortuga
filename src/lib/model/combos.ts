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
