import { Ban } from "lucide-react";
import { listMyBlocks } from "@/lib/blocks";
import { UnblockButton } from "./UnblockButton";

const dateFormat = new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Toronto" });

/** The people you've blocked (ADR 0051), with an Unblock button each. Hidden when you've blocked nobody. */
export async function BlockedPeople() {
  const blocks = await listMyBlocks();
  if (!blocks.length) return null;
  return (
    <section aria-labelledby="blocked-heading" className="mt-8 rounded-2xl border border-line bg-surface p-5 shadow-sm">
      <h2 id="blocked-heading" className="flex items-center gap-2 text-lg font-bold"><Ban aria-hidden="true" size={18} className="text-brand-ink" /> Blocked people</h2>
      <p className="mt-1 text-sm text-ink-muted">They can&apos;t message you, and you don&apos;t see their posts, comments, listings or table chat. They aren&apos;t told.</p>
      <ul className="mt-3 divide-y divide-line">
        {blocks.map((b) => (
          <li key={b.user_id} className="flex items-center justify-between gap-3 py-2">
            <span className="min-w-0">
              <span className="block font-semibold [overflow-wrap:anywhere]">{b.name}</span>
              <span className="text-xs text-ink-muted">Blocked {dateFormat.format(new Date(b.created_at))}</span>
            </span>
            <UnblockButton userId={b.user_id} name={b.name} />
          </li>
        ))}
      </ul>
    </section>
  );
}
