"use client"

import { useOptimistic, useTransition } from "react"
import { toast } from "sonner"

import { setPlaced } from "@/lib/actions/matches"
import { cn } from "@/lib/utils"

/** Avkrysning «plassert». Oppdaterer med en gang og ruller tilbake ved feil. */
export function BetCheck({
  betId,
  placed,
  label,
}: {
  betId: string
  placed: boolean
  label: string
}) {
  const [, start] = useTransition()
  const [optimistic, setOptimistic] = useOptimistic(placed)

  return (
    <label className="flex cursor-pointer items-center gap-2">
      <input
        type="checkbox"
        className="size-5 accent-[var(--bull)]"
        checked={optimistic}
        onChange={(e) => {
          const next = e.target.checked
          start(async () => {
            setOptimistic(next)
            const res = await setPlaced(betId, next)
            if (!res.ok) toast.error(res.error)
          })
        }}
        aria-label={label}
      />
      <span className={cn("text-xs", optimistic ? "text-bull" : "text-muted-foreground")}>
        {optimistic ? "Plassert" : "Ikke plassert"}
      </span>
    </label>
  )
}
