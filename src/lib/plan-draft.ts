/**
 * Utkast til betting-planen, lagret per kamp og spilletype («pre» / «ht») i
 * nettleseren: odds (innskrevne og lest fra bilde), budsjett og fordeling.
 * Slik går ingenting tapt når du bytter fane, laster siden på nytt eller kommer
 * tilbake til kampen senere. Planen i databasen/sjekklisten er noe annet — den
 * lages først når du låser.
 *
 * Lagres i denne nettleseren (localStorage): følger ikke med til andre enheter.
 */

export type PlanDraft = {
  /** Innskrevne odds («8», «7,65»), nøklet på «hjemme-borte». Går foran `scanned`. */
  odds: Record<string, string>
  /** Odds lest fra bilde. */
  scanned: Record<string, string>
  budget: string
  strategy: "equal" | "kelly"
  kellyFraction: number
  /** ms siden epoch. */
  savedAt: number
}

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">

const PREFIX = "tortuga.plan.v1"
const KEY = /^\d{1,2}-\d{1,2}$/

const keyFor = (eventId: string, kind: string) => `${PREFIX}:${eventId}:${kind}`

/** Beholder bare gyldige «hjemme-borte» → tallstreng, så skadet lagring aldri kan krasje visningen. */
function cleanMap(v: unknown): Record<string, string> {
  if (!v || typeof v !== "object") return {}
  return Object.fromEntries(
    Object.entries(v as Record<string, unknown>).filter(
      ([k, x]) => KEY.test(k) && typeof x === "string" && /^[\d.,]{1,8}$/.test(x)
    )
  ) as Record<string, string>
}

export function parseDraft(raw: string | null): PlanDraft | null {
  if (!raw) return null
  try {
    const j = JSON.parse(raw)
    if (!j || typeof j !== "object") return null
    return {
      odds: cleanMap(j.odds),
      scanned: cleanMap(j.scanned),
      budget: typeof j.budget === "string" && /^\d{1,7}$/.test(j.budget) ? j.budget : "500",
      strategy: j.strategy === "kelly" ? "kelly" : "equal",
      kellyFraction: [0.25, 0.5, 1].includes(j.kellyFraction) ? j.kellyFraction : 0.5,
      savedAt: typeof j.savedAt === "number" ? j.savedAt : 0,
    }
  } catch {
    return null
  }
}

function browserStorage(): StorageLike | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage
  } catch {
    return null // blokkert (privat modus, nettleserinnstillinger)
  }
}

export function loadDraft(eventId: string, kind: string, storage: StorageLike | null = browserStorage()): PlanDraft | null {
  try {
    return parseDraft(storage?.getItem(keyFor(eventId, kind)) ?? null)
  } catch {
    return null
  }
}

/** Utkast uten noe å huske (ingen odds, standardvalg) fjernes i stedet for å lagres. */
export function isDefault(d: Omit<PlanDraft, "savedAt">): boolean {
  return (
    Object.keys(d.odds).length === 0 &&
    Object.keys(d.scanned).length === 0 &&
    d.budget === "500" &&
    d.strategy === "equal" &&
    d.kellyFraction === 0.5
  )
}

export function saveDraft(
  eventId: string,
  kind: string,
  draft: Omit<PlanDraft, "savedAt">,
  storage: StorageLike | null = browserStorage()
): number | null {
  try {
    if (!storage) return null
    if (isDefault(draft)) {
      storage.removeItem(keyFor(eventId, kind))
      return null
    }
    const savedAt = Date.now()
    storage.setItem(keyFor(eventId, kind), JSON.stringify({ ...draft, savedAt }))
    return savedAt
  } catch {
    return null // full lagring: appen virker videre, bare uten varig lagring
  }
}

export function clearDraft(eventId: string, kind: string, storage: StorageLike | null = browserStorage()) {
  try {
    storage?.removeItem(keyFor(eventId, kind))
  } catch {
    /* ignorer */
  }
}
