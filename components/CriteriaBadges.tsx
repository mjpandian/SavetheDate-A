import type { Candidate } from "@/lib/types";

type Tone = "pass" | "fail" | "neutral" | "warn";

const TONE: Record<Tone, string> = {
  pass: "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100",
  fail: "border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100",
  neutral: "border-zinc-300 bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300",
  warn: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100",
};
const MARK: Record<Tone, string> = { pass: "✓", fail: "✕", neutral: "–", warn: "!" };

interface Badge { code: string; label: string; tone: Tone }

export function criteriaBadges(c: Candidate): Badge[] {
  const matched = c.matchedMemberIds.length;
  const out: Badge[] = [
    { code: "C1", label: c.criteria.C1 ? "Within budget" : "Over budget", tone: c.criteria.C1 ? "pass" : "fail" },
    {
      code: "C2",
      label: `Shared interest: ${matched} ${matched === 1 ? "member" : "members"}`,
      tone: matched >= 2 ? "pass" : "fail",
    },
    {
      code: "C3",
      label: c.criteria.C3 === null ? "Weather: no rule" : c.criteria.C3 ? "Weather OK" : "Weather risk",
      tone: c.criteria.C3 === null ? "neutral" : c.criteria.C3 ? "pass" : "fail",
    },
    { code: "C4", label: c.criteria.C4 ? "Enough people free" : "Too few free", tone: c.criteria.C4 ? "pass" : "fail" },
    { code: "C5", label: c.criteria.C5 ? "Not a recent repeat" : "Recent repeat", tone: c.criteria.C5 ? "pass" : "fail" },
  ];
  if (c.criteria.C5penalty) {
    out.push({ code: "C5", label: "Same category as last event", tone: "warn" });
  }
  return out;
}

export function CriteriaBadges({ candidate }: { candidate: Candidate }) {
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Rules this option meets">
      {criteriaBadges(candidate).map((b) => (
        <li
          key={`${b.code}-${b.label}`}
          className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs ${TONE[b.tone]}`}
        >
          <span aria-hidden="true">{MARK[b.tone]}</span>
          <span className="font-mono text-[10px] opacity-70">{b.code}</span>
          <span>{b.label}</span>
        </li>
      ))}
    </ul>
  );
}
