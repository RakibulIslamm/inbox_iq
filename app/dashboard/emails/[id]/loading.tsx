import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export default function EmailDetailLoading() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-8">
      <Skeleton className="h-3 w-24" />

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <div className="flex flex-col items-end gap-2">
              <Skeleton className="h-3 w-10" />
              <Skeleton className="h-5 w-16" />
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-2 h-3 w-full" />
          <Skeleton className="mt-1 h-3 w-5/6" />
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <Skeleton className="h-4 w-16" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-40 w-full" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-8 w-28" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
