# Tortuga

Halvtidsbetting på Champions League, Europa League og Conference League. Ved pause tar du ni bet på sluttresultatet, stryker de fire minst sannsynlige og står igjen med fem. Tortuga regner ut hvilke, viser stillingen live og gir deg en sjekkliste du legger inn selv i Oddsen.

Next.js 16 · shadcn/ui · Auth.js · Prisma/Postgres. Hele appen ligger bak innlogging.

## Konseptet

Stillingen er 2–1 til Liverpool mot Napoli i pausen. Hvert lag kan score 0, 1 eller 2 mål til, så sluttresultatet er ett av ni:

|            | Napoli +0 | Napoli +1 | Napoli +2 |
| ---------- | --------- | --------- | --------- |
| **L +0**   | 2–1       | 2–2       | 2–3       |
| **L +1**   | 3–1       | 3–2       | 3–3       |
| **L +2**   | 4–1       | 4–2       | 4–3       |

Tortuga rangerer de ni etter sannsynlighet og markerer de fem beste som «behold». Du kan stryke 3, 4 eller 5 (standard 4 av 9). Maks tre aktive kamper om gangen.

## To typer spill

Hver kamp har to faner, og planene er uavhengige av hverandre:

- **Før kamp.** Sannsynlighet for hvert sluttresultat fra 0–0 til 4–4 (25 ruter). Modellen foreslår de 5, 7, 9 eller 12 mest sannsynlige, og du kan slå enkeltruter av og på selv, for eksempel ta 0–0 ut hvis du mener den er for usannsynlig. Plasseres én gang før avspark; du trenger ikke følge kampen. Forhåndsvurderingen bruker turneringens målsnitt (CL 3,42, EL 2,83, ECL 2,68 mål per kamp).
- **Ved pause.** Ni scenarioer fra pausestillingen, de fem mest sannsynlige beholdes. Dette spillet må følges: du kan skrive inn stillingen selv («Skriv inn stillingen selv») hvis live-feeden henger eller er feil.

