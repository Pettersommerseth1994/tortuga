"use client"

import { useOptimistic, useTransition } from "react"
import { toast } from "sonner"

import { setComboPlaced } from "@/lib/actions/combos"
import { cn } from "@/lib/utils"

/** Avkrysning «plassert» for en kombinasjon. Oppdaterer med en gang og ruller tilbake ved feil. */
export function ComboCheck({ comboId, placed, label }: { comboId: string; placed: boolean; label: string }) {
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
            const res = await setComboPlaced(comboId, next)
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
