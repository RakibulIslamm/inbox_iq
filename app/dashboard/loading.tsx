import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export default function DashboardLoading() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-8">
      <Card>
        <CardHeader>
          <Skeleton className="h-4 w-40" />
          <Skeleton className="mt-2 h-3 w-3/4" />
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-3 w-48" />
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-1.5">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-6 w-16" />
        ))}
      </div>

      <Card>
        <CardHeader>
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-2 h-3 w-48" />
        </CardHeader>
        <CardContent className="space-y-3 px-0">
          <ul className="divide-y divide-border border-y border-border">
            {Array.from({ length: 6 }).map((_, i) => (
              <li key={i} className="space-y-2 px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3 w-1/3" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                  <Skeleton className="h-5 w-16" />
                </div>
                <Skeleton className="h-3 w-full" />
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
