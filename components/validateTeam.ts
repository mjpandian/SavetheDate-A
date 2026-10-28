import type { Team } from "@/lib/types";

export interface TeamDraft {
  limit: string;
  windowDays: string;
  attendanceThresholdPct: string;
  noveltyWeeks: string;
}
export type TeamErrors = Partial<Record<keyof TeamDraft, string>>;

export const toDraft = (t: Team): TeamDraft => ({
  limit: String(t.limit),
  windowDays: String(t.windowDays),
  attendanceThresholdPct: String(t.attendanceThresholdPct),
  noveltyWeeks: String(t.noveltyWeeks),
});

/** Inline validation for the settings form. Returns one message per invalid field. */
export function validateTeam(d: TeamDraft): TeamErrors {
  const e: TeamErrors = {};
  const num = (s: string) => (s.trim() === "" ? NaN : Number(s));
  const limit = num(d.limit);
  if (!Number.isFinite(limit) || limit <= 0 || limit > 1000) e.limit = "Enter an amount above 0 and up to 1000.";
  const win = num(d.windowDays);
  if (!Number.isInteger(win) || win < 1 || win > 60) e.windowDays = "Enter whole days, from 1 to 60.";
  const pct = num(d.attendanceThresholdPct);
  if (!Number.isInteger(pct) || pct < 1 || pct > 100) e.attendanceThresholdPct = "Enter a whole percentage, from 1 to 100.";
  const nov = num(d.noveltyWeeks);
  if (!Number.isInteger(nov) || nov < 0 || nov > 52) e.noveltyWeeks = "Enter whole weeks, from 0 to 52.";
  return e;
}
