import { useSyncExternalStore } from "react"

import { mergeLockedCombos, type LockCombosInput, type StoredCombo } from "@/lib/model/combos"

/**
 * Kombinasjoner i sjekklisten på Pages: nettleserlagring (localStorage), som resten av
 * Pages-versjonen. Reglene for låsing ligger i `mergeLockedCombos` og er felles med testene.
 */

const KEY = "tortuga.combos.v1"
const listeners = new Set<() => void>()
let cache: StoredCombo[] | null = null

function read(): StoredCombo[] {
  if (cache) return cache
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "[]")
    cache = Array.isArray(parsed) ? parsed : []
  } catch {
    cache = []
  }
  return cache!
}

function write(next: StoredCombo[]) {
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

export function useCombos(): StoredCombo[] {
  return useSyncExternalStore(subscribe, read, () => [])
}

export function lockCombos(input: LockCombosInput): { ok: true } | { ok: false; error: string } {
  if (input.combos.length === 0) return { ok: false, error: "Ingen kombinasjoner å låse." }
  write(mergeLockedCombos(read(), input, () => crypto.randomUUID(), Date.now()))
  return { ok: true }
}

export function setComboPlaced(id: string, placed: boolean) {
  write(read().map((c) => (c.id === id ? { ...c, placed } : c)))
}
