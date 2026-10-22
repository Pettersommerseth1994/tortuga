"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { requireUserId } from "@/lib/auth"
import { db } from "@/lib/db"
import { comboSetKey, comboSignature } from "@/lib/model/combos"

import type { Result } from "./matches"

const schema = z.object({
  kind: z.enum(["pre", "ht"]),
  combos: z
    .array(
      z.object({
        legs: z
          .array(
            z.object({
              eventId: z.string().min(1).max(40),
              home: z.number().int().min(0).max(30),
              away: z.number().int().min(0).max(30),
            })
          )
          .min(2)
          .max(3),
        probability: z.number().min(0).max(1),
        odds: z.number().gt(1).max(1_000_000),
        stake: z.number().int().min(1).max(1_000_000),
      })
    )
    .min(1)
    .max(15),
})

/**
 * Låser kombinasjoner til sjekklisten. Samme regel som for enkeltbet: plasserte røres ikke,
 * ikke-plasserte av samme sett kamper og spilletype erstattes. Kampene må være blant dine
 * aktive, og navnene hentes fra dem — ikke fra klienten.
 */
export async function lockCombos(input: z.input<typeof schema>): Promise<Result> {
  const userId = await requireUserId()
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Ugyldig kombinasjon." }
  const { kind, combos } = parsed.data

  if (combos.some((c) => new Set(c.legs.map((l) => l.eventId)).size !== c.legs.length)) {
    return { ok: false, error: "En kombinasjon kan ikke ha samme kamp to ganger." }
  }

  const active = await db.trackedMatch.findMany({ where: { userId, archivedAt: null } })
  const byEvent = new Map(active.map((t) => [t.eventId, t]))
  if (combos.some((c) => c.legs.some((l) => !byEvent.has(l.eventId)))) {
    return { ok: false, error: "Alle kampene må være blant dine aktive kamper." }
  }

  const placed = await db.comboBet.findMany({
    where: { userId, kind, placed: true },
    select: { signature: true },
  })
  const placedSignatures = new Set(placed.map((p) => p.signature))
  const sets = [...new Set(combos.map((c) => comboSetKey(c.legs)))]

  const rows = combos
    .filter((c) => !placedSignatures.has(comboSignature(c.legs)))
    .map((c) => ({
      userId,
      kind,
      legs: c.legs.map((l) => ({
        eventId: l.eventId,
        homeName: byEvent.get(l.eventId)!.homeName,
        awayName: byEvent.get(l.eventId)!.awayName,
        home: l.home,
        away: l.away,
      })),
      setKey: comboSetKey(c.legs),
      signature: comboSignature(c.legs),
      probability: c.probability,
      odds: c.odds,
      stake: c.stake,
    }))

  await db.$transaction([
    db.comboBet.deleteMany({ where: { userId, kind, placed: false, setKey: { in: sets } } }),
    db.comboBet.createMany({ data: rows, skipDuplicates: true }),
  ])

  revalidatePath("/sjekkliste")
  revalidatePath("/kombi")
  return { ok: true }
}

export async function setComboPlaced(id: string, placed: boolean): Promise<Result> {
  const userId = await requireUserId()
  const res = await db.comboBet.updateMany({
    where: { id, userId },
    data: { placed, placedAt: placed ? new Date() : null },
  })
  if (res.count === 0) return { ok: false, error: "Fant ikke kombinasjonen." }
  revalidatePath("/sjekkliste")
  return { ok: true }
}
