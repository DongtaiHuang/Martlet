import { BookOpen, Coffee, Dumbbell, Gamepad2, Shapes, Utensils } from "lucide-react";
import type { MeetupCategory } from "@/types/meetup";

export const categories = {
  coffee: { label: "Coffee", icon: Coffee, color: "bg-amber-100 text-amber-900", accent: "border-t-amber-400" },
  study: { label: "Study", icon: BookOpen, color: "bg-indigo-100 text-indigo-800", accent: "border-t-indigo-400" },
  food: { label: "Food", icon: Utensils, color: "bg-orange-100 text-orange-900", accent: "border-t-orange-400" },
  sports: { label: "Sports", icon: Dumbbell, color: "bg-emerald-100 text-emerald-800", accent: "border-t-emerald-400" },
  gaming: { label: "Gaming", icon: Gamepad2, color: "bg-violet-100 text-violet-800", accent: "border-t-violet-400" },
  other: { label: "Other", icon: Shapes, color: "bg-stone-100 text-stone-800", accent: "border-t-stone-400" },
} satisfies Record<MeetupCategory, { label: string; icon: typeof Coffee; color: string; accent: string }>;

export const categoryValues = Object.keys(categories) as MeetupCategory[];
