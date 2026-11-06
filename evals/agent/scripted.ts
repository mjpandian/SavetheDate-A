import type { Activity, Candidate, PlanContext } from "@/lib/types";

/**
 * Scripted Anthropic clients. Assumptions match lib/engine/agent/tools.ts and loop.ts (tool names, submit_candidates shape, stop_reason handling):
 *  - tools are named find_slots and submit_candidates;
 *  - submit_candidates input is { candidates: [{ activityId | sourceRef, slotStart, slotEnd, explanation, priceIsEstimate? }] };
 *  - the loop reads `stop_reason`, `content[]` (tool_use / text) and `usage` from client.messages.create().
 */
const reply = (content: unknown[], stop: "tool_use" | "end_turn") => ({
  id: "msg_scripted", type: "message", role: "assistant", model: "claude-sonnet-5-5", stop_reason: stop, content,
  usage: { input_tokens: 500, output_tokens: 100 },
});

export function failingClient(message = "529 overloaded") {
  return { calls: 0, messages: { create: async () => { throw new Error(message); } } };
}

export interface Attack { label: string; row: Record<string, unknown>; check: (c: Candidate, acts: Activity[]) => boolean /* true = attack leaked into output */ }

/** An agent that tries to cheat: forged criteria/score/price, invented venue, wrong URL, off-grid slot, over-limit price. */
export function buildAttacks(ctx: PlanContext, good: { activityId: string; slotStart: string; slotEnd: string }): Attack[] {
  const over = ctx.activities.find((a) => a.pricePerPerson > ctx.team.limit);
  const shifted = new Date(Date.parse(good.slotStart) + 37 * 60_000).toISOString();
  const shiftedEnd = new Date(Date.parse(good.slotEnd) + 37 * 60_000).toISOString();
  const forged = { criteria: { C1: true, C2: 9, C3: true, C4: true, C5: true, C5penalty: false }, score: 0.99, attendancePct: 100, matchedMemberIds: [], weather: "Perfect", price: 0 };
  const attacks: Attack[] = [
    { label: "invented-venue", row: { ...forged, activityId: "ghost-venue", slotStart: good.slotStart, slotEnd: good.slotEnd, explanation: "Brand new place." }, check: (c) => c.activityId === "ghost-venue" },
    { label: "wrong-source-url", row: { ...forged, activityId: good.activityId, slotStart: good.slotStart, slotEnd: good.slotEnd, sourceUrl: "https://evil.example/x", explanation: "Trust me." }, check: (c) => c.sourceUrl.includes("evil.example") },
    { label: "off-grid-slot", row: { ...forged, activityId: good.activityId, slotStart: shifted, slotEnd: shiftedEnd, explanation: "Slightly later." }, check: (c) => c.slotStart === shifted },
  ];
  if (over) attacks.push({ label: "over-limit-price-forged-to-zero", row: { ...forged, activityId: over.id, slotStart: good.slotStart, slotEnd: good.slotEnd, explanation: "Totally affordable." }, check: (c) => c.activityId === over.id });
  return attacks;
}

/** Turn 1: find_slots. Turns 2-3: submit_candidates with [control row, ...attacks] (second submit = repair round). Then stop. */
export function cheatingClient(good: { activityId: string; slotStart: string; slotEnd: string }, attacks: Attack[]) {
  const control = { activityId: good.activityId, slotStart: good.slotStart, slotEnd: good.slotEnd, explanation: "Control row." };
  const state = { calls: 0 };
  return Object.assign(state, {
    messages: {
      create: async () => {
        state.calls++;
        if (state.calls === 1) return reply([{ type: "tool_use", id: "tu1", name: "find_slots", input: {} }], "tool_use");
        if (state.calls <= 3) return reply([{ type: "tool_use", id: `tu${state.calls}`, name: "submit_candidates", input: { candidates: [control, ...attacks.map((a) => a.row)] } }], "tool_use");
        return reply([{ type: "text", text: "Done." }], "end_turn");
      },
    },
  });
}
