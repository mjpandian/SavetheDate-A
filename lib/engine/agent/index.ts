// runPlanningAgent: the stream A seam (CONTRACT v2). Runs the Claude tool loop when a key or an
// injected client exists; otherwise, or when the loop yields nothing valid, returns the
// deterministic planCandidates result with mode "fallback". Never throws for model or tool failures.
import Anthropic from "@anthropic-ai/sdk";
import type { Activity, AgentResult, Candidate, PlanContext } from "@/lib/types";
import { planCandidates, shortlist } from "../index";
import { resolveBudget, type Budget } from "./budget";
import { runLoop, type LoopOutcome, type ModelClient } from "./loop";
import { catalogSource, type ActivitySource } from "./sources";
import type { RunState } from "./tools";

export interface AgentOptions {
  /** Anthropic client. Tests inject a scripted fake; default is built from ANTHROPIC_API_KEY. */
  client?: ModelClient;
  /** Search backend. Default: catalogSource over ctx.activities. */
  source?: ActivitySource;
  /** Web search tool. Not in this build: a true value adds a gap and nothing else. */
  enableWebSearch?: boolean;
  budget?: Partial<Budget>;
  onProgress?: (e: { step: string; detail?: string }) => void;
}

const EMPTY_USAGE = { toolCalls: 0, inputTokens: 0, outputTokens: 0 };

export async function runPlanningAgent(ctx: PlanContext, opts: AgentOptions = {}): Promise<AgentResult> {
  const preGaps = opts.enableWebSearch ? ["web_search is not available in this build"] : [];
  const client = opts.client ?? (process.env.ANTHROPIC_API_KEY ? (new Anthropic() as unknown as ModelClient) : undefined);
  if (!client) return fallback(ctx, [...preGaps, "no API key: deterministic planner"]);

  const state: RunState = {
    ctx,
    source: opts.source ?? catalogSource(ctx.activities),
    slots: [],
    refs: new Map(),
  };

  let outcome: LoopOutcome;
  try {
    outcome = await runLoop({ client, state, budget: resolveBudget(opts.budget), onProgress: opts.onProgress });
  } catch (e) {
    return fallback(ctx, [...preGaps, `agent failed: ${e instanceof Error ? e.message : String(e)}`]);
  }

  if (outcome.accepted.length === 0) {
    return fallback(ctx, [...preGaps, ...outcome.gaps, "agent produced no valid options"], outcome);
  }

  // One row per activity (its best slot), then the per-category shortlist.
  const bestByActivity = new Map<string, Candidate>();
  for (const c of outcome.accepted) {
    const current = bestByActivity.get(c.activityId);
    if (!current || compareBestSlot(c, current) < 0) bestByActivity.set(c.activityId, c);
  }
  const { candidates, emptyCategories } = shortlist([...bestByActivity.values()], ctx.activities, outcome.discovered);
  const used = new Set(candidates.map((c) => c.activityId));
  const discovered = outcome.discovered.filter((d) => used.has(d.id));
  const byId = resolver(ctx.activities, discovered);

  return {
    candidates: candidates.map((c) => (c.explanation ? c : { ...c, explanation: templateExplanation(c, byId(c.activityId)) })),
    emptyCategories,
    discovered,
    mode: "agent",
    trace: outcome.trace.entries,
    usage: outcome.usage,
    gaps: [...preGaps, ...outcome.gaps],
  };
}

/** Same activity in several slots: higher score, then attendance, then earlier start (as in planCandidates). */
function compareBestSlot(a: Candidate, b: Candidate): number {
  return b.score - a.score || b.attendancePct - a.attendancePct || Date.parse(a.slotStart) - Date.parse(b.slotStart);
}

/** Deterministic planner result with template explanations: the no-key path and every agent failure. */
function fallback(ctx: PlanContext, gaps: string[], outcome?: LoopOutcome): AgentResult {
  const plan = planCandidates(ctx);
  const byId = resolver(ctx.activities, []);
  return {
    candidates: plan.candidates.map((c) => (c.explanation ? c : { ...c, explanation: templateExplanation(c, byId(c.activityId)) })),
    emptyCategories: plan.emptyCategories,
    discovered: [],
    mode: "fallback",
    trace: outcome?.trace.entries ?? [],
    usage: outcome?.usage ?? EMPTY_USAGE,
    gaps,
  };
}

function resolver(catalog: readonly Activity[], discovered: readonly Activity[]) {
  return (id: string) => catalog.find((a) => a.id === id) ?? discovered.find((a) => a.id === id);
}

/** Explanation for rows the agent left empty, or for the fallback. Uses only code-computed numbers. */
export function templateExplanation(c: Candidate, activity: Activity | undefined): string {
  const name = activity?.name ?? c.activityId;
  const estimate = c.priceIsEstimate ? " (estimated price)" : "";
  const text = `${name}${estimate}: ${c.matchedMemberIds.length} members like it, ${c.attendancePct}% of the team can make the slot. Weather: ${c.weather}.`;
  return text.slice(0, 300);
}
