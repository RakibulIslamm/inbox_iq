import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export default function TodayLoading() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-8">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-3 w-20" />
      </div>

      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="border border-border px-3 py-3">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-2 h-7 w-10" />
          </div>
        ))}
      </div>

      <Card>
        <CardHeader>
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-3 h-3 w-full" />
          <Skeleton className="mt-2 h-3 w-5/6" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-44" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <Skeleton className="h-4 w-40" />
          <Skeleton className="mt-2 h-3 w-3/4" />
        </CardHeader>
        <CardContent className="space-y-3 px-0">
          <ul className="divide-y divide-border border-y border-border">
            {Array.from({ length: 3 }).map((_, i) => (
              <li key={i} className="px-4 py-3">
                <div className="space-y-2">
                  <Skeleton className="h-3 w-1/3" />
                  <Skeleton className="h-3 w-2/3" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
