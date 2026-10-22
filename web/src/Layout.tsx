import { ClipboardCheckIcon, LayersIcon, TrophyIcon } from "lucide-react"
import { useEffect } from "react"
import { Link, NavLink, Outlet, useLocation } from "react-router"

import { ModeToggle } from "@/components/mode-toggle"
import { cn } from "@/lib/utils"

import { useTracked } from "./lib/store"

const base = import.meta.env.BASE_URL

function Logo() {
  return (
    <span className="relative inline-block h-5">
      <img src={`${base}tortuga-logo.png`} alt="Tortuga" className="h-full w-auto dark:hidden" />
      <img src={`${base}tortuga-logo-dark.png`} alt="Tortuga" className="hidden h-full w-auto dark:block" />
    </span>
  )
}

export function Layout() {
  const tracked = useTracked()
  const open = tracked.flatMap((m) => m.bets).filter((b) => !b.placed).length
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  const link = ({ isActive }: { isActive: boolean }) =>
    cn(
      "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
      isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"
    )

  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-4 px-4 md:px-6">
          <Link to="/" aria-label="Tortuga — til kampene">
            <Logo />
          </Link>
          <nav className="flex items-center gap-1">
            <NavLink to="/" end className={link}>
              <TrophyIcon className="size-4" /> Kamper
            </NavLink>
            <NavLink to="/kombi" className={link}>
              <LayersIcon className="size-4" /> Kombinasjoner
            </NavLink>
            <NavLink to="/sjekkliste" className={link}>
              <ClipboardCheckIcon className="size-4" /> Sjekkliste
              {open > 0 && (
                <span className="tabular rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
                  {open}
                </span>
              )}
            </NavLink>
          </nav>
          <div className="ml-auto">
            <ModeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 p-4 md:p-6">
        <Outlet />
      </main>

      <footer className="border-t px-4 py-4 text-center text-xs text-muted-foreground">
        Offentlig versjon uten innlogging. Planene dine lagres bare i denne nettleseren. Spill med
        måte — du kan tape pengene du setter inn. Hjelpelinjen for spilleavhengige: 800 800 40.
      </footer>
    </div>
  )
}
