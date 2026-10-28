"use client";

import { useEffect, useState } from "react";

const STEPS = [
  "Reading everyone's preferences",
  "Finding times when most of the team is free",
  "Checking the weather for each day",
  "Applying the budget and no-repeat rules",
  "Scoring every idea",
  "Picking the best in each category",
];

/** Shows the planner "working" while a run is in flight. Steps tick off, the last one keeps pulsing. */
export function PlannerTheater() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 170);
    return () => clearInterval(t);
  }, []);

  const pct = Math.round(((step + 1) / STEPS.length) * 100);
  return (
    <section
      role="status"
      aria-live="polite"
      aria-label="Planning in progress"
      className="theater pop-in overflow-hidden rounded-2xl border border-zinc-200 bg-white p-5 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
    >
      <div className="mb-4 flex items-center gap-3">
        <span className="theater-orb" aria-hidden="true" />
        <div>
          <p className="display text-lg font-extrabold leading-tight">The planner is on it</p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Building your shortlist…</p>
        </div>
      </div>
      <div className="meter mb-4" aria-hidden="true">
        <span style={{ width: `${pct}%`, transition: "width .3s" }} />
      </div>
      <ol className="grid gap-2 text-sm">
        {STEPS.map((label, i) => {
          const state = i < step ? "done" : i === step ? "now" : "todo";
          return (
            <li key={label} className={`theater-step ${state}`}>
              <span className="theater-mark" aria-hidden="true">
                {state === "done" ? "✓" : state === "now" ? "•" : ""}
              </span>
              {label}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
