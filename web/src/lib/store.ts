import { useSyncExternalStore } from "react"

import type { LockInput } from "@/components/match/plan-panel"
import { MAX_ACTIVE_MATCHES } from "@/lib/limits"

/**
 * Nettleserlagring i stedet for database. Alt ligger i localStorage på denne
 * enheten — ingenting sendes noe sted, og ingen andre kan se det.
 */

export type StoredBet = {
  homeGoals: number
  awayGoals: number
  probability: number
  odds: number | null
  stake: number | null
  placed: boolean
}

export type StoredMatch = {
  eventId: string
  homeName: string
  awayName: string
  kickoff: string
  lockedScore: string | null
  bets: StoredBet[]
}

const KEY = "tortuga.v1"
const listeners = new Set<() => void>()
let cache: StoredMatch[] | null = null

function read(): StoredMatch[] {
  if (cache) return cache
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "[]")
    cache = Array.isArray(parsed) ? parsed : []
  } catch {
    cache = []
  }
  return cache!
}

function write(next: StoredMatch[]) {
  cache = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // Privat modus eller full lagring: appen virker videre, men uten varig lagring.
  }
  listeners.forEach((l) => l())
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null
      cb()
    }
  }
  window.addEventListener("storage", onStorage)
  return () => {
    listeners.delete(cb)
    window.removeEventListener("storage", onStorage)
  }
}

export function useTracked(): StoredMatch[] {
  return useSyncExternalStore(subscribe, read, () => [])
}

export function trackMatch(m: Pick<StoredMatch, "eventId" | "homeName" | "awayName" | "kickoff">):
  | { ok: true }
  | { ok: false; error: string } {
  const all = read()
  if (all.some((x) => x.eventId === m.eventId)) return { ok: true }
  if (all.length >= MAX_ACTIVE_MATCHES) {
    return { ok: false, error: `Du har allerede ${MAX_ACTIVE_MATCHES} aktive kamper. Fjern én først.` }
  }
  write([...all, { ...m, lockedScore: null, bets: [] }])
  return { ok: true }
}

export function untrackMatch(eventId: string) {
  write(read().filter((m) => m.eventId !== eventId))
}

/** Erstatter ikke-plasserte bet; plasserte røres ikke (samme regel som lokalt). */
export function lockPlan(eventId: string, input: LockInput): { ok: true } | { ok: false; error: string } {
  const all = read()
  const m = all.find((x) => x.eventId === eventId)
  if (!m) return { ok: false, error: "Ta kampen med først." }

  const placed = m.bets.filter((b) => b.placed)
  const placedKeys = new Set(placed.map((b) => `${b.homeGoals}-${b.awayGoals}`))
  const fresh: StoredBet[] = input.legs
    .filter((l) => !placedKeys.has(`${l.homeGoals}-${l.awayGoals}`))
    .map((l) => ({ ...l, placed: false }))

  write(
    all.map((x) =>
      x.eventId === eventId
        ? { ...x, lockedScore: input.score, bets: [...placed, ...fresh].sort((a, b) => b.probability - a.probability) }
        : x
    )
  )
  return { ok: true }
}

export function setPlaced(eventId: string, homeGoals: number, awayGoals: number, placed: boolean) {
  write(
    read().map((m) =>
      m.eventId === eventId
        ? {
            ...m,
            bets: m.bets.map((b) =>
              b.homeGoals === homeGoals && b.awayGoals === awayGoals ? { ...b, placed } : b
            ),
          }
        : m
    )
  )
}
