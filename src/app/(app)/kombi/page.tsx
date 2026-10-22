import type { Metadata } from "next"

import { requireUserId } from "@/lib/auth"
import { db } from "@/lib/db"
import { ComboBuilderLocal } from "@/components/combo/combo-builder-local"

export const metadata: Metadata = { title: "Kombinasjoner" }
export const dynamic = "force-dynamic"

export default async function CombosPage() {
  const userId = await requireUserId()
  const tracked = await db.trackedMatch.findMany({
    where: { userId, archivedAt: null },
    orderBy: { kickoff: "asc" },
  })

  return (
    <ComboBuilderLocal
      matches={tracked.map((t) => ({
        id: t.eventId,
        homeName: t.homeName,
        awayName: t.awayName,
        kickoff: t.kickoff.toISOString(),
      }))}
    />
  )
}
