/**
 * Innsatsfordeling over de valgte scenarioene.
 *
 * Bare ett resultat kan treffe, så målet er å fordele et budsjett:
 *  - "lik gevinst": alle odds oppgitt → innsats ∝ 1/odds, slik at *hvilket som
 *    helst* treff gir samme utbetaling. Går i pluss kun hvis Σ(1/odds) < 1.
 *  - "kelly": verdi-basert. Satser bare der modellens sannsynlighet × odds er
 *    høy nok, og mest der fordelen er størst. Se `kellyPlan`.
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
  mode: "equal-return" | "probability" | "kelly"
  rows: StakeRow[]
  totalStake: number
  /** Σ(1/odds) når alle odds er oppgitt; < 1 betyr at et treff gir overskudd. */
  overround: number | null
  /** Forventet nettoresultat (kun når alle odds er oppgitt). */
  expectedNet: number | null
  /** Kelly fant ingen resultater med positiv forventet verdi: ingen innsats anbefales. */
  noValue?: boolean
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

/**
 * Kelly-kriteriet for gjensidig utelukkende utfall (som riktig resultat): den
 * fordelingen som maksimerer forventet log-vekst, gitt modellens sannsynligheter.
 *
 * Utfall rangeres etter p·odds. Utfall tas med så lenge p·odds er større enn
 * «reserven» R = (1 − Σp) / (1 − Σ1/odds) over de som allerede er med (R = 1 til å
 * begynne med, så et utfall kvalifiserer bare hvis p·odds > 1). Innsatsen på hvert
 * utfall er andelen p − R/odds av banken; resten, R, holdes tilbake.
 *
 * Fullt Kelly er aggressivt og forutsetter at sannsynlighetene er riktige.
 * Modellen vår er en enkel Poisson-modell, så `fraction` skalerer innsatsene ned
 * (½ er vanlig), og `budget` regnes som banken for kampen: mer enn det satses aldri.
 */
export function kellyPlan(legs: StakeLeg[], budget: number, fraction = 0.5): StakePlan {
  const usable = legs
    .map((l, i) => ({ i, p: l.probability, o: l.odds ?? 0 }))
    .filter((l) => l.o > 1 && l.p > 0)
    .sort((a, b) => b.p * b.o - a.p * a.o)

  let reserve = 1
  let sumP = 0
  let sumQ = 0
  const chosen: typeof usable = []
  for (const l of usable) {
    if (l.p * l.o <= reserve) break
    const q = sumQ + 1 / l.o
    if (q >= 1) break // finnes ikke i praksis (ville vært sikker gevinst), men beskytt mot deling på 0
    chosen.push(l)
    sumP += l.p
    sumQ = q
    reserve = (1 - sumP) / (1 - sumQ)
  }

  const frac = new Map(chosen.map((l) => [l.i, Math.max(0, l.p - reserve / l.o)]))
  const rows: StakeRow[] = legs.map((l, i) => {
    const stake = Math.round(budget * fraction * (frac.get(i) ?? 0))
    return {
      key: l.key,
      stake,
      payout: stake > 0 ? Math.round(stake * (l.odds as number)) : null,
    }
  })
  const staked = legs.map((l, i) => ({ l, r: rows[i] })).filter((x) => x.r.stake > 0)
  const totalStake = staked.reduce((a, x) => a + x.r.stake, 0)

  return {
    mode: "kelly",
    rows,
    totalStake,
    overround: staked.length ? staked.reduce((a, x) => a + 1 / (x.l.odds as number), 0) : null,
    expectedNet: staked.length
      ? staked.reduce((a, x) => a + x.l.probability * (x.r.payout ?? 0), 0) - totalStake
      : null,
    noValue: staked.length === 0,
  }
}
