import type { MatchSummary } from "./types"

/**
 * Norske klubber, slik at kamper med norsk deltakelse kan løftes fram.
 *
 * ESPN oppgir ikke land på lag, så dette er en håndført liste (Eliteserien,
 * OBOS-ligaen og klubber som ofte er i Europa). Navn sammenlignes eksakt etter
 * normalisering — ikke som delstreng — slik at «Mjällby» (Sverige) eller
 * «Nordsjælland» (Danmark) ikke blir feiltolket. Mangler en klubb, legg den til her.
 */
const NORWEGIAN = [
  "bodo glimt",
  "brann",
  "viking",
  "molde",
  "rosenborg",
  "lillestrom",
  "tromso",
  "tromsoe",
  "fredrikstad",
  "sarpsborg 08",
  "sarpsborg",
  "kristiansund",
  "aalesund",
  "aalesunds",
  "ham kam",
  "hamkam",
  "kfum oslo",
  "kfum",
  "sandefjord",
  "valerenga",
  "stromsgodset",
  "haugesund",
  "odd",
  "skeid",
  "start",
  "stabaek",
  "lyn",
  "ranheim",
  "bryne",
  "mjondalen",
  "kongsvinger",
  "sogndal",
  "asane",
  "raufoss",
  "egersund",
  "hodd",
  "moss",
  "levanger",
  "strommen",
  "jerv",
  "arendal",
]

// Klubb-prefikser/suffikser som varierer mellom kilder («SK Brann», «Viking FK»).
const NOISE = new Set(["fk", "sk", "if", "il", "bk", "fc", "fotball", "ik"])

const SET = new Set(NORWEGIAN)

export function normalizeTeamName(name: string): string {
  return name
    .toLowerCase()
    .replace(/ø/g, "o")
    .replace(/æ/g, "ae")
    .replace(/å/g, "a")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

export function isNorwegianTeam(name: string): boolean {
  const norm = normalizeTeamName(name)
  if (SET.has(norm)) return true
  const stripped = norm
    .split(" ")
    .filter((t) => !NOISE.has(t))
    .join(" ")
  return stripped !== "" && SET.has(stripped)
}

export function hasNorwegianTeam(m: Pick<MatchSummary, "home" | "away">): boolean {
  return isNorwegianTeam(m.home.name) || isNorwegianTeam(m.away.name)
}
