import { redirect } from "next/navigation"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { AppSidebar } from "@/components/app-sidebar"
import { ModeToggle } from "@/components/mode-toggle"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const [openSingles, activeMatches, openComboRows] = await Promise.all([
    db.bet.count({
      where: {
        placed: false,
        trackedMatch: { userId: session.user.id, archivedAt: null },
      },
    }),
    db.trackedMatch.findMany({
      where: { userId: session.user.id, archivedAt: null },
      select: { eventId: true },
    }),
    db.comboBet.findMany({
      where: { userId: session.user.id, placed: false },
      select: { legs: true },
    }),
  ])
  // Kombinasjoner teller bare så lenge alle kampene i dem er aktive (som i sjekklisten).
  const activeIds = new Set(activeMatches.map((m) => m.eventId))
  const openCombos = openComboRows.filter((c) =>
    (c.legs as unknown as { eventId: string }[]).every((l) => activeIds.has(l.eventId))
  ).length
  const openBets = openSingles + openCombos

  return (
    <SidebarProvider>
      <AppSidebar
        user={{ name: session.user.name ?? null, email: session.user.email ?? "" }}
        openBets={openBets}
      />

      <SidebarInset>
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur">
          <SidebarTrigger />
          <Separator orientation="vertical" className="mr-1 h-4" />
          <span className="text-xs text-muted-foreground">
            Spill med måte — du kan tape pengene du setter inn.
          </span>
          <div className="ml-auto flex items-center gap-1">
            <ModeToggle />
          </div>
        </header>

        <div className="mx-auto w-full max-w-6xl flex-1 p-4 md:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
