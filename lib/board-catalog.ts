// Community board constants (ADR 0027). Client-safe: no server imports.

export const BOARD_KINDS = ["meme", "tip", "question", "skill"] as const;
export type BoardKind = (typeof BOARD_KINDS)[number];
/** Kinds students can still post. "skill" is retired: offers live in the Creator directory (ADR 0042); old skill posts stay readable. */
export const POSTABLE_KINDS = ["meme", "tip", "question"] as const satisfies readonly BoardKind[];
export type PostableKind = (typeof POSTABLE_KINDS)[number];
export const KIND_INFO: Record<BoardKind, { label: string; plural: string; emoji: string; hint: string }> = {
  meme: { label: "Meme", plural: "Memes", emoji: "😂", hint: "McGill shitposts. Keep it funny, not mean." },
  tip: { label: "Tip", plural: "Tips", emoji: "💡", hint: "Something you wish you'd known sooner." },
  question: { label: "Question", plural: "Q&A", emoji: "❓", hint: "Ask the campus. Pick the best answer when you get one." },
  skill: { label: "Skill", plural: "Skills", emoji: "🛠️", hint: "Skill offers now live in Creators." },
};
export const REPORT_REASONS = {
  spam: "Spam or ads", harassment: "Harassment or bullying", hate: "Hate speech", sexual: "Sexual content",
  violence: "Violence or threats", scam: "Scam or fraud", "personal-info": "Someone's personal info", other: "Something else",
} as const;
export type ReportReason = keyof typeof REPORT_REASONS;
