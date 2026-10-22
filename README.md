# Tortuga

Halvtidsbetting på Champions League. Ved pause tar du ni bet på sluttresultatet, stryker de fire minst sannsynlige og står igjen med fem. Tortuga regner ut hvilke, viser stillingen live og gir deg en sjekkliste du legger inn selv i Oddsen.

Next.js 16 · shadcn/ui · Auth.js · Prisma/Postgres. Hele appen ligger bak innlogging.

## Konseptet

Stillingen er 2–1 til Liverpool mot Napoli i pausen. Hvert lag kan score 0, 1 eller 2 mål til, så sluttresultatet er ett av ni:

|            | Napoli +0 | Napoli +1 | Napoli +2 |
| ---------- | --------- | --------- | --------- |
| **L +0**   | 2–1       | 2–2       | 2–3       |
| **L +1**   | 3–1       | 3–2       | 3–3       |
| **L +2**   | 4–1       | 4–2       | 4–3       |

Tortuga rangerer de ni etter sannsynlighet og markerer de fem beste som «behold». Du kan stryke 3, 4 eller 5 (standard 4 av 9). Maks tre aktive kamper om gangen.

## Kom i gang (lokalt på Mac-en)

Krever Node 20+. Appen kjører helt lokalt, uten Vercel eller Neon, og data ligger i `.postgres-data/`.

Førstegangsoppsett:

```bash
npm install
cp .env.example .env            # fyll inn AUTH_SECRET:  openssl rand -base64 32
```

Start databasen én gang i en egen terminal, lag tabellene og brukeren din, og avslutt den igjen med Ctrl-C:

```bash
npm run db:start                # terminal 1
npm run db:push                 # terminal 2
npm run user:create -- deg@epost.no "Ditt Navn"   # spør om passord (minst 8 tegn)
```

Deretter, hver gang du vil bruke Tortuga:

```bash
npm run tortuga                 # database + app på http://localhost:3000
HOST=0.0.0.0 npm run tortuga    # også fra telefonen din på samme wifi
```

`npm run dev` er for utvikling (hot reload, krever at `npm run db:start` kjører).

Det finnes ingen åpen registrering. `user:create` er eneste vei inn, og kan også brukes til å bytte passord.

```bash
npm test          # modell og visningslogikk
npm run typecheck
npm run lint
```

## Slik fungerer analysen

Koden ligger i [`src/lib/model`](src/lib/model). Mål modelleres som uavhengige Poisson-prosesser.

1. **Forhåndsvurdering.** Forventede mål per lag over 90 minutter. Hvis ESPN har bookmaker-odds, fjernes marginen, og vi finner de målratene som gir samme H/U/B-sannsynligheter (og total-linje, hvis den finnes). Uten odds brukes siste kamper (mål for/mot), trukket mot Champions League-snittet.
2. **Live-justering.** Skuddstatistikken gjøres om til en grov xG (`skudd på mål × 0,30 + blokkerte × 0,05 + øvrige × 0,04`) og veies mot forhåndsvurderingen. Et lag som har skapt mer enn forventet får høyere rate, og omvendt.
3. **Tid igjen.** Rundt 54 % av målene kommer i 2. omgang. Raten skaleres med andelen av kampens mål som gjenstår, så analysen oppdateres hvert 15. sekund også etter pause.
4. **Kamptilstand og røde kort.** Laget som ligger under presser litt mer; rødt kort senker eget lag og hever motstanderen.
5. **Ni scenarioer.** `P(i mål til) × P(j mål til)` for i, j ∈ {0,1,2}. De fem mest sannsynlige beholdes. Hver rute har en tekstbegrunnelse.

Ærlig om begrensningene: dette er en enkel modell. Den rangerer scenarioene fornuftig, men bookmakerne har mer informasjon (skade, oppstilling, skuddposisjon) og slår den på odds. Å fordele bet over de mest sannsynlige resultatene gir ikke positiv forventning av seg selv. Det avhenger av om oddsene i Oddsen er høyere enn modellens sannsynlighet tilsier. Legg inn oddsene fra Oddsen i betting-planen: Tortuga viser da om Σ(1/odds) er under 1,00 (først da kan et treff gi overskudd) og fordeler innsatsen så alle treff gir omtrent lik utbetaling.

