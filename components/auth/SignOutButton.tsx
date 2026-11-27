import { LogOut } from "lucide-react";
import { signOut } from "@/app/auth/actions";

export function SignOutButton({ className }: { className?: string }) {
  return (
    <form action={signOut}>
      <button
        type="submit"
        className={className ?? "inline-flex min-h-11 items-center gap-2 rounded-xl border border-line-strong px-4 text-sm font-bold text-brand-ink hover:border-brand hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"}
      >
        <LogOut aria-hidden="true" size={16} /> Sign out
      </button>
    </form>
  );
}
