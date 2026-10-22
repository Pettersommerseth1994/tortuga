"use client"

import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { Loader2Icon, PlusIcon, XIcon } from "lucide-react"
import { toast } from "sonner"

import { trackMatch, untrackMatch } from "@/lib/actions/matches"
import { Button } from "@/components/ui/button"

export function TrackButton({
  eventId,
  disabled,
  size = "sm",
}: {
  eventId: string
  disabled?: boolean
  size?: "sm" | "xs" | "default"
}) {
  const router = useRouter()
  const [pending, start] = useTransition()

  return (
    <Button
      size={size}
      variant="outline"
      disabled={disabled || pending}
      onClick={() =>
        start(async () => {
          const res = await trackMatch(eventId)
          if (!res.ok) toast.error(res.error)
          else {
            toast.success("Kampen er med i Tortuga.")
            router.refresh()
          }
        })
      }
    >
      {pending ? <Loader2Icon className="animate-spin" /> : <PlusIcon />}
      Ta med
    </Button>
  )
}

export function UntrackButton({ trackedId }: { trackedId: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()

  return (
    <Button
      size="xs"
      variant="ghost"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await untrackMatch(trackedId)
          if (!res.ok) toast.error(res.error)
          else router.refresh()
        })
      }
    >
      {pending ? <Loader2Icon className="animate-spin" /> : <XIcon />}
      Fjern
    </Button>
  )
}
