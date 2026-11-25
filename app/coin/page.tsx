import type { Metadata } from "next";
import Link from "next/link";
import { FlaskConical } from "lucide-react";
import { MartletNav } from "@/components/layout/MartletNav";
import { CoinDashboard } from "@/components/coin/CoinDashboard";
import { getCoinSnapshot } from "@/lib/martlet-coin";

export const metadata: Metadata = { title: "Martlet Coin · McGill Martlet" };
export const dynamic = "force-dynamic";

export default async function CoinPage() {
  const snapshot = await getCoinSnapshot("1d");
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <MartletNav />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-8 sm:py-12">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Martlet Coin <span className="text-ink-muted">(MLT)</span></h1>
        <p className="mt-2 max-w-2xl text-ink-muted">
          A trading sim. MLT is a simulated coin, not a cryptocurrency: there’s no blockchain and no real money. You trade it with Martlet points, which have no cash value and can’t be bought or cashed out.
        </p>
        {snapshot?.preview && (
          <p className="mt-4 flex flex-wrap items-center gap-1.5 rounded-xl border border-warn-line bg-warn-soft px-3 py-2 text-sm text-warn-ink">
            <FlaskConical aria-hidden="true" size={15} /><span><strong>Preview:</strong> a sample price chart. Trading needs Supabase.</span>
          </p>
        )}
        <div className="mt-6">
          {snapshot ? <CoinDashboard initial={snapshot} /> : (
            <p className="rounded-xl border border-line bg-surface p-4 text-sm text-ink-muted">
              Martlet Coin isn’t available right now. <Link href="/login?next=%2Fcoin" className="font-semibold text-brand-ink underline">Sign in</Link> with your McGill email to trade.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
