import Image from "next/image"

import { cn } from "@/lib/utils"

type LogoProps = {
  /** "full" viser wordmark, "mark" viser kun stolpene (kollapset meny). */
  variant?: "full" | "mark"
  className?: string
  priority?: boolean
}

/**
 * Tortuga-logoen.
 *
 * To filer i stedet for ett CSS-filter: wordmarken er svart og forsvinner på
 * mørk bakgrunn, men `invert()` ville samtidig snudd de blå stolpene til
 * oransje. Den mørke varianten har hvit wordmark og uendret gradient.
 *
 * Begge lastes; CSS avgjør hvilken som vises. Filene er små (~17 kB) og et
 * bytte som venter på JavaScript ville gitt et synlig glimt av feil logo.
 */
export function Logo({ variant = "full", className, priority }: LogoProps) {
  const light = variant === "full" ? "/tortuga-logo.png" : "/tortuga-mark.png"
  const dark =
    variant === "full" ? "/tortuga-logo-dark.png" : "/tortuga-mark-dark.png"

  const width = variant === "full" ? 609 : 140
  const height = 115

  return (
    <span className={cn("relative inline-block", className)}>
      <Image
        src={light}
        alt="Tortuga"
        width={width}
        height={height}
        priority={priority}
        className="h-full w-auto dark:hidden"
      />
      <Image
        src={dark}
        alt="Tortuga"
        width={width}
        height={height}
        priority={priority}
        className="hidden h-full w-auto dark:block"
      />
    </span>
  )
}
