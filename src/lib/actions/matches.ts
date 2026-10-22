"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { requireUserId } from "@/lib/auth"
import { db } from "@/lib/db"
import { getMatch } from "@/lib/football/espn"
import { MAX_ACTIVE_MATCHES } from "@/lib/limits"

export type Result = { ok: true } | { ok: false; error: string }

function refresh() {
  revalidatePath("/kamper")
  revalidatePath("/sjekkliste")
}

/** Tar en kamp med i Tortuga. Maks tre aktive om gangen. */
export async function trackMatch(eventId: string): Promise<Result> {
  const userId = await requireUserId()

  const existing = await db.trackedMatch.findUnique({
    where: { userId_eventId: { userId, eventId } },
  })
  if (existing && !existing.archivedAt) return { ok: true }

  const active = await db.trackedMatch.count({ where: { userId, archivedAt: null } })
  if (active >= MAX_ACTIVE_MATCHES) {
    return {
      ok: false,
      error: `Du har allerede ${MAX_ACTIVE_MATCHES} aktive kamper. Fjern én først.`,
    }
  }

  const match = await getMatch(eventId)
  if (!match) return { ok: false, error: "Fant ikke kampen hos dataleverandøren." }
  if (match.status === "finished") {
    return { ok: false, error: "Kampen er allerede ferdig." }
  }

  await db.trackedMatch.upsert({
    where: { userId_eventId: { userId, eventId } },
    update: { archivedAt: null },
    create: {
      userId,
      eventId,
      homeName: match.home.name,
      awayName: match.away.name,
      kickoff: new Date(match.kickoff),
    },
  })

  refresh()
  return { ok: true }
}

/** Frigjør plassen. Bettene beholdes i historikken (arkivert, ikke slettet). */
export async function untrackMatch(trackedId: string): Promise<Result> {
  const userId = await requireUserId()
  const res = await db.trackedMatch.updateMany({
    where: { id: trackedId, userId },
    data: { archivedAt: new Date() },
  })
  if (res.count === 0) return { ok: false, error: "Fant ikke kampen." }
  refresh()
  return { ok: true }
}

const lockSchema = z.object({
  trackedId: z.string().min(1),
  score: z.string().regex(/^\d{1,2}-\d{1,2}$/),
  legs: z
    .array(
      z.object({
        homeGoals: z.number().int().min(0).max(30),
        awayGoals: z.number().int().min(0).max(30),
        probability: z.number().min(0).max(1),
        odds: z.number().gt(1).max(10000).nullable(),
        stake: z.number().int().min(0).max(1_000_000).nullable(),
      })
    )
    .min(1)
    .max(9),
})

/**
 * Låser planen: lagrer de beholdte scenarioene som en sjekkliste. Allerede
 * plasserte bet røres ikke; resten erstattes.
 */
export async function lockPlan(input: z.input<typeof lockSchema>): Promise<Result> {
  const userId = await requireUserId()
  const parsed = lockSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Ugyldig plan." }
  const { trackedId, score, legs } = parsed.data

  const tracked = await db.trackedMatch.findFirst({
    where: { id: trackedId, userId, archivedAt: null },
  })
  if (!tracked) return { ok: false, error: "Kampen er ikke blant dine aktive kamper." }

  const placed = await db.bet.findMany({ where: { trackedMatchId: trackedId, placed: true } })
  const placedKeys = new Set(placed.map((b) => `${b.homeGoals}-${b.awayGoals}`))

  await db.$transaction([
    db.bet.deleteMany({ where: { trackedMatchId: trackedId, placed: false } }),
    db.bet.createMany({
      data: legs
        .filter((l) => !placedKeys.has(`${l.homeGoals}-${l.awayGoals}`))
        .map((l) => ({ ...l, trackedMatchId: trackedId })),
    }),
    db.trackedMatch.update({
      where: { id: trackedId },
      data: { lockedAt: new Date(), lockedScore: score },
    }),
  ])

  refresh()
  return { ok: true }
}

export async function setPlaced(betId: string, placed: boolean): Promise<Result> {
  const userId = await requireUserId()
  const res = await db.bet.updateMany({
    where: { id: betId, trackedMatch: { userId } },
    data: { placed, placedAt: placed ? new Date() : null },
  })
  if (res.count === 0) return { ok: false, error: "Fant ikke betten." }
  revalidatePath("/sjekkliste")
  return { ok: true }
}
