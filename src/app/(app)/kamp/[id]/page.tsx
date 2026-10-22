import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeftIcon } from "lucide-react"

import { MAX_ACTIVE_MATCHES } from "@/lib/limits"
import { requireUserId } from "@/lib/auth"
import { db } from "@/lib/db"
import { getMatch } from "@/lib/football/espn"
import { buildView } from "@/lib/match-view"
import { LiveMatch } from "@/components/match/live-match"
import { Button } from "@/components/ui/button"

export const dynamic = "force-dynamic"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const match = await getMatch(id)
  return { title: match ? `${match.home.shortName} – ${match.away.shortName}` : "Kamp" }
}

export default async function MatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const userId = await requireUserId()

  const [match, tracked, activeCount] = await Promise.all([
    getMatch(id),
    db.trackedMatch.findUnique({
      where: { userId_eventId: { userId, eventId: id } },
      include: { bets: true },
    }),
    db.trackedMatch.count({ where: { userId, archivedAt: null } }),
  ])
  if (!match) notFound()

  const view = buildView(match)
  const active = tracked && !tracked.archivedAt ? tracked : null

  return (
    <div className="flex flex-col gap-4">
      <Button asChild variant="ghost" size="sm" className="w-fit">
        <Link href="/kamper">
          <ArrowLeftIcon /> Alle kamper
        </Link>
      </Button>

      <LiveMatch
        id={id}
        initial={{ match, view }}
        canTrack={activeCount < MAX_ACTIVE_MATCHES}
        tracked={
          active
            ? {
                id: active.id,
                lockedScore: active.lockedScore,
                bets: active.bets.map((b) => ({
                  homeGoals: b.homeGoals,
                  awayGoals: b.awayGoals,
                  odds: b.odds,
                  stake: b.stake,
                  placed: b.placed,
                })),
              }
            : null
        }
      />
    </div>
  )
}
