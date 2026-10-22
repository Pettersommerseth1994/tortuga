import NextAuth, { CredentialsSignin } from "next-auth"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { z } from "zod"

import { authConfig } from "@/auth.config"
import { db } from "@/lib/db"

class InvalidCredentials extends CredentialsSignin {
  code = "invalid_credentials"
}

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 7 },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw)
        if (!parsed.success) throw new InvalidCredentials()

        const { email, password } = parsed.data
        const user = await db.user.findUnique({
          where: { email: email.toLowerCase() },
        })

        // Hashsammenligningen kjøres også når brukeren ikke finnes, slik at
        // svartiden ikke røper hvilke e-postadresser som er registrert.
        const hash =
          user?.passwordHash ??
          "$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin"
        const ok = await bcrypt.compare(password, hash)
        if (!user || !ok) throw new InvalidCredentials()

        return { id: user.id, email: user.email, name: user.name }
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      if (user?.id) token.sub = user.id
      return token
    },
    async session({ session, token }) {
      if (token.sub) session.user.id = token.sub
      return session
    },
  },
})

/** Innlogget bruker-ID, eller kaster. Aldri en ID sendt inn fra klienten. */
export async function requireUserId(): Promise<string> {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Ikke innlogget")
  return session.user.id
}
