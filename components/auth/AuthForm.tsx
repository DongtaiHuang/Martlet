"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signIn, signUp, type AuthFormState } from "@/app/auth/actions";

const inputClass =
  "mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 focus-visible:outline-2 focus-visible:outline-red-700";

export function AuthForm({ mode, next }: { mode: "login" | "signup"; next?: string }) {
  const isSignup = mode === "signup";
  const [state, action, pending] = useActionState<AuthFormState, FormData>(
    isSignup ? signUp : signIn,
    {},
  );

  return (
    <form action={action} className="mt-6 space-y-4">
      {next && <input type="hidden" name="next" value={next} />}

      {isSignup && (
        <label className="block text-sm font-medium text-neutral-800">
          Display name
          <input name="display_name" required minLength={2} maxLength={30} autoComplete="nickname" className={inputClass} />
          <span className="mt-1 block text-xs text-neutral-500">Shown to other students on meetups you host.</span>
        </label>
      )}

      <label className="block text-sm font-medium text-neutral-800">
        Email
        <input name="email" type="email" required autoComplete="email" className={inputClass} />
      </label>

      <label className="block text-sm font-medium text-neutral-800">
        Password
        <input
          name="password" type="password" required minLength={8} maxLength={72}
          autoComplete={isSignup ? "new-password" : "current-password"} className={inputClass}
        />
      </label>

      {state.error && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{state.error}</p>
      )}
      {state.message && (
        <p role="status" className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">{state.message}</p>
      )}

      <button
        type="submit" disabled={pending}
        className="w-full rounded-xl bg-red-700 px-5 py-3 font-semibold text-white hover:bg-red-800 disabled:opacity-60"
      >
        {pending ? "Please wait…" : isSignup ? "Create account" : "Sign in"}
      </button>

      <p className="text-center text-sm text-neutral-600">
        {isSignup ? "Already have an account? " : "New to Martlet? "}
        <Link
          href={`${isSignup ? "/login" : "/signup"}${next ? `?next=${encodeURIComponent(next)}` : ""}`}
          className="font-semibold text-red-700 underline"
        >
          {isSignup ? "Sign in" : "Create an account"}
        </Link>
      </p>
    </form>
  );
}
