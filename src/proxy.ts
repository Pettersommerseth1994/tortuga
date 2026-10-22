import NextAuth from "next-auth"

import { authConfig } from "@/auth.config"

/**
 * Rutevakt. Het `middleware.ts` fram til Next.js 16, som døpte konvensjonen
 * om til `proxy`. Signaturen er uendret.
 */
export const { auth: proxy } = NextAuth(authConfig)

export default proxy

export const config = {
  // Alt unntatt statiske filer, Auth.js sine egne ruter og cron.
  //
  // /api/cron er unntatt fordi den autentiserer med bearer-token i stedet for
  // sesjon. Uten unntaket ville rutevakten omdirigert cron-kalleren til
  // innloggingssiden, og jobbene ville stille sluttet å kjøre.
  matcher: [
    "/((?!api/auth|api/cron|_next/static|_next/image|favicon.ico|.*\\.png$).*)",
  ],
}
