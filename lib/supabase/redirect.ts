const DEFAULT_REDIRECT = "/meetups";

/** Only allow same-origin relative paths, so `?next=` cannot be used as an open redirect. */
export function safeRedirectPath(value: FormDataEntryValue | string | null | undefined): string {
  if (typeof value !== "string") return DEFAULT_REDIRECT;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return DEFAULT_REDIRECT;
  return value;
}
