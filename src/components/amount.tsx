import { formatKr } from "@/lib/format"
import { cn } from "@/lib/utils"

/** Beløp med fortegn og farge: gevinst mørkegrønn med +, tap rød med minus. */
export function Amount({ value }: { value: number }) {
  const v = Math.round(value)
  return (
    <span
      className={cn(
        "tabular font-semibold",
        v > 0 && "text-green-700 dark:text-green-400",
        v < 0 && "text-bear"
      )}
    >
      {v > 0 ? "+" : v < 0 ? "−" : ""}
      {formatKr(Math.abs(v))}
    </span>
  )
}
