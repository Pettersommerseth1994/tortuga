import { Logo } from "@/components/logo"

export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center gap-2 md:justify-start">
          <Logo className="h-7" priority />
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </div>

      {/* Panelet er dekor og skjules på små skjermer der plassen trengs. */}
      <div className="relative hidden overflow-hidden bg-muted lg:block">
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-br from-brand-light/25 via-transparent to-brand/30"
        />
        <div className="relative flex h-full flex-col justify-end gap-3 p-12">
          <p className="max-w-md text-balance text-2xl leading-snug font-medium">
            Ni bet etter pause. De fem mest sannsynlige.
          </p>
          <p className="max-w-md text-sm text-muted-foreground">
            Tortuga leser stillingen og statistikken live, regner ut hvilke
            sluttresultater som er mest sannsynlige, og gir deg en sjekkliste.
            Den legger aldri inn bet for deg.
          </p>
        </div>
      </div>
    </div>
  )
}
