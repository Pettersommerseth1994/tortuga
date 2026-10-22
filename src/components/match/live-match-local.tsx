"use client"

import { useRouter } from "next/navigation"

import { lockPlan } from "@/lib/actions/matches"
import { TrackButton } from "@/components/track-button"

import { LiveMatch, type Payload } from "./live-match"
import { PlanPanel, trackedForKind, type TrackedAll } from "./plan-panel"

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
  tracked: TrackedAll
  canTrack: boolean
}) {
  const router = useRouter()

  return (
    <LiveMatch
      id={id}
      initial={initial}
      fetchPayload={async ({ h, a, remove, manual }) => {
        const res = await fetch(`/api/matches/${id}?h=${h}&a=${a}&remove=${remove}&manual=${manual ? 1 : 0}`, {
          cache: "no-store",
        })
        if (!res.ok) throw new Error(String(res.status))
        return res.json()
      }}
      renderPlan={({ kind, match, kept, basis }) => (
        <PlanPanel
          // Egen instans per plan, så odds og budsjett ikke blandes mellom dem.
          key={kind}
          kind={kind}
          kept={kept}
          basisScore={basis}
          tracked={trackedForKind(tracked, kind)}
          home={match.home.shortName}
          away={match.away.shortName}
          locked={kind === "pre" ? match.status !== "scheduled" : match.status === "finished"}
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
