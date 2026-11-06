// Agent unit tests: validator reasons, discovery, repair round, caps and fallback. Scripted client, no network.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CandidateSchema, type Activity, type PlanContext } from "@/lib/types";
import { planCandidates } from "@/lib/engine";
import { resolveActivity } from "@/lib/engine/data";
import { findSlots } from "@/lib/engine/slots";
import { runPlanningAgent } from "@/lib/engine/agent";
import { discoveredId, validateRow } from "@/lib/engine/agent/validate";
import { catalogSource, type ActivitySource } from "@/lib/engine/agent/sources";
import { runLoop, type ModelClient, type ModelReply } from "@/lib/engine/agent/loop";
import { runTool, type RunState } from "@/lib/engine/agent/tools";
import { makeActivity, makeContext, makePastEvent, weather } from "./fixtures";

const key = process.env.ANTHROPIC_API_KEY;
beforeEach(() => { delete process.env.ANTHROPIC_API_KEY; });
afterEach(() => { if (key) process.env.ANTHROPIC_API_KEY = key; });

/** Catalog with one good dining option, plus the same run state find_slots would give. */
function world(over: Partial<PlanContext> = {}, activities: Activity[] = [makeActivity({ id: "dining-ok", name: "Pizza Night", category: "dining", pricePerPerson: 25 })]) {
  const ctx = makeContext({ activities, ...over });
  const slots = findSlots(ctx.team, ctx.members, ctx.busy, ctx.now);
  const state: RunState = { ctx, source: catalogSource(ctx.activities), slots, refs: new Map() };
  return { ctx, state };
}

const rowFor = (activityId: string, slot: { start: string; end: string }, extra: Record<string, unknown> = {}) => ({
  activityId, slotStart: slot.start, slotEnd: slot.end, explanation: "Fits the team.", ...extra,
});

/** Scripted model: each entry is the reply for one call, in order. */
function scripted(replies: ModelReply[]): ModelClient & { calls: number } {
  let i = 0;
  const client = { calls: 0, messages: { create: async () => { client.calls++; return replies[Math.min(i++, replies.length - 1)]; } } };
  return client;
}
const toolUse = (id: string, name: string, input: Record<string, unknown> = {}): ModelReply => ({
  stop_reason: "tool_use", content: [{ type: "tool_use", id, name, input }], usage: { input_tokens: 100, output_tokens: 20 },
});
const endTurn: ModelReply = { stop_reason: "end_turn", content: [{ type: "text", text: "Done." }], usage: { input_tokens: 50, output_tokens: 5 } };

describe("validator rejects each broken row with a reason", () => {
  it("accepts a clean catalog row and recomputes the score", () => {
    const { ctx, state } = world();
    const slot = state.slots[0];
    const v = validateRow(rowFor("dining-ok", slot, { score: 0.99, criteria: { C1: true } }), state, []);
    expect(v.ok).toBe(true);
    expect(v.candidate!.score).toBeLessThan(0.99);
    expect(CandidateSchema.safeParse(v.candidate).success).toBe(true);
    expect(ctx.activities.length).toBe(1);
  });

  it("unknown activityId", () => {
    const { state } = world();
    expect(validateRow(rowFor("ghost", state.slots[0]), state, []).reasons.join()).toMatch(/unknown activityId/);
  });

  it("slot not returned by find_slots", () => {
    const { state } = world();
    const off = { start: "2026-11-02T18:07:00.000Z", end: "2026-11-02T20:07:00.000Z" };
    expect(validateRow(rowFor("dining-ok", off), state, []).reasons.join()).toMatch(/slot not returned by find_slots/);
  });

  it("no slots yet when find_slots was not called", () => {
    const { state } = world();
    state.slots = [];
    expect(validateRow(rowFor("dining-ok", { start: "x", end: "y" }), state, []).reasons.join()).toMatch(/call find_slots first/);
  });

  it("wrong sourceUrl", () => {
    const { state } = world();
    expect(validateRow(rowFor("dining-ok", state.slots[0], { sourceUrl: "https://evil.example" }), state, []).reasons.join()).toMatch(/sourceUrl/);
  });

  it("over the limit (C1), even when the row claims price 0", () => {
    const { state } = world({}, [makeActivity({ id: "dining-dear", category: "dining", pricePerPerson: 90 })]);
    const v = validateRow(rowFor("dining-dear", state.slots[0], { pricePerPerson: 0 }), state, []);
    expect(v.ok).toBe(false);
    expect(v.reasons.join()).toMatch(/C1/);
  });

  it("outdoor venue in bad weather (C3)", () => {
    const { state } = world({ forecastFor: (date) => weather({ date, rainPct: 60 }) }, [makeActivity({ id: "out-1", category: "outdoor", indoor: false })]);
    expect(validateRow(rowFor("out-1", state.slots[0]), state, []).reasons.join()).toMatch(/C3/);
  });

  it("repeat of a recent event (C5)", () => {
    const { state } = world({ history: [makePastEvent({ activityId: "dining-ok", start: "2026-10-20T18:00:00-07:00" })] });
    expect(validateRow(rowFor("dining-ok", state.slots[0]), state, []).reasons.join()).toMatch(/C5/);
  });

  it("attendance below the threshold (C4)", () => {
    const { state } = world();
    const weak = { ...state.slots[0], attendancePct: 40 };
    state.slots = [weak];
    expect(validateRow(rowFor("dining-ok", weak), state, []).reasons.join()).toMatch(/C4/);
  });

  it("fewer than two members like it (C2 floor)", () => {
    const { ctx, state } = world({ members: makeContext().members.map((m, i) => ({ ...m, categories: i === 0 ? ["dining"] : [] })) });
    void ctx;
    expect(validateRow(rowFor("dining-ok", state.slots[0]), state, []).reasons.join()).toMatch(/C2/);
  });

  it("missing required field", () => {
    const { state } = world();
    const v = validateRow({ activityId: "dining-ok", slotStart: state.slots[0].start }, state, []);
    expect(v.ok).toBe(false);
    expect(v.reasons.join()).toMatch(/slotEnd/);
  });

  it("exactly one of activityId or sourceRef", () => {
    const { state } = world();
    expect(validateRow({ ...rowFor("dining-ok", state.slots[0]), sourceRef: "cat:dining-ok" }, state, []).reasons.join()).toMatch(/exactly one/);
  });

  it("explanation is trimmed to 300 characters", () => {
    const { state } = world();
    const v = validateRow(rowFor("dining-ok", state.slots[0], { explanation: "x".repeat(500) }), state, []);
    expect(v.candidate!.explanation.length).toBe(300);
  });
});

