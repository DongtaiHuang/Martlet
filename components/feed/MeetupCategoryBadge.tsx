import { categories } from "./categories";
import type { MeetupCategory } from "@/types/meetup";

export function MeetupCategoryBadge({ category }: { category: MeetupCategory }) {
  const { label, icon: Icon, color } = categories[category];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${color}`}>
      <Icon aria-hidden="true" size={14} /> {label}
    </span>
  );
}
