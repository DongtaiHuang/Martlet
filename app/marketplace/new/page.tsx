import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { MartletNav } from "@/components/layout/MartletNav";
import { ListingForm } from "@/components/marketplace/ListingForm";
import { isMarketplacePreview } from "@/lib/marketplace";
import { getCurrentUser } from "@/lib/supabase/auth";

export const metadata: Metadata = { title: "Post a listing · McGill Martlet" };
export const dynamic = "force-dynamic";

export default async function NewListingPage() {
  const preview = isMarketplacePreview();
  const user = preview ? null : await getCurrentUser().catch(() => null);

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <MartletNav />
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-8 sm:py-12">
        <Link href="/marketplace" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-brand-ink hover:underline"><ArrowLeft aria-hidden="true" size={16} /> Marketplace</Link>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight">Post a listing</h1>
        {user ? <ListingForm /> : (
          <p className="mt-6 rounded-2xl border border-line bg-surface p-6 text-ink-muted">
            {preview ? "Posting needs Supabase. This is a preview." : <><Link href="/login?next=/marketplace/new" className="font-bold text-brand-ink underline">Sign in</Link> with your McGill email to post a listing.</>}
          </p>
        )}
      </main>
    </div>
  );
}
