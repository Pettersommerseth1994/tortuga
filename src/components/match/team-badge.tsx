import { cn } from "@/lib/utils"

/** Klubbvåpen + navn. Våpenet kommer fra dataleverandøren og kan mangle. */
export function TeamBadge({
  name,
  logo,
  size = 28,
  className,
}: {
  name: string
  logo?: string
  size?: number
  className?: string
}) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2", className)}>
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logo}
          alt=""
          width={size}
          height={size}
          className="shrink-0 object-contain"
          style={{ width: size, height: size }}
        />
      ) : (
        <span
          aria-hidden
          className="grid shrink-0 place-items-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground"
          style={{ width: size, height: size }}
        >
          {name.slice(0, 2).toUpperCase()}
        </span>
      )}
      <span className="truncate font-medium">{name}</span>
    </span>
  )
}
