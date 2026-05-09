// Shared util used by EmailPanel (desktop) and ResourceCard (mobile inline view)
// to copy a draft email body to the clipboard.

export async function copyDraftEmail(draftEmail: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(draftEmail);
  } catch {
    // Clipboard API may be blocked in non-secure contexts; degrade silently.
  }
}
