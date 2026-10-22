import Link from "next/link"

import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
        404
      </p>
      <h1 className="text-2xl font-semibold tracking-tight">Siden finnes ikke</h1>
      <Button asChild variant="outline">
        <Link href="/kamper">Til kampene</Link>
      </Button>
    </div>
  )
}
