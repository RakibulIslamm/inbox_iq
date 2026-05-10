"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { toggleActionDone } from "@/app/actions/action-done"

export function ActionDoneCheckbox({
  emailId,
  initialDone,
  label,
}: {
  emailId: number
  initialDone: boolean
  label: string
}) {
  const [done, setDone] = useState(initialDone)
  const [pending, startTransition] = useTransition()

  function onToggle(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.checked
    setDone(next)
    startTransition(async () => {
      const res = await toggleActionDone({ emailId, done: next })
      if (!res.ok) {
        setDone(!next)
        toast.error("Couldn't save.", { description: res.error })
      }
    })
  }

  return (
    <input
      type="checkbox"
      checked={done}
      disabled={pending}
      onChange={onToggle}
      onClick={(e) => e.stopPropagation()}
      className="mt-0.5 size-3.5 shrink-0 cursor-pointer disabled:cursor-not-allowed"
      aria-label={`Mark "${label}" as done`}
    />
  )
}