describe("discovery (sourceRef)", () => {
  const hit = (over: Record<string, unknown> = {}) => ({
    ref: "r1", name: "Hidden Sauna", category: "wellness", price: 25, priceIsEstimate: false,
    sourceUrl: "https://example.org/sauna", ...over,
  });
  function withRef(result: Record<string, unknown>) {
    const { state } = world();
    state.refs.set("r1", hit(result) as never);
    return state;
  }

  it("builds the activity from the search result with a disc: id", () => {
    const state = withRef({});
    const v = validateRow({ sourceRef: "r1", slotStart: state.slots[0].start, slotEnd: state.slots[0].end, explanation: "New sauna." }, state, []);
    expect(v.ok).toBe(true);
    expect(v.discovered!.id).toBe(discoveredId("https://example.org/sauna"));
    expect(v.discovered!.name).toBe("Hidden Sauna");
    expect(v.discovered!.pricePerPerson).toBe(25);
    expect(v.candidate!.activityId).toBe(v.discovered!.id);
  });

  it("unknown sourceRef is rejected", () => {
    const { state } = world();
    expect(validateRow({ sourceRef: "nope", slotStart: state.slots[0].start, slotEnd: state.slots[0].end }, state, []).reasons.join()).toMatch(/unknown sourceRef/);
  });

  it("category outside the team's categories is rejected", () => {
    const state = withRef({ category: "gambling" });
    expect(validateRow({ sourceRef: "r1", slotStart: state.slots[0].start, slotEnd: state.slots[0].end }, state, []).reasons.join()).toMatch(/category/);
  });

  it("negative price is rejected", () => {
    const state = withRef({ price: -5 });
    expect(validateRow({ sourceRef: "r1", slotStart: state.slots[0].start, slotEnd: state.slots[0].end }, state, []).reasons.join()).toMatch(/negative/);
  });

  it("no price in the source needs the agent's estimate flagged as one", () => {
    const state = withRef({ price: null });
    const row = { sourceRef: "r1", slotStart: state.slots[0].start, slotEnd: state.slots[0].end };
    expect(validateRow(row, state, []).reasons.join()).toMatch(/missing price/);
    const ok = validateRow({ ...row, pricePerPerson: 30, priceIsEstimate: true }, state, []);
    expect(ok.ok).toBe(true);
    expect(ok.discovered!.priceIsEstimate).toBe(true);
  });

  it("resolveActivity finds a discovered activity", () => {
    const state = withRef({});
    const v = validateRow({ sourceRef: "r1", slotStart: state.slots[0].start, slotEnd: state.slots[0].end }, state, []);
    expect(resolveActivity(v.discovered!.id, state.ctx.activities, [v.discovered!])?.name).toBe("Hidden Sauna");
  });
});

