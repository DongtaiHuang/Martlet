import { BookOpen, Coffee, Dumbbell, Gamepad2, Shapes, Utensils } from "lucide-react";
import type { MeetupCategory } from "@/types/meetup";

export const categories = {
  coffee: { label: "Coffee", icon: Coffee, color: "bg-warn-muted text-warn-ink dark:bg-amber-400/15 dark:text-amber-200", accent: "border-t-amber-400" },
  study: { label: "Study", icon: BookOpen, color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-400/15 dark:text-indigo-200", accent: "border-t-indigo-400" },
  food: { label: "Food", icon: Utensils, color: "bg-orange-100 text-orange-900 dark:bg-orange-400/15 dark:text-orange-200", accent: "border-t-orange-400" },
  sports: { label: "Sports", icon: Dumbbell, color: "bg-emerald-100 text-ok-ink dark:bg-emerald-400/15 dark:text-emerald-200", accent: "border-t-emerald-400" },
  gaming: { label: "Gaming", icon: Gamepad2, color: "bg-violet-100 text-violet-800 dark:bg-violet-400/15 dark:text-violet-200", accent: "border-t-violet-400" },
  other: { label: "Other", icon: Shapes, color: "bg-surface-muted text-ink-soft", accent: "border-t-stone-400" },
} satisfies Record<MeetupCategory, { label: string; icon: typeof Coffee; color: string; accent: string }>;

export const categoryValues = Object.keys(categories) as MeetupCategory[];
