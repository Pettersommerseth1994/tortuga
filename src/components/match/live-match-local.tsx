"use client"

import { useRouter } from "next/navigation"

import { lockPlan } from "@/lib/actions/matches"
import { TrackButton } from "@/components/track-button"

import { LiveMatch, type Payload } from "./live-match"
import { PlanPanel, type TrackedState } from "./plan-panel"

/**
 * Den lokale appens kampvisning: data fra /api/matches, planen låses mot
 * databasen via serverhandling.
 */
export function LiveMatchLocal({
  id,
  initial,
  tracked,
  canTrack,
}: {
  id: string
  initial: Payload
  tracked: TrackedState
  canTrack: boolean
}) {
  const router = useRouter()

  return (
    <LiveMatch
      id={id}
      initial={initial}
      fetchPayload={async ({ h, a, remove }) => {
        const res = await fetch(`/api/matches/${id}?h=${h}&a=${a}&remove=${remove}`, {
          cache: "no-store",
        })
        if (!res.ok) throw new Error(String(res.status))
        return res.json()
      }}
      renderPlan={({ match, kept, basis }) => (
        <PlanPanel
          kept={kept}
          basisScore={basis}
          tracked={tracked}
          home={match.home.shortName}
          away={match.away.shortName}
          locked={match.status === "finished"}
          trackSlot={<TrackButton eventId={id} disabled={!canTrack} size="default" />}
          trackHint={
            canTrack
              ? undefined
              : "Du har allerede tre aktive kamper. Fjern én på Kamper-siden for å ta denne med."
          }
          onLock={async (input) => {
            if (!tracked) return { ok: false, error: "Ta kampen med først." }
            const res = await lockPlan({ trackedId: tracked.id, ...input })
            if (res.ok) router.refresh()
            return res
          }}
        />
      )}
    />
  )
}
