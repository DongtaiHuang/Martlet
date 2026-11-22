export type PollType = "time" | "location" | "activity";

export interface PollOption {
  id: string;
  label: string;
  proposedAt: string | null;
  votes: number;
}

export interface MeetupPollData {
  id: string;
  type: PollType;
  question: string;
  closesAt: string;
  isOpen: boolean;
  isHost: boolean;
  selectedOptionId: string | null;
  options: PollOption[];
}
