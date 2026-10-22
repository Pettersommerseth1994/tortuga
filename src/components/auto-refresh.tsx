"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"

/** Henter serverdata på nytt jevnlig, så stillinger i listen holder seg live. */
export function AutoRefresh({ seconds = 30 }: { seconds?: number }) {
  const router = useRouter()
  useEffect(() => {
    const id = setInterval(() => router.refresh(), seconds * 1000)
    return () => clearInterval(id)
  }, [router, seconds])
  return null
}
