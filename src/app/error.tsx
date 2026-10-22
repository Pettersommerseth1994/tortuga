"use client"

import { useEffect } from "react"
import { TriangleAlertIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[app] uhåndtert feil", error)
  }, [error])

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
      <TriangleAlertIcon className="size-8 text-destructive" />
      <h1 className="text-2xl font-semibold tracking-tight">Noe gikk galt</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        Feilen er logget. Prøv igjen — hvis det vedvarer kan dataleverandøren
        være nede.
      </p>
      {error.digest && (
        <code className="rounded bg-muted px-2 py-1 text-xs">{error.digest}</code>
      )}
      <Button onClick={reset} variant="outline">
        Prøv igjen
      </Button>
    </div>
  )
}
