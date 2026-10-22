import { getMatch, listMatches } from "@/lib/football/espn"
import { buildView } from "@/lib/match-view"
import type { Payload } from "@/components/match/live-match"

/** Henter direkte fra ESPN i nettleseren (API-et tillater CORS fra alle opphav). */
export async function fetchPayload(
  id: string,
  { h, a, remove, manual }: { h: number; a: number; remove: number; manual: boolean }
): Promise<Payload> {
  const match = await getMatch(id)
  if (!match) throw new Error("Fant ikke kampen")
  const view = buildView(match, { simScore: { home: h, away: a }, manual, removeCount: remove })
  return { match, view }
}

export { listMatches }
