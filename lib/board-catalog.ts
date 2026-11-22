// Community board constants (ADR 0027). Client-safe: no server imports.

export const BOARD_KINDS = ["meme", "tip", "question", "skill"] as const;
export type BoardKind = (typeof BOARD_KINDS)[number];
export const KIND_INFO: Record<BoardKind, { label: string; plural: string; emoji: string; hint: string }> = {
  meme: { label: "Meme", plural: "Memes", emoji: "😂", hint: "McGill shitposts. Keep it funny, not mean." },
  tip: { label: "Tip", plural: "Tips", emoji: "💡", hint: "Something you wish you'd known sooner." },
  question: { label: "Question", plural: "Q&A", emoji: "❓", hint: "Ask the campus. Pick the best answer when you get one." },
  skill: { label: "Skill", plural: "Skills", emoji: "🛠️", hint: "Offer a skill or freelance help. Listings only; arrange details yourselves, meet on campus." },
};
export const REPORT_REASONS = {
  spam: "Spam or ads", harassment: "Harassment or bullying", hate: "Hate speech", sexual: "Sexual content",
  violence: "Violence or threats", scam: "Scam or fraud", "personal-info": "Someone's personal info", other: "Something else",
} as const;
export type ReportReason = keyof typeof REPORT_REASONS;
