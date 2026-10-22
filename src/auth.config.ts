import type { NextAuthConfig } from "next-auth"

/**
 * Edge-trygg del av auth-konfigurasjonen.
 *
 * Proxy-laget kjører på Edge-runtime, som ikke har Node-kryptobiblioteker.
 * Derfor er providers tom her og fylles i lib/auth.ts, som kjører på Node.
 * Denne filen inneholder kun rutevakten: hele appen ligger bak innlogging
 * bortsett fra selve innloggingssiden.
 */

const PUBLIC_ROUTES = ["/login"]

export const authConfig = {
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = Boolean(auth?.user)
      const { pathname } = request.nextUrl

      const isPublic = PUBLIC_ROUTES.some(
        (route) => pathname === route || pathname.startsWith(`${route}/`)
      )

      if (isLoggedIn && pathname === "/login") {
        return Response.redirect(new URL("/kamper", request.nextUrl))
      }

      if (isPublic) return true
      return isLoggedIn
    },
  },
} satisfies NextAuthConfig
