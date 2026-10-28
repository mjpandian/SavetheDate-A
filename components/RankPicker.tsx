"use client";

import { inputClass } from "@/components/Field";

export interface RankOption { id: string; label: string }
export type Ranking = [string, string, string]; // "" means not chosen yet

const SLOT_LABEL = ["1st choice (3 points)", "2nd choice (2 points)", "3rd choice (1 point)"] as const;

/** Options a slot may offer: everything except what the OTHER slots already hold. */
export function optionsFor(slot: number, value: Ranking, options: RankOption[]): RankOption[] {
  const taken = new Set(value.filter((v, i) => i !== slot && v !== ""));
  return options.filter((o) => !taken.has(o.id));
}

/** Set one slot; if the pick already sat in another slot, clear that slot so no id repeats. */
export function setRank(value: Ranking, slot: number, id: string): Ranking {
  const next = [...value] as Ranking;
  if (id !== "") {
    next.forEach((v, i) => {
      if (i !== slot && v === id) next[i] = "";
    });
  }
  next[slot] = id;
  return next;
}

export const isComplete = (v: Ranking) => v.every((x) => x !== "") && new Set(v).size === 3;

export function RankPicker({
  options,
  value,
  onChange,
  disabled = false,
}: {
  options: RankOption[];
  value: Ranking;
  onChange: (next: Ranking) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {SLOT_LABEL.map((label, slot) => {
        const id = `rank-${slot + 1}`;
        return (
          <div key={id} className="grid gap-1.5">
            <label htmlFor={id} className="text-sm font-medium">
              {label}
            </label>
            <select
              id={id}
              className={inputClass}
              value={value[slot]}
              disabled={disabled}
              onChange={(e) => onChange(setRank(value, slot, e.target.value))}
            >
              <option value="">Choose an option…</option>
              {optionsFor(slot, value, options).map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        );
      })}
    </div>
  );
}
