import { cn } from "@/lib/utils"

export function Stat({
  label,
  value,
  className,
}: {
  label: string
  value: number | string
  className?: string
}) {
  return (
    <div className={cn("border border-border px-3 py-3", className)}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-medium tabular-nums">{value}</p>
    </div>
  )
}
