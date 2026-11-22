import type { Achievement } from "@/lib/achievement-catalog";

export function AchievementIcon({ achievement }: { achievement: Achievement }) {
  if (achievement.icon !== "67") return achievement.icon;

  return (
    <svg aria-hidden="true" viewBox="0 0 40 40" className="size-9">
      <rect width="40" height="40" rx="10" fill="#452795" />
      <circle cx="20" cy="11" r="4" fill="#ffd3a8" />
      <path d="M14 29v-8a6 6 0 0 1 12 0v8" fill="#e2d8ff" />
      <g fill="none" stroke="#ffd3a8" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path className="martlet-67-hand" d="m16 22-6 3-3-8H3m4 0 2-2" />
        <path className="martlet-67-hand martlet-67-hand-right" d="m24 22 6 3 3-8h4m-4 0-2-2" />
      </g>
      <text x="20" y="34" textAnchor="middle" fontSize="11" fontWeight="800" fill="white">67</text>
    </svg>
  );
}
