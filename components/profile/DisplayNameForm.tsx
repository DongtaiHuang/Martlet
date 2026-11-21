"use client";

import { useActionState } from "react";
import { updateDisplayName, type DisplayNameState } from "@/app/profile/actions";

export function DisplayNameForm({ current }: { current: string }) {
  const [state, action, pending] = useActionState<DisplayNameState, FormData>(updateDisplayName, {});

  return (
    <form action={action} className="mt-5 border-t border-stone-100 pt-4">
      <label htmlFor="display_name" className="text-sm font-semibold">Display name</label>
      <p id="display_name_hint" className="text-xs text-stone-600">Shown to other students on meetups you host.</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <input
          id="display_name" name="display_name" defaultValue={current} required minLength={2} maxLength={30}
          aria-describedby="display_name_hint display_name_status"
          className="min-h-11 min-w-0 flex-1 rounded-xl border border-stone-300 px-3 text-sm focus-visible:outline-2 focus-visible:outline-red-700"
        />
        <button type="submit" disabled={pending} className="min-h-11 rounded-xl bg-red-800 px-4 text-sm font-bold text-white hover:bg-red-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:opacity-60">
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
      <p id="display_name_status" role="status" className={`mt-1 min-h-5 text-xs ${state.success ? "text-emerald-800" : "text-red-800"}`}>{state.message}</p>
    </form>
  );
}