**Odds fra bilde.** I betting-planen kan du laste opp (eller lime inn med Cmd/Ctrl+V) skjermbilder av «riktig resultat» fra Oddsen, og oddsfeltene fylles automatisk. Du kan laste opp flere bilder hvis listen er lang. Bildet leses i nettleseren med OCR ([tesseract.js](https://github.com/naptha/tesseract.js)) og sendes ikke noe sted; selve tekstgjenkjenningen (motor og språkdata, ikke bildet) lastes ned fra en CDN første gang, så det trenger nett. Resultat og odds parres etter plassering i bildet, ikke tekstrekkefølge, så de tre kolonnene ikke blandes. Resultater OCR leser feil («1-1» → «iil») leses på nytt rute for rute. Tortuga sjekker at lagnavnene står i bildet og snur resultatene hvis lagene står i motsatt rekkefølge. Funn vises under knappen, med liste over alt som ble lest, så du kan kontrollere. OCR kan ta feil, så sjekk tallene før du spiller.

**Odds huskes.** Odds (innskrevne og lest fra bilde), budsjett og valgt fordeling lagres automatisk per kamp og per spilletype, så de overlever faneskifte, omlasting og at du kommer tilbake senere. «Tøm odds» sletter dem. Utkastet ligger i nettleseren (`localStorage`, se [`plan-draft.ts`](src/lib/plan-draft.ts)) og følger ikke med til andre enheter; det er først når du låser planen at bettene (med odds) havner i sjekklisten og databasen.

**Kombinasjoner (dobbel/trippel).** Siden «Kombinasjoner» slår sammen to eller tre av kampene dine: ett sluttresultat per kamp, og alle må treffe. Oddsene hentes fra det du har lagt inn eller lest fra bilde på hver kamp (valgt spilletype). Oddsen *ganges* (8,00 × 7,65 = 61,20), men det gjør sannsynligheten og bookmakerens margin også: verdi (sannsynlighet × odds) er produktet av benenes verdi. To ben på 0,96 og 0,84 gir en kombinasjon på 0,81. Tommelregel: å legge til et ben hjelper bare hvis benet selv har verdi over 1. Siden rangerer alle kombinasjoner etter verdi eller sannsynlighet, sammenligner med beste enkeltbet, og fordeler innsatsen (lik utbetaling eller Kelly) over de beste. Hver kamp ender med ett resultat, så høyst én kombinasjon kan treffe, og samme innsatsformler som for enkeltbet gjelder. Forutsetter at kampene er uavhengige, og at Oddsen tillater å kombinere «riktig resultat» på tvers av kamper (sjekk det). «Lås kombinasjonene» legger dem i sjekklisten (egen seksjon «Kombinasjoner», gruppert per sett kamper) med plassert-avkryssing. Som for enkeltbet røres plasserte kombinasjoner ikke ved ny låsing; resten av samme kamper og spilletype erstattes. Kombinasjonene vises så lenge alle kampene i dem er aktive. Lokalt ligger de i databasen (`ComboBet`), på Pages i nettleseren.

**Fordeling av innsatsen.** Du velger mellom to måter å fordele budsjettet på:

- **Lik utbetaling** (standard): innsats ∝ 1/odds, slik at alle treff gir omtrent samme utbetaling. Jevnest mulig, men tar ikke hensyn til hvilke odds som er gode.
- **Verdi (Kelly):** Kelly-kriteriet for gjensidig utelukkende utfall ([`kellyPlan`](src/lib/model/stakes.ts)). Det fordelingen som maksimerer forventet vekst, gitt modellens sannsynligheter. Utfall rangeres etter modell × odds, og det satses bare der den er høyere enn «reserven» (til å begynne med 1), mest der fordelen er størst. Budsjettet regnes som banken for kampen, så mer enn det satses aldri, og det som ikke trengs beholdes. Standard er halv Kelly (¼, ½ eller full kan velges), siden fullt Kelly forutsetter at modellen har rett. Finnes det ingen resultater med modell × odds over 1, anbefaler Kelly å ikke spille, og Tortuga sier det rett ut. Testene viser at ingen justering av fordelingen slår Kelly på forventet vekst.

Sjekklisten viser de to typene hver for seg, og advarer hvis avspark er gått uten at alle førkampsbettene er plassert.

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

**Kalibrering mot historikk.** Konstantene er målt, ikke gjettet: på 1 249 kamper i CL, EL og ECL (feb. 2024 – okt. 2026, 90 minutter) er snittet 1,74 mål hjemme og 1,26 borte, 56,0 % av målene faller i 2. omgang, og kun 4,7 % av kampene ender 0–0. Poisson-modellen treffer fordelingen godt, også de ni rutene etter pause. Reproduser tallene med `node scripts/historical-stats.mjs`.

Ærlig om begrensningene: dette er en enkel modell. Den rangerer scenarioene fornuftig, men bookmakerne har mer informasjon (skade, oppstilling, skuddposisjon) og slår den på odds. Å fordele bet over de mest sannsynlige resultatene gir ikke positiv forventning av seg selv. Det avhenger av om oddsene i Oddsen er høyere enn modellens sannsynlighet tilsier. Legg inn oddsene fra Oddsen i betting-planen: Tortuga viser da om Σ(1/odds) er under 1,00 (først da kan et treff gi overskudd) og fordeler innsatsen så alle treff gir omtrent lik utbetaling.

Åpner du en ferdig kamp, kjører modellen på pausestillingen og viser om sluttresultatet var blant de beholdte. Ikke-startede kamper har en hva-om-simulering der du velger pausestillingen selv.

## Norske lag

Kamplisten har et eget felt, «Norske lag», med alle kamper der et norsk lag spiller, og et turneringsfilter (Alle / CL / EL / ECL). Norske lag får flagg i listene. ESPN oppgir ikke land på lag, så klubbene står i en håndført liste i [`norway.ts`](src/lib/football/norway.ts). Navn sammenlignes eksakt (ikke som delstreng), så «Mjällby» eller «Nordsjælland» ikke tas for norske. Mangler en klubb, legg den til i listen.

## Datakilde

[`src/lib/football/espn.ts`](src/lib/football/espn.ts) bruker ESPNs åpne, nøkkelfrie fotball-API: terminliste, live-stilling, lagstatistikk, form, tabell og odds for Champions League, Europa League og Conference League. Turneringene er listet i `COMPETITIONS`; flere kan legges til der. Det er **uoffisielt og udokumentert**. Formatet kan endre seg, og bruksvilkårene er ikke ment for kommersiell bruk. Parseren feiler mykt (manglende felt gir tomme verdier). All ESPN-kunnskap er isolert i den ene filen mot `types.ts`, så leverandøren kan byttes til f.eks. API-Football uten å røre resten.

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
