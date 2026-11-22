import { getMeetupPoll } from "@/lib/polls";
import { getDataMode } from "@/lib/supabase/env";
import type { MeetupPollData } from "@/types/poll";
import { CreatePollForm } from "./CreatePollForm";
import { PollRetry } from "./PollRetry";
import { PollResults } from "./PollResults";

const sample: MeetupPollData = {
  id: "sample",
  type: "activity",
  question: "What should we do next?",
  closesAt: "",
  isOpen: false,
  isHost: false,
  selectedOptionId: null,
  options: [
    { id: "coffee", label: "Grab coffee", proposedAt: null, votes: 0 },
    { id: "walk", label: "Walk around campus", proposedAt: null, votes: 0 },
  ],
};

export async function MeetupPoll({ meetupId, startsAt, canCreate }: { meetupId: string; startsAt: string; canCreate: boolean }) {
  const preview = getDataMode() === "mock";
  const result = preview ? sample : await getMeetupPoll(meetupId).catch(() => undefined);
  if (result === null && !canCreate) return null;

  return (
    <section aria-labelledby="meetup-poll-heading" className="mt-6 min-w-0 rounded-2xl border border-line bg-surface p-4 shadow-sm sm:p-5">
      <h2 id="meetup-poll-heading" className="mb-3 text-lg font-bold text-ink">Meetup poll</h2>
      {result === undefined ? (
        <PollRetry />
      ) : result ? (
        <PollResults key={result.id} poll={result} preview={preview} />
      ) : <CreatePollForm meetupId={meetupId} startsAt={startsAt} />}
      {preview && <p className="mt-3 text-sm text-ink-muted">Voting and poll creation are unavailable in demo mode.</p>}
      {result !== undefined && <p className="mt-3 text-sm text-ink-muted">Poll results help the host plan. Voting does not automatically change meetup details.</p>}
    </section>
  );
}
