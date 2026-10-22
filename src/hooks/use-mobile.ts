import * as React from "react"

const MOBILE_BREAKPOINT = 768
const QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(QUERY)
  mql.addEventListener("change", onChange)
  return () => mql.removeEventListener("change", onChange)
}

/**
 * Abonnerer på medieforespørselen via useSyncExternalStore.
 *
 * shadcn sin variant setter state synkront inne i en useEffect, som gir en
 * ekstra render ved hver montering — sidemenyen rendres først som desktop og
 * hopper deretter til mobil. useSyncExternalStore er laget nettopp for å lese
 * fra en ekstern kilde uten det hoppet, og serverøyeblikksbildet gjør at SSR
 * er entydig i stedet for `undefined`.
 */
export function useIsMobile() {
  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    // Serveren har ingen viewport. Desktop er det trygge valget: sidemenyen
    // rendres utvidet, som er riktig for de fleste, og mobilvarianten tar
    // over straks klienten har målt.
    () => false
  )
}
