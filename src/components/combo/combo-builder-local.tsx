"use client"

import Link from "next/link"

import { ComboBuilder, type ComboCandidate } from "./combo-builder"

/** Den lokale appens kombinasjonsside: kampdata fra /api/matches, lenker via Next. */
export function ComboBuilderLocal({ matches }: { matches: ComboCandidate[] }) {
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
    />
  )
}
