/**
 * Innsatsfordeling over de beholdte scenarioene.
 *
 * Bare ett resultat kan treffe, så målet er å fordele et budsjett:
 *  - "lik gevinst": alle odds oppgitt → innsats ∝ 1/odds, slik at *hvilket som
 *    helst* treff gir samme utbetaling. Går i pluss kun hvis Σ(1/odds) < 1.
 *  - "sannsynlighet": mangler odds → innsats ∝ modellens sannsynlighet.
 */
export type StakeLeg = { key: string; probability: number; odds?: number | null }

export type StakeRow = {
  key: string
  stake: number
  /** Utbetaling hvis akkurat dette treffer. Null uten odds. */
  payout: number | null
}

export type StakePlan = {
  mode: "equal-return" | "probability"
  rows: StakeRow[]
  totalStake: number
  /** Σ(1/odds) når alle odds er oppgitt; < 1 betyr at et treff gir overskudd. */
  overround: number | null
  /** Forventet nettoresultat (kun når alle odds er oppgitt). */
  expectedNet: number | null
}

export function stakePlan(legs: StakeLeg[], budget: number): StakePlan {
  const allOdds = legs.length > 0 && legs.every((l) => (l.odds ?? 0) > 1)
  const weights = legs.map((l) =>
    allOdds ? 1 / (l.odds as number) : Math.max(l.probability, 1e-9)
  )
  const sum = weights.reduce((a, b) => a + b, 0)

  const rows: StakeRow[] = legs.map((l, i) => {
    const stake = Math.round((budget * weights[i]) / sum)
    const hasOdds = (l.odds ?? 0) > 1
    return {
      key: l.key,
      stake,
      payout: hasOdds ? Math.round(stake * (l.odds as number)) : null,
    }
  })
  const totalStake = rows.reduce((a, r) => a + r.stake, 0)

  let expectedNet: number | null = null
  if (allOdds) {
    expectedNet =
      legs.reduce((acc, l, i) => acc + l.probability * (rows[i].payout ?? 0), 0) - totalStake
  }

  return {
    mode: allOdds ? "equal-return" : "probability",
    rows,
    totalStake,
    overround: allOdds ? legs.reduce((a, l) => a + 1 / (l.odds as number), 0) : null,
    expectedNet,
  }
}
