import { MartletNav } from "@/components/layout/MartletNav";
export default function MeetupDetailsPage() {
  return <div className="min-h-screen bg-neutral-50 text-neutral-900"><MartletNav />
    <main className="mx-auto max-w-3xl px-5 py-10">
      <h1 className="text-3xl font-bold">Meetup details</h1>
      <p className="mt-2 text-neutral-600">Developer 2: load getMeetup(id), show host and location, and integrate Developer 4's Peck/Flap controls.</p>
    </main></div>;
}
