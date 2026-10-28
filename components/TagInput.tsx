"use client";

import { useState, type KeyboardEvent } from "react";
import { inputClass } from "@/components/Field";

/** Free-form tags: type and press Enter or comma to add, use the x button to remove. */
export function TagInput({ id, value, onChange }: { id: string; value: string[]; onChange: (tags: string[]) => void }) {
  const [draft, setDraft] = useState("");

  function add() {
    const tag = draft.trim().replace(/,+$/, "").trim();
    if (!tag) return;
    if (!value.some((t) => t.toLowerCase() === tag.toLowerCase())) onChange([...value, tag]);
    setDraft("");
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add();
    } else if (e.key === "Backspace" && draft === "" && value.length) {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <div className="grid gap-2">
      <div className="flex gap-2">
        <input
          id={id}
          className={inputClass}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="For example: climbing, jazz, sushi"
          aria-describedby={`${id}-hint`}
        />
        <button
          type="button"
          onClick={add}
          className="rounded-md border border-zinc-300 px-3 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Add
        </button>
      </div>
      <p id={`${id}-hint`} className="text-xs text-zinc-600 dark:text-zinc-400">
        Press Enter or comma to add a tag.
      </p>
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Your tags">
          {value.map((t) => (
            <li
              key={t}
              className="inline-flex items-center gap-1 rounded-full border border-zinc-300 bg-zinc-50 py-0.5 pl-3 pr-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              {t}
              <button
                type="button"
                onClick={() => onChange(value.filter((x) => x !== t))}
                aria-label={`Remove tag ${t}`}
                className="grid size-5 place-items-center rounded-full text-zinc-600 hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-700"
              >
                <span aria-hidden="true">×</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
