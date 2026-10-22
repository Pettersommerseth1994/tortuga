import { NextResponse } from "next/server"

import { auth } from "@/lib/auth"
import { getMatch } from "@/lib/football/espn"
import { buildView } from "@/lib/match-view"

function intParam(v: string | null, max: number): number | undefined {
  if (v === null) return undefined
  const n = Number.parseInt(v, 10)
  return Number.isFinite(n) && n >= 0 && n <= max ? n : undefined
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await auth())?.user) {
    return NextResponse.json({ error: "Ikke innlogget" }, { status: 401 })
  }

  const { id } = await params
  const match = await getMatch(id)
  if (!match) return NextResponse.json({ error: "Fant ikke kampen" }, { status: 404 })

  const sp = new URL(req.url).searchParams
  const h = intParam(sp.get("h"), 20)
  const a = intParam(sp.get("a"), 20)
  const remove = intParam(sp.get("remove"), 8)

  const view = buildView(match, {
    simScore: h !== undefined && a !== undefined ? { home: h, away: a } : undefined,
    removeCount: remove,
  })

  return NextResponse.json(
    { match, view },
    { headers: { "cache-control": "no-store" } }
  )
}
