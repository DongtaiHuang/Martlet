import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CreatorProfileForm } from "@/components/creators/CreatorProfileForm";
import { WorkManager } from "@/components/creators/WorkManager";
import { MartletNav } from "@/components/layout/MartletNav";
import { getMyCreator, isCreatorPreview } from "@/lib/creators";
import { getCurrentUser } from "@/lib/supabase/auth";

export const metadata: Metadata = { title: "Your creator profile · McGill Martlet" };
export const dynamic = "force-dynamic";

export default async function EditCreatorPage() {
  const preview = isCreatorPreview();
  const user = preview ? null : await getCurrentUser().catch(() => null);
  const creator = user ? await getMyCreator() : null;

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <MartletNav />
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-8 sm:py-12">
        <Link href={creator ? `/creators/${creator.user_id}` : "/creators"} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-brand-ink hover:underline">
          <ArrowLeft aria-hidden="true" size={16} /> {creator ? "Your profile" : "Creators"}
        </Link>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight">{creator ? "Edit your creator profile" : "Create your creator profile"}</h1>
        {!user ? (
          <p className="mt-6 rounded-2xl border border-line bg-surface p-6 text-ink-muted">
            {preview ? "Profiles need Supabase. This is a preview." : <><Link href="/login?next=/creators/edit" className="font-bold text-brand-ink underline">Sign in</Link> with your McGill email to share your work.</>}
          </p>
        ) : creator?.status === "removed" ? (
          <p className="mt-6 rounded-2xl border border-warn-line bg-warn-soft p-6 text-warn-ink">A moderator removed your creator profile. You can make a new one 30 days after the removal.</p>
        ) : (
          <>
            <p className="mt-2 text-ink-muted">Students see your display name, this profile and your portfolio. They contact you through private requests, never by email or phone.</p>
            <div className="mt-6"><CreatorProfileForm creator={creator} /></div>
            {creator && (
              <section aria-labelledby="works-heading" className="mt-8">
                <h2 id="works-heading" className="text-xl font-bold">Portfolio</h2>
                <p className="mt-1 text-sm text-ink-muted">Images of your work, links to tracks, repos or videos, or both.</p>
                <div className="mt-4"><WorkManager works={creator.works} /></div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
