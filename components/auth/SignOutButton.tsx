import { signOut } from "@/app/auth/actions";

export function SignOutButton({ className }: { className?: string }) {
  return (
    <form action={signOut}>
      <button
        type="submit"
        className={className ?? "rounded-lg px-3 py-2 text-sm font-medium hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-red-700"}
      >
        Sign out
      </button>
    </form>
  );
}
