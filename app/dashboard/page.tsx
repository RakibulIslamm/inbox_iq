import { Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export default function DashboardPage() {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Connect your Gmail</CardTitle>
            <CardDescription>
              InboxIQ needs read access to triage your inbox. We never store
              your raw email content longer than necessary.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Once connected we&apos;ll fetch your most recent 50 emails,
              categorize them, score urgency, and surface action items.
            </p>
          </CardContent>
          <CardFooter>
            <Button disabled className="w-full">
              <Mail className="size-3.5" />
              Connect Gmail (coming soon)
            </Button>
          </CardFooter>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Phase 2 will wire up Gmail OAuth and email ingestion.
        </p>
      </div>
    </div>
  )
}
