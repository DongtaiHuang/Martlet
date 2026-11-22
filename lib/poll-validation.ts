import { z } from "zod";

const utcDate = z.iso.datetime({ error: "Enter a valid date and time." });
export const pollTypeSchema = z.enum(["time", "location", "activity"]);

export function validatePoll(input: unknown, approvedIds: readonly string[], now = Date.now()) {
  return z.object({
    type: pollTypeSchema,
    question: z.string().trim().min(5, "Use at least 5 characters for the question.").max(120, "Use at most 120 characters for the question."),
    closesAt: utcDate.refine((value) => Date.parse(value) > now, "The closing time must be in the future."),
    options: z.array(z.string().trim().min(1, "Fill in all choices.").max(80, "Choices can contain at most 80 characters.")).min(2, "Add at least two choices.").max(5, "Use at most five choices."),
  }).superRefine(({ options, type }, context) => {
    const distinct = new Set<string>();
    for (const option of options) {
      const key = type === "time" ? String(Date.parse(option)) : option.toLowerCase();
      if (distinct.has(key)) {
        context.addIssue({ code: "custom", path: ["options"], message: "Choose different options." });
        return;
      }
      distinct.add(key);
      if (type === "location" && !approvedIds.includes(option)) {
        context.addIssue({ code: "custom", path: ["options"], message: "Choose approved campus locations." });
        return;
      }
      if (type === "time" && (!utcDate.safeParse(option).success || !(Date.parse(option) > now))) {
        context.addIssue({ code: "custom", path: ["options"], message: "Choose valid future dates and times." });
        return;
      }
    }
  }).safeParse(input);
}

export function votePercentages(counts: readonly number[]): number[] {
  const total = counts.reduce((sum, count) => sum + count, 0);
  if (total === 0) return counts.map(() => 0);
  const exact = counts.map((count) => count * 100 / total);
  const percentages = exact.map(Math.floor);
  const remaining = 100 - percentages.reduce((sum, value) => sum + value, 0);
  const order = exact.map((value, index) => ({ index, remainder: value - percentages[index] }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (const { index } of order.slice(0, remaining)) percentages[index]++;
  return percentages;
}

export function isPollOpen(isOpen: boolean, closesAt: string, now: number): boolean {
  return isOpen && Date.parse(closesAt) > now;
}
