import { Link } from "react-router"

import { ComboBuilder } from "@/components/combo/combo-builder"

import { fetchPayload } from "../lib/data"
import { lockCombos } from "../lib/combo-store"
import { useTracked } from "../lib/store"

export function Combos() {
  const tracked = useTracked()
  return (
    <ComboBuilder
      matches={tracked.map((t) => ({
        id: t.eventId,
        homeName: t.homeName,
        awayName: t.awayName,
        kickoff: t.kickoff,
      }))}
      fetchPayload={fetchPayload}
      renderMatchLink={(id, children) => <Link to={`/kamp/${id}`}>{children}</Link>}
      onLock={async (input) => lockCombos(input)}
    />
  )
}
