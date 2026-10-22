/**
 * Formatering. Alt som vises i UI-et går gjennom disse, slik at kolonner ikke
 * hopper når sifre endrer bredde (se `.tabular` i globals.css).
 */

const nbNO = "nb-NO"
const TZ = "Europe/Oslo"

export function formatNumber(value: number, fractionDigits = 2) {
  return new Intl.NumberFormat(nbNO, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value)
}

/** 0.4132 → "41 %". Under 1 % vises "<1 %" så ingenting ser umulig ut. */
export function formatProb(p: number) {
  if (p > 0 && p < 0.01) return "<1 %"
  return `${Math.round(p * 100)} %`
}

export function formatKr(value: number) {
  return `${new Intl.NumberFormat(nbNO, { maximumFractionDigits: 0 }).format(value)} kr`
}

export function formatKickoff(date: Date | string) {
  return new Intl.DateTimeFormat(nbNO, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
  }).format(new Date(date))
}

export function formatTime(date: Date | string) {
  return new Intl.DateTimeFormat(nbNO, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
  }).format(new Date(date))
}

/** "tirsdag 3. november" — brukes som dagsoverskrift. */
export function formatDay(date: Date | string) {
  return new Intl.DateTimeFormat(nbNO, {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: TZ,
  }).format(new Date(date))
}

/** Dato-nøkkel i norsk tid, til gruppering. */
export function dayKey(date: Date | string) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: TZ }).format(new Date(date))
}

/** Aksepterer både "2,35" og "2.35". Null ved ugyldig eller ≤ 1. */
export function parseOdds(input: string): number | null {
  const n = Number.parseFloat(input.replace(",", "."))
  return Number.isFinite(n) && n > 1 ? n : null
}
