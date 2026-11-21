import { MartletNav } from "@/components/layout/MartletNav";
export default function ProfilePage() {
  return <div className="min-h-screen bg-neutral-50 text-neutral-900"><MartletNav />
    <main className="mx-auto max-w-3xl px-5 py-10">
      <h1 className="text-3xl font-bold">Student profile</h1>
      <p className="mt-2 text-neutral-600">Developer 1: build signed-in display name and hosted/joined meetup summaries.</p>
    </main></div>;
}
