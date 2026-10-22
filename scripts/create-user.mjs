/**
 * Oppretter (eller oppdaterer passordet til) en bruker. Appen har ingen
 * åpen registrering — dette er eneste vei inn.
 *
 *   npm run user:create -- deg@epost.no "Ditt Navn"
 *
 * Passordet spørres om interaktivt så det ikke havner i shell-historikken.
 * Sett TORTUGA_PASSWORD for ikke-interaktiv bruk (CI, engangsoppsett).
 */
import { createInterface } from "node:readline/promises"
import { stdin, stdout } from "node:process"
import bcrypt from "bcryptjs"
import { PrismaClient } from "@prisma/client"

const [email, name] = process.argv.slice(2)
if (!email) {
  console.error('Bruk: npm run user:create -- <epost> ["Navn"]')
  process.exit(1)
}

let password = process.env.TORTUGA_PASSWORD
if (!password) {
  const rl = createInterface({ input: stdin, output: stdout })
  password = await rl.question("Passord (minst 12 tegn): ")
  rl.close()
}
if (password.length < 12) {
  console.error("Passordet må ha minst 12 tegn.")
  process.exit(1)
}

const db = new PrismaClient()
const passwordHash = await bcrypt.hash(password, 12)
const user = await db.user.upsert({
  where: { email: email.toLowerCase() },
  update: { passwordHash, ...(name ? { name } : {}) },
  create: { email: email.toLowerCase(), name: name ?? null, passwordHash },
})
console.log(`Bruker klar: ${user.email}`)
await db.$disconnect()
