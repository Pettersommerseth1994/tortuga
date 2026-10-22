import { ArrowLeftIcon, PlusIcon } from "lucide-react"
import { Link, useParams } from "react-router"
import { toast } from "sonner"

import { LiveMatch } from "@/components/match/live-match"
import { PlanPanel } from "@/components/match/plan-panel"
import { Button } from "@/components/ui/button"
import { MAX_ACTIVE_MATCHES } from "@/lib/limits"

import { fetchPayload } from "../lib/data"
import { lockPlan, trackMatch, useTracked } from "../lib/store"

export function MatchPage() {
  const { id = "" } = useParams()
  const all = useTracked()
  const stored = all.find((m) => m.eventId === id)
  const canTrack = stored !== undefined || all.length < MAX_ACTIVE_MATCHES

  return (
    <div className="flex flex-col gap-4">
      <Button asChild variant="ghost" size="sm" className="w-fit">
        <Link to="/">
          <ArrowLeftIcon /> Alle kamper
        </Link>
      </Button>

      <LiveMatch
        key={id}
        id={id}
        fetchPayload={(opts) => fetchPayload(id, opts)}
        renderPlan={({ match, kept, basis }) => (
          <PlanPanel
            kept={kept}
            basisScore={basis}
            home={match.home.shortName}
            away={match.away.shortName}
            locked={match.status === "finished"}
            tracked={
              stored
                ? { id: stored.eventId, lockedScore: stored.lockedScore, bets: stored.bets }
                : null
            }
            trackSlot={
              <Button
                disabled={!canTrack}
                variant="outline"
                onClick={() => {
                  const res = trackMatch({
                    eventId: id,
                    homeName: match.home.name,
                    awayName: match.away.name,
                    kickoff: match.kickoff,
                  })
                  if (!res.ok) toast.error(res.error)
                  else toast.success("Kampen er med i Tortuga.")
                }}
              >
                <PlusIcon /> Ta med
              </Button>
            }
            trackHint={
              canTrack
                ? undefined
                : "Du har allerede tre aktive kamper. Fjern én på Kamper-siden for å ta denne med."
            }
            onLock={async (input) => lockPlan(id, input)}
          />
        )}
      />
    </div>
  )
}
