"use client"

import Link from "next/link"

import type { MatchSummary } from "@/lib/football/types"
import { TrackButton } from "@/components/track-button"
import { Badge } from "@/components/ui/badge"

import { MatchRow } from "./match-row"
import { MatchSections } from "./match-sections"

/** Den lokale appens kampliste: Next-lenker og «Ta med» mot databasen. */
export function MatchSectionsLocal({
  matches,
  trackedIds,
  full,
  error,
}: {
  matches: MatchSummary[]
  trackedIds: string[]
  full: boolean
  error: string | null
}) {
  const tracked = new Set(trackedIds)

  return (
    <MatchSections
      matches={matches}
      error={error}
      renderRow={(m) => (
        <MatchRow
          match={m}
          renderLink={({ className, children }) => (
            <Link href={`/kamp/${m.id}`} className={className}>
              {children}
            </Link>
          )}
          trailing={
            m.status === "finished" ? null : tracked.has(m.id) ? (
              <Badge variant="secondary">Med</Badge>
            ) : (
              <TrackButton eventId={m.id} disabled={full} />
            )
          }
        />
      )}
    />
  )
}
