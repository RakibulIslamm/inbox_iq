import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export default function BillingLoading() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-8">
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-3 w-64" />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-5 w-12" />
          </div>
          <Skeleton className="mt-3 h-3 w-3/4" />
        </CardHeader>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-4 w-16" />
              <Skeleton className="mt-3 h-8 w-20" />
            </CardHeader>
            <CardContent className="space-y-2">
              {Array.from({ length: 4 }).map((_, j) => (
                <Skeleton key={j} className="h-3 w-3/4" />
              ))}
              <Skeleton className="mt-4 h-8 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
