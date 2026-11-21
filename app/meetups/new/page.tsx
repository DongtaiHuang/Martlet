import { MartletNav } from "@/components/layout/MartletNav";
export default function CreateMeetupPage() {
  return <div className="min-h-screen bg-neutral-50 text-neutral-900"><MartletNav />
    <main className="mx-auto max-w-3xl px-5 py-10">
      <h1 className="text-3xl font-bold">Create a meetup</h1>
      <p className="mt-2 text-neutral-600">Developer 2: add the meetup form here. Use CAMPUS_LOCATIONS and CreateMeetupInput.</p>
    </main></div>;
}
