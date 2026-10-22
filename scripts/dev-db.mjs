/**
 * Lokal Postgres for utvikling — uten Docker, uten sudo.
 *
 * KUN FOR UTVIKLING. I produksjon skal du bruke en ordentlig Postgres
 * (managed hos Neon/Supabase, eller egen server). Se README.
 *
 * Kjør:  npm run db:start
 * Stopp: Ctrl-C
 */
import EmbeddedPostgres from "embedded-postgres"
import { mkdirSync } from "node:fs"
import { resolve } from "node:path"
import pg from "pg"

const { Client } = pg

const DATA_DIR = resolve(process.cwd(), ".postgres-data")
const PORT = 5432
const USER = "postgres"
const PASSWORD = "tortuga"
const DATABASE = "tortuga"

mkdirSync(DATA_DIR, { recursive: true })

const server = new EmbeddedPostgres({
  databaseDir: DATA_DIR,
  user: USER,
  password: PASSWORD,
  port: PORT,
  persistent: true,
})

// initialise() feiler hvis datakatalogen allerede er satt opp. Det er den
// normale tilstanden fra andre oppstart og framover, så det er ikke en feil.
try {
  await server.initialise()
  console.log("Datakatalog opprettet.")
} catch {
  console.log("Datakatalog finnes fra før — hopper over initialisering.")
}

await server.start()
console.log(`Postgres kjører på localhost:${PORT}`)

/*
 * Databasen opprettes eksplisitt med UTF8.
 *
 * initdb i denne pakken lager klyngen med SQL_ASCII. Byte går riktig gjennom
 * der også, men sortering og upper()/lower() på æøå blir feil — og det ville
 * avvike fra produksjon, som kjører UTF8. Slike forskjeller gir feil som bare
 * oppstår i produksjon. TEMPLATE template0 er det som gjør at en UTF8-database
 * kan lages i en SQL_ASCII-klynge.
 */
const admin = new Client({
  host: "localhost",
  port: PORT,
  user: USER,
  password: PASSWORD,
  database: "postgres",
})
await admin.connect()

const { rows } = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [
  DATABASE,
])

if (rows.length === 0) {
  await admin.query(
    `CREATE DATABASE "${DATABASE}" WITH ENCODING 'UTF8' TEMPLATE template0 LC_COLLATE 'C' LC_CTYPE 'C'`
  )
  console.log(`Database "${DATABASE}" opprettet (UTF8).`)
} else {
  console.log(`Database "${DATABASE}" finnes fra før.`)
}

await admin.end()

console.log(
  `\nDATABASE_URL="postgresql://${USER}:${PASSWORD}@localhost:${PORT}/${DATABASE}?schema=public"\n`
)
console.log("Ctrl-C for å stoppe.")

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, async () => {
    console.log("\nStopper Postgres …")
    await server.stop()
    process.exit(0)
  })
}
