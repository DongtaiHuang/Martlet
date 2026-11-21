import type { CreateMeetupInput, Meetup, MeetupSummary } from "@/types/meetup";
import { getMockMeetups } from "@/lib/mock-meetups";

// Developer 3: replace mock functions with Supabase calls.
// Keep the signatures unchanged so the frontend can integrate.
export async function listMeetups(): Promise<MeetupSummary[]> {
  return getMockMeetups();
}

export async function getMeetup(id: string): Promise<MeetupSummary | null> {
  return getMockMeetups().find((m) => m.id === id) ?? null;
}

export async function createMeetup(_input: CreateMeetupInput): Promise<Meetup> {
  throw new Error("TODO: Developer 3 implement Supabase meetup creation");
}

export async function cancelMeetup(_id: string): Promise<void> {
  throw new Error("TODO: Developer 3 implement host-only cancellation");
}