describe("loop: repair round and caps", () => {
  it("one repair round fixes a rejected row and the result is clean", async () => {
    const { state } = world();
    const slot = state.slots[0];
    const client = scripted([
      toolUse("t1", "find_slots"),
      toolUse("t2", "submit_candidates", { candidates: [rowFor("ghost", slot)] }),
      toolUse("t3", "submit_candidates", { candidates: [rowFor("dining-ok", slot)] }),
      endTurn,
    ]);
    const out = await runLoop({ client, state, budget: { maxToolCalls: 20, maxTokens: 30000, timeoutMs: 60000 } });
    expect(out.accepted.map((c) => c.activityId)).toEqual(["dining-ok"]);
    expect(out.gaps).toEqual([]);
  });

  it("row still invalid after the repair round is dropped and reported", async () => {
    const { state } = world();
    const slot = state.slots[0];
    const client = scripted([
      toolUse("t1", "find_slots"),
      toolUse("t2", "submit_candidates", { candidates: [rowFor("ghost", slot)] }),
      toolUse("t3", "submit_candidates", { candidates: [rowFor("ghost", slot)] }),
    ]);
    const out = await runLoop({ client, state, budget: { maxToolCalls: 20, maxTokens: 30000, timeoutMs: 60000 } });
    expect(out.accepted).toEqual([]);
    expect(out.gaps.join()).toMatch(/dropped after repair/);
  });

  it("tool-call cap ends the loop and is reported", async () => {
    const { state } = world();
    const client = scripted([toolUse("t1", "find_slots"), toolUse("t2", "get_team_context"), endTurn]);
    const out = await runLoop({ client, state, budget: { maxToolCalls: 1, maxTokens: 30000, timeoutMs: 60000 } });
    expect(out.gaps).toContain("tool-call cap reached");
    expect(out.usage.toolCalls).toBe(1);
  });

  it("token cap ends the loop and is reported", async () => {
    const { state } = world();
    const client = scripted([toolUse("t1", "find_slots"), endTurn]);
    const out = await runLoop({ client, state, budget: { maxToolCalls: 20, maxTokens: 50, timeoutMs: 60000 } });
    expect(out.gaps).toContain("token cap reached");
  });

  it("every executed tool call has a trace entry", async () => {
    const { state } = world();
    const client = scripted([toolUse("t1", "find_slots"), toolUse("t2", "get_team_context"), endTurn]);
    const out = await runLoop({ client, state, budget: { maxToolCalls: 20, maxTokens: 30000, timeoutMs: 60000 } });
    expect(out.trace.entries.map((e) => e.tool)).toEqual(["find_slots", "get_team_context"]);
  });

  it("a failing search is reported in gaps and the run continues", async () => {
    const { state } = world();
    const broken: ActivitySource = { searchPlaces: async () => { throw new Error("source down"); }, searchEvents: async () => [] };
    state.source = broken;
    const client = scripted([toolUse("t1", "search_places", { query: "bowling" }), endTurn]);
    const out = await runLoop({ client, state, budget: { maxToolCalls: 20, maxTokens: 30000, timeoutMs: 60000 } });
    expect(out.gaps.join()).toMatch(/source down/);
  });
});

describe("runPlanningAgent", () => {
  it("no key and no client: deterministic fallback, same scores as planCandidates", async () => {
    const ctx = makeContext({ activities: [makeActivity({ id: "dining-ok", category: "dining" })] });
    const res = await runPlanningAgent(ctx);
    const core = planCandidates(ctx);
    expect(res.mode).toBe("fallback");
    expect(res.candidates.map((c) => [c.id, c.score])).toEqual(core.candidates.map((c) => [c.id, c.score]));
    expect(res.candidates.every((c) => c.explanation.length > 0)).toBe(true);
  });

  it("agent path with a scripted client returns mode agent with agent explanations", async () => {
    const ctx = makeContext({ activities: [makeActivity({ id: "dining-ok", category: "dining" })] });
    const slot = findSlots(ctx.team, ctx.members, ctx.busy, ctx.now)[0];
    const client = scripted([
      toolUse("t1", "find_slots"),
      toolUse("t2", "submit_candidates", { candidates: [rowFor("dining-ok", slot, { explanation: "Pizza suits everyone." })] }),
      endTurn,
    ]);
    const res = await runPlanningAgent(ctx, { client });
    expect(res.mode).toBe("agent");
    expect(res.candidates[0].explanation).toBe("Pizza suits everyone.");
    expect(res.usage.toolCalls).toBe(2);
    expect(res.trace.length).toBeGreaterThan(0);
  });

  it("api failure falls back and never throws", async () => {
    const ctx = makeContext({ activities: [makeActivity({ id: "dining-ok", category: "dining" })] });
    const client = { messages: { create: async () => { throw new Error("529 overloaded"); } } };
    const res = await runPlanningAgent(ctx, { client });
    expect(res.mode).toBe("fallback");
    expect(res.gaps.join()).toMatch(/529/);
  });

  it("catalog source never yields discovered activities", () => {
    const ctx = makeContext({ activities: [makeActivity({ id: "dining-ok", name: "Pizza Night" })] });
    return catalogSource(ctx.activities).searchPlaces("pizza").then((hits) => {
      expect(hits[0].activityId).toBe("dining-ok");
      expect(hits.every((h) => h.activityId !== undefined)).toBe(true);
    });
  });

  it("runTool rejects an unknown tool name", async () => {
    const { state } = world();
    await expect(runTool(state, "delete_everything", {})).rejects.toThrow(/unknown tool/);
  });
});
