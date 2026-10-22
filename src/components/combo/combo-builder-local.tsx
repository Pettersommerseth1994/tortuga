"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"

import { lockCombos } from "@/lib/actions/combos"

import { ComboBuilder, type ComboCandidate } from "./combo-builder"

/** Den lokale appens kombinasjonsside: kampdata fra /api/matches, lenker via Next. */
export function ComboBuilderLocal({ matches }: { matches: ComboCandidate[] }) {
  const router = useRouter()
  return (
    <ComboBuilder
      matches={matches}
      fetchPayload={async (id, { h, a, remove, manual }) => {
        const res = await fetch(`/api/matches/${id}?h=${h}&a=${a}&remove=${remove}&manual=${manual ? 1 : 0}`, {
          cache: "no-store",
        })
        if (!res.ok) throw new Error(String(res.status))
        return res.json()
      }}
      renderMatchLink={(id, children) => <Link href={`/kamp/${id}`}>{children}</Link>}
      onLock={async (input) => {
        const res = await lockCombos({
          kind: input.kind,
          combos: input.combos.map((c) => ({
            legs: c.legs.map((l) => ({ eventId: l.eventId, home: l.home, away: l.away })),
            probability: c.probability,
            odds: c.odds,
            stake: c.stake,
          })),
        })
        if (res.ok) router.refresh() // sjekklistetelleren i sidemenyen
        return res
      }}
    />
  )
}
