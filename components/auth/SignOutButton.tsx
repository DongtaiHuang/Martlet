import { signOut } from "@/app/auth/actions";

export function SignOutButton({ className }: { className?: string }) {
  return (
    <form action={signOut}>
      <button
        type="submit"
        className={className ?? "rounded-lg px-3 py-2 text-sm font-medium hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-focus"}
      >
        Sign out
      </button>
    </form>
  );
}
