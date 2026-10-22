import { PrismaClient } from "@prisma/client"

// Next.js i dev laster moduler på nytt ved hver endring; uten denne globalen
// lekker det én tilkoblingspool per reload.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  })

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db
