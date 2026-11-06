// Validator for submitted rows. Code recomputes every rule (C1 to C5 and the C2 floor) and every
// score field. The agent's criteria, score, attendance, weather and price are never trusted.
import { createHash } from "node:crypto";
import { z } from "zod";
import { CATEGORIES, CandidateSchema, type Activity, type Candidate, type Category, type Slot } from "@/lib/types";
import { buildCandidate } from "../index";
import { c1Price, c2Preference, c3Weather, c4Attendance, c5Novelty } from "../rules";
import { resolveActivity } from "../data";
import { localDateKey } from "../time";
import type { RunState } from "./tools";

export const EXPLANATION_MAX = 300;

// passthrough: extra fields (criteria, score, forged prices) are ignored, not rejected.
const RowSchema = z
  .object({
    activityId: z.string().optional(),
    sourceRef: z.string().optional(),
    slotStart: z.string(),
    slotEnd: z.string(),
    explanation: z.string().optional(),
    pricePerPerson: z.number().optional(),
    priceIsEstimate: z.boolean().optional(),
    sourceUrl: z.string().optional(),
  })
  .passthrough();

export interface Verdict {
  ok: boolean;
  reasons: string[];
  candidate?: Candidate;
  /** Set when the row cited a sourceRef and passed: the Activity code built from the search result. */
  discovered?: Activity;
}

/** Stable id for a venue found by a search, `disc:` plus the first 10 hex chars of sha1(sourceUrl). */
export function discoveredId(sourceUrl: string): string {
  return `disc:${createHash("sha1").update(sourceUrl).digest("hex").slice(0, 10)}`;
}

/** Validate one row. `known` holds activities already accepted this run, so resolution sees discovered ones. */
export function validateRow(raw: unknown, state: RunState, known: readonly Activity[]): Verdict {
  const parsed = RowSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, reasons: parsed.error.issues.map((i) => `missing or invalid field: ${i.path.join(".") || "row"}`) };
  }
  const row = parsed.data;
  const { ctx } = state;
  const reasons: string[] = [];

  if (Boolean(row.activityId) === Boolean(row.sourceRef)) {
    return { ok: false, reasons: ["give exactly one of activityId or sourceRef"] };
  }

  // Slot must be one that find_slots returned in this run.
  if (state.slots.length === 0) reasons.push("no slots yet: call find_slots first");
  const slot: Slot | undefined = state.slots.find((s) => s.start === row.slotStart && s.end === row.slotEnd);
  if (!slot) reasons.push("slot not returned by find_slots: use a slotStart and slotEnd from find_slots");

  // Resolve the activity: catalog by id, or a search result by ref.
  let activity: Activity | undefined;
  let discovered: Activity | undefined;
  if (row.activityId) {
    activity = resolveActivity(row.activityId, ctx.activities, known.filter((k) => k.id.startsWith("disc:")));
    if (!activity) reasons.push(`unknown activityId ${row.activityId}`);
  } else if (row.sourceRef) {
    const hit = state.refs.get(row.sourceRef);
    if (!hit) {
      reasons.push(`unknown sourceRef ${row.sourceRef}: use a ref from search_places or search_events in this run`);
    } else {
      const built = buildDiscovered(hit, row.pricePerPerson, row.priceIsEstimate);
      if ("error" in built) reasons.push(built.error);
      else { discovered = built.activity; activity = built.activity; }
    }
  }

  if (activity && row.sourceUrl !== undefined && row.sourceUrl !== activity.sourceUrl) {
    reasons.push("sourceUrl does not match the source for this option");
  }

  if (!activity || !slot) return { ok: false, reasons: dedupe(reasons) };

  // Hard rules, recomputed here. Each failure gets its own reason so the repair round can fix it.
  if (!c1Price(activity, ctx.team)) reasons.push(`C1 over the limit of ${ctx.team.limit} per person`);
  const c2 = c2Preference(activity, ctx.members);
  if (!c2.pass) reasons.push("C2 fewer than 2 members list this activity or its category");
  if (!c4Attendance(slot, ctx.team)) reasons.push(`C4 attendance ${slot.attendancePct}% below ${ctx.team.attendanceThresholdPct}%`);
  const forecast = ctx.forecastFor(localDateKey(Date.parse(slot.start)));
  if (c3Weather(activity, forecast) === false) reasons.push("C3 outdoor venue fails the weather limits for this day");
  const resolver = (id: string) => resolveActivity(id, ctx.activities, known);
  const c5 = c5Novelty(activity, ctx.history, ctx.team, slot.start, resolver);
  if (!c5.pass) reasons.push("C5 same activity happened within the novelty window");
  if (reasons.length) return { ok: false, reasons: dedupe(reasons) };

  const candidate = buildCandidate(ctx, activity, slot, c2.matched, resolver);
  if (!candidate) return { ok: false, reasons: ["row failed a rule check"] };

  const explanation = (row.explanation ?? "").trim().slice(0, EXPLANATION_MAX);
  const final: Candidate = { ...candidate, explanation };
  const parsedCandidate = CandidateSchema.safeParse(final);
  if (!parsedCandidate.success) return { ok: false, reasons: ["row did not match the candidate schema"] };
  return { ok: true, reasons: [], candidate: final, ...(discovered ? { discovered } : {}) };
}

/** Build the Activity for a non-catalog search hit. Name, price and URL come from the search result only. */
function buildDiscovered(
  hit: { name: string; category: string; price: number | null; priceIsEstimate: boolean; sourceUrl: string },
  estimatePrice: number | undefined,
  estimateFlag: boolean | undefined,
): { activity: Activity } | { error: string } {
  if (!(CATEGORIES as readonly string[]).includes(hit.category)) return { error: `category ${hit.category} is not one of the team's categories` };
  let price: number;
  let priceIsEstimate: boolean;
  if (hit.price !== null) {
    if (hit.price < 0) return { error: "negative price in the search result" };
    price = hit.price;
    priceIsEstimate = hit.priceIsEstimate;
  } else {
    // No price in the source: only the agent's estimate, flagged as one.
    if (estimateFlag !== true || estimatePrice === undefined || estimatePrice < 0) {
      return { error: "missing price: the source lists none, so give pricePerPerson with priceIsEstimate true" };
    }
    price = estimatePrice;
    priceIsEstimate = true;
  }
  return {
    activity: {
      id: discoveredId(hit.sourceUrl),
      name: hit.name,
      category: hit.category as Category,
      tags: [],
      indoor: false, // unknown for a search hit: treated as outdoor, so the weather rule applies
      pricePerPerson: price,
      priceIsEstimate,
      sourceUrl: hit.sourceUrl,
    },
  };
}

const dedupe = (xs: string[]) => [...new Set(xs)];
