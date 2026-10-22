/** P(X = k) for X ~ Poisson(lambda). */
export function poissonPmf(k: number, lambda: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0
  let p = Math.exp(-lambda)
  for (let i = 1; i <= k; i++) p *= lambda / i
  return p
}

/** Sannsynlighet for hjemmeseier / uavgjort / borteseier over hele kampen. */
export function outcomeProbs(lambdaHome: number, lambdaAway: number, maxGoals = 10) {
  let home = 0
  let draw = 0
  let away = 0
  const ph = Array.from({ length: maxGoals + 1 }, (_, k) => poissonPmf(k, lambdaHome))
  const pa = Array.from({ length: maxGoals + 1 }, (_, k) => poissonPmf(k, lambdaAway))
  for (let i = 0; i <= maxGoals; i++) {
    for (let j = 0; j <= maxGoals; j++) {
      const p = ph[i] * pa[j]
      if (i > j) home += p
      else if (i === j) draw += p
      else away += p
    }
  }
  return { home, draw, away }
}
