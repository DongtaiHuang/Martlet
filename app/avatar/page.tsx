import Link from "next/link";
import { AvatarStudio } from "@/components/avatar/AvatarStudio";
import { MartletNav } from "@/components/layout/MartletNav";
import { getAvatarProgress } from "@/lib/avatar";

export const dynamic = "force-dynamic";

export default async function AvatarPage({ searchParams }: { searchParams: Promise<{ preview?: string }> }) {
  const { preview } = await searchParams;
  const data = await getAvatarProgress({ preview: preview === "1" });

  return (
    <div className="min-h-screen bg-stone-50 text-stone-950">
      <MartletNav />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Your martlet</h1>
            <p className="mt-1 text-stone-600">Your avatar on Martlet. Meetups and landmarks unlock new gear and colours.</p>
          </div>
          <Link href={data?.preview ? "/avatar" : "/avatar?preview=1"} className="inline-flex min-h-11 items-center rounded-xl border border-stone-300 bg-white px-4 text-sm font-bold text-stone-800 hover:border-red-700 focus-visible:outline-2 focus-visible:outline-red-700">
            {data?.preview ? "Show my martlet" : "Preview with everything unlocked"}
          </Link>
        </div>
        {data?.preview && (
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950"><strong>Preview:</strong> sample achievement counts, so every unlock can be tried.</p>
        )}
        <div className="mt-6">
          {data ? <AvatarStudio progress={data.progress} name={data.name} /> : (
            <p className="rounded-2xl border border-stone-200 bg-white p-5"><Link href="/login?next=/avatar" className="font-bold text-red-800 hover:underline">Sign in</Link> to see your martlet.</p>
          )}
        </div>
      </main>
    </div>
  );
}
