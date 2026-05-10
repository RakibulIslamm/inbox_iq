/**
 * Resolve a user-facing display name from the strongest available source:
 *   1. profiles.name      (set on signup or via settings later)
 *   2. user_metadata.full_name / name (Google OAuth populates this)
 *   3. local part of the email (before @)
 *   4. "you" (last-resort, only when even email is missing)
 */
export function pickDisplayName(args: {
  profileName: string | null | undefined
  metadataFullName?: string | null | undefined
  email?: string | null | undefined
}): string {
  const profile = args.profileName?.trim()
  if (profile) return profile

  const metadata = args.metadataFullName?.trim()
  if (metadata) return metadata

  if (args.email) {
    const local = args.email.split("@")[0]
    if (local) return local
  }
  return "you"
}