Åpner du en ferdig kamp, kjører modellen på pausestillingen og viser om sluttresultatet var blant de beholdte. Ikke-startede kamper har en hva-om-simulering der du velger pausestillingen selv.

## Datakilde

[`src/lib/football/espn.ts`](src/lib/football/espn.ts) bruker ESPNs åpne, nøkkelfrie fotball-API: terminliste, live-stilling, lagstatistikk, form, tabell og odds. Det er **uoffisielt og udokumentert**. Formatet kan endre seg, og bruksvilkårene er ikke ment for kommersiell bruk. Parseren feiler mykt (manglende felt gir tomme verdier). All ESPN-kunnskap er isolert i den ene filen mot `types.ts`, så leverandøren kan byttes til f.eks. API-Football uten å røre resten.

Live-banen (pågående kamp) er testet mot enhetstester og mot ferdige kamper, men ikke mot en faktisk pågående kamp i utviklingen. Kontroller at stilling, minutt og statistikk stemmer første gang du bruker den live.

## Norsk Tipping

Tortuga legger **ikke** inn bet for deg, og det er bevisst:

- Norsk Tipping har ikke noe offentlig API for å plassere spill. Innlogging krever BankID.
- Å automatisere innlogging og spillkjøp med nettleserstyring bryter etter alt å dømme vilkårene deres, og kan få kontoen stengt.
- Penger går ut av kontoen din. Det skal være et bevisst valg hver gang.

I stedet er flyten gjort så rask som mulig: **Sjekklisten** viser nøyaktig hvilke resultater du skal spille og hvor mye. «Kopier» legger planen på utklippstavlen, «Åpne Oddsen» går rett til tjenesten, og du krysser av når hvert bet er plassert. Tips:

- Ha Norsk Tipping-appen og Tortuga åpne ved siden av hverandre på telefonen (Tortuga fungerer som webapp: «Legg til på Hjem-skjerm»).
- Sett tapsgrense og spillepauser i Norsk Tipping selv. De gjelder uansett hva Tortuga foreslår.
- Sjekk i Oddsen at «riktig resultat» finnes for kampen og at spillet er live-åpent. Ikke alle sluttresultater (f.eks. 4–3) tilbys alltid.

## Offentlig versjon på GitHub Pages

Repoet er offentlig, og [`web/`](web) er en **statisk** versjon som publiseres automatisk til GitHub Pages ved hver push til `main` (workflow: [`pages.yml`](.github/workflows/pages.yml)).

Forskjellen fra den lokale appen:

|                      | Lokal app (`npm run tortuga`) | Pages (`web/`)                     |
| -------------------- | ----------------------------- | ---------------------------------- |
| Innlogging           | Ja                            | **Nei — åpen for alle**            |
| Planer og sjekkliste | Database på Mac-en            | `localStorage` i din nettleser     |
| Kampdata             | Server henter fra ESPN        | Nettleseren henter direkte fra ESPN |
| Modell, UI, analyse  | Samme kode                    | Samme kode                         |

Siden er åpen, men planene dine ligger bare i din egen nettleser og kan ikke sees av andre. Tømmer du nettleserdata, forsvinner de.

```bash
npm run dev:web      # lokal utviklingsserver for Pages-versjonen
npm run build:web    # bygger til web/dist
```

Samme ESPN-forbehold som over gjelder: API-et er uoffisielt, og nettleseren din kaller det direkte.

## Drift av den lokale appen i produksjon (valgfritt)

Ikke nødvendig for lokal bruk. Skal du senere ha appen tilgjengelig fra mobilnett, trenger den en server (ikke GitHub Pages, som bare kan hoste statiske filer):

1. Postgres hos f.eks. Neon eller Supabase. Sett `DATABASE_URL`.
2. Sett `AUTH_SECRET` (og `AUTH_URL` hvis du står bak proxy).
3. Deploy til Vercel (`npm run build` kjører `prisma generate`). Kjør `npx prisma db push` mot produksjonsdatabasen én gang, og `npm run user:create` for å lage brukeren din.
4. `npm run db:start` er kun for lokal utvikling. Aldri bruk den i produksjon.

## Spill med måte

Du kan tape pengene du setter inn. Trenger du hjelp: Hjelpelinjen for spilleavhengige, 800 800 40.
