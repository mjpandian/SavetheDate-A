import type { ReactNode } from "react";

/** Label + control + hint + inline error. Give the control id={id} and aria-describedby from `describedBy`. */
export function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs text-zinc-600 dark:text-zinc-400">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs font-medium text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}

export const describedBy = (id: string, hint?: string, error?: string | null) =>
  error ? `${id}-error` : hint ? `${id}-hint` : undefined;

export const inputClass =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--tomato)] aria-[invalid=true]:border-red-500 dark:border-zinc-700 dark:bg-zinc-900";
