// Tool definitions for the planning agent and their executors. Every executor is read-only,
// except submit_candidates, which the loop hands to the validator instead of running here.
import { CATEGORIES, type Activity, type PlanContext, type Slot } from "@/lib/types";
import { findSlots } from "../slots";
import { ratingAffinity } from "../score";
import type { ActivitySource, SourceResult } from "./sources";

/** Everything a tool or the validator needs for one run. */
export interface RunState {
  ctx: PlanContext;
  source: ActivitySource;
  /** Slots returned by the last find_slots call. Submitted rows must use one of these. */
  slots: Slot[];
  /** Source hits this run, keyed by ref. Only these refs can be cited as sourceRef. */
  refs: Map<string, SourceResult>;
}

export const SUBMIT_TOOL = "submit_candidates";

const SEARCH_INPUT = {
  type: "object",
  properties: { query: { type: "string", description: "Short keywords, for example 'bowling' or 'ramen'." } },
  required: ["query"],
  additionalProperties: false,
};

export const TOOL_DEFINITIONS = [
  {
    name: "get_team_context",
    description: "Team settings, how many members like each category, category affinity from ratings, and recent events. Aggregates only.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "find_slots",
    description: "Top candidate time slots inside the team's windows, with the share of members free. Submitted rows must use one of these slots.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_forecast",
    description: "Weather forecast for one local date (YYYY-MM-DD). Returns null when there is none.",
    input_schema: {
      type: "object",
      properties: { date: { type: "string", description: "Local date, YYYY-MM-DD." } },
      required: ["date"],
      additionalProperties: false,
    },
  },
  {
    name: "search_places",
    description: "Search venues. Results carry a ref. Cite a catalog hit by activityId; cite a non-catalog hit by sourceRef.",
    input_schema: SEARCH_INPUT,
  },
  {
    name: "search_events",
    description: "Search events (one-off or recurring). Same result shape as search_places.",
    input_schema: SEARCH_INPUT,
  },
  {
    name: SUBMIT_TOOL,
    description:
      "Submit up to 2 options per category, each tied to a slot from find_slots. Code checks every row against the team rules and returns the rejections with reasons.",
    input_schema: {
      type: "object",
      properties: {
        candidates: {
          type: "array",
          maxItems: 40,
          items: {
            type: "object",
            properties: {
              activityId: { type: "string", description: "Catalog activity id. Use this or sourceRef, not both." },
              sourceRef: { type: "string", description: "Ref of a search result from this run, for a venue not in the catalog." },
              slotStart: { type: "string", description: "slotStart from find_slots." },
              slotEnd: { type: "string", description: "slotEnd from find_slots." },
              explanation: { type: "string", description: "One or two lines: which rules it meets and why it suits the team." },
              pricePerPerson: { type: "number", description: "Only for a sourceRef result with no price: your estimate." },
              priceIsEstimate: { type: "boolean", description: "True when pricePerPerson is an estimate." },
            },
            required: ["slotStart", "slotEnd"],
          },
        },
      },
      required: ["candidates"],
      additionalProperties: false,
    },
  },
] as const;

/** Read-only tools the loop may execute. */
export const READ_TOOLS = new Set(["get_team_context", "find_slots", "get_forecast", "search_places", "search_events"]);

const LIST_LIMIT = 10;

export async function runTool(state: RunState, name: string, input: Record<string, unknown>): Promise<unknown> {
  const { ctx } = state;
  switch (name) {
    case "get_team_context": {
      const categoryLikes = Object.fromEntries(
        CATEGORIES.map((c) => [c, ctx.members.filter((m) => m.categories.includes(c)).length]),
      );
      const categoryAffinity = Object.fromEntries(
        CATEGORIES.map((c) => [c, round2(ratingAffinity(c, ctx.ratings, ctx.history, (id) => resolve(ctx, id)))]),
      );
      const recentEvents = [...ctx.history]
        .sort((a, b) => Date.parse(b.start) - Date.parse(a.start))
        .slice(0, LIST_LIMIT)
        .map((e) => ({ activityName: resolve(ctx, e.activityId)?.name ?? e.activityId, category: resolve(ctx, e.activityId)?.category ?? null, start: e.start }));
      return {
        memberCount: ctx.members.length,
        team: {
          limit: ctx.team.limit, currency: ctx.team.currency, windowDays: ctx.team.windowDays,
          eventLengthMin: ctx.team.eventLengthMin, attendanceThresholdPct: ctx.team.attendanceThresholdPct, noveltyWeeks: ctx.team.noveltyWeeks,
        },
        categoryLikes,
        categoryAffinity,
        recentEvents,
      };
    }
    case "find_slots": {
      state.slots = findSlots(ctx.team, ctx.members, ctx.busy, ctx.now);
      return state.slots.map((s) => ({
        slotStart: s.start, slotEnd: s.end, attendancePct: s.attendancePct, membersFree: s.availableMemberIds.length,
      }));
    }
    case "get_forecast": {
      const date = String(input.date ?? "");
      const f = ctx.forecastFor(date);
      return f ? { date: f.date, rainPct: f.rainPct, tempC: f.tempC, windKmh: f.windKmh, summary: f.summary } : null;
    }
    case "search_places":
    case "search_events": {
      const query = String(input.query ?? "");
      const hits = name === "search_places" ? await state.source.searchPlaces(query) : await state.source.searchEvents(query);
      const kept = hits.slice(0, LIST_LIMIT);
      for (const h of kept) state.refs.set(h.ref, h);
      return kept.map((h) => ({
        ref: h.ref, name: h.name, category: h.category, price: h.price, priceIsEstimate: h.priceIsEstimate,
        sourceUrl: h.sourceUrl, ...(h.activityId ? { activityId: h.activityId } : {}),
      }));
    }
    default:
      throw new Error(`unknown tool: ${name}`);
  }
}

function resolve(ctx: PlanContext, id: string): Activity | undefined {
  return ctx.activities.find((a) => a.id === id);
}

const round2 = (n: number) => Math.round(n * 100) / 100;
