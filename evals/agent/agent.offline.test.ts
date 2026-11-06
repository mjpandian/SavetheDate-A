/**
 * Offline tier: no network, no key. Skipped until stream A lands lib/engine and lib/engine/agent.
 * Guards the contract-v2 guarantee: whatever the model does (or fails to do), no option that breaks
 * C1, C3, C4, C5 reaches the team, private data stays private, and the app still works without a key.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CATEGORIES } from "@/lib/types";
import { HAS_AGENT, runAgent, runCore } from "./adapter";
import { checkResult, leaks, scoreAgreement } from "./oracle";
import { CANARY, DISCOVERY_URLS, SCENARIOS } from "./scenarios";
import { buildAttacks, cheatingClient, failingClient } from "./scripted";

const key = process.env.ANTHROPIC_API_KEY;
beforeEach(() => { delete process.env.ANTHROPIC_API_KEY; });
afterEach(() => { if (key) process.env.ANTHROPIC_API_KEY = key; });

const opts = (s: (typeof SCENARIOS)[number], extra: Record<string, unknown> = {}) => ({ ...(s.source ? { source: s.source } : {}), ...extra });
const urls = (s: (typeof SCENARIOS)[number]) => (s.source ? DISCOVERY_URLS : []);

describe.skipIf(!HAS_AGENT)("planning agent: no key => deterministic fallback", () => {
  for (const s of SCENARIOS) {
    it(`${s.name}: mode=fallback, equals planCandidates, zero oracle violations, explanations filled`, async () => {
      const res = await runAgent(s.ctx, opts(s));
      const core = runCore(s.ctx);
      expect(res.mode).toBe("fallback");
      expect(checkResult(s.ctx, res, { allowedDiscoveredUrls: urls(s) })).toEqual([]);
      expect(res.candidates.map((c) => [c.activityId, c.slotStart, c.score])).toEqual(core.candidates.map((c) => [c.activityId, c.slotStart, c.score]));
      expect(leaks(res, [CANARY])).toEqual([]);
      if (s.expectEmpty) { expect(res.candidates).toEqual([]); expect(res.emptyCategories).toHaveLength(CATEGORIES.length); }
    });
  }

  it("is deterministic", async () => {
    const s = SCENARIOS[0];
    const a = await runAgent(s.ctx), b = await runAgent(s.ctx);
    expect(a.candidates).toEqual(b.candidates);
  });
});

describe.skipIf(!HAS_AGENT)("planning agent: API failure => fallback, never throws", () => {
  for (const s of SCENARIOS.slice(0, 3)) {
    it(s.name, async () => {
      const client = failingClient();
      const res = await runAgent(s.ctx, opts(s, { client }));
      expect(res.mode).toBe("fallback");
      expect(checkResult(s.ctx, res)).toEqual([]);
      expect(res.candidates.every((c) => c.explanation.trim().length > 0)).toBe(true);
    });
  }
});

describe.skipIf(!HAS_AGENT)("planning agent: scripted cheating model cannot get a bad row through", () => {
  for (const s of SCENARIOS.filter((x) => x.coverage || x.name === "tight-budget" || x.name === "bad-weather-week")) {
    it(s.name, async () => {
      const core = runCore(s.ctx);
      if (!core.candidates.length) return; // nothing to anchor the attacks on in this world
      const g = core.candidates[0];
      const attacks = buildAttacks(s.ctx, g);
      const client = cheatingClient(g, attacks);
      const res = await runAgent(s.ctx, opts(s, { client }));

      // Must run on the agent path: a silent fallback would pass the attack checks trivially.
      expect(res.mode, "cheating model fell back to the planner; check ASSUMPTIONS in scripted.ts").toBe("agent");
      expect(checkResult(s.ctx, res, { allowedDiscoveredUrls: urls(s) })).toEqual([]);
      expect(scoreAgreement(core, res)).toEqual([]);                       // forged score ignored, code recomputes
      for (const a of attacks) expect(res.candidates.some((c) => a.check(c, s.ctx.activities)), `attack leaked: ${a.label}`).toBe(false);

      // Control: the clean row is accepted, so the harness assumptions (tool names, submit shape) hold.
      expect(res.candidates.some((c) => c.activityId === g.activityId && c.slotStart === g.slotStart), "control row dropped: check ASSUMPTIONS in scripted.ts").toBe(true);
      expect(res.gaps?.length ?? 0).toBeGreaterThan(0);                    // rejected rows are reported, not silent
      expect(client.calls).toBeGreaterThanOrEqual(2);
    });
  }
});

describe.skipIf(!HAS_AGENT)("planning agent: per-run caps end the loop and fall back", () => {
  const s = SCENARIOS[0];
  const g = runCore(s.ctx).candidates[0];
  const attacks = buildAttacks(s.ctx, g);
  const caps: [string, Record<string, number>, string][] = [
    ["tool-call cap", { maxToolCalls: 1 }, "tool-call cap reached"],
    ["token cap", { maxTokens: 100 }, "token cap reached"],
    ["timeout", { timeoutMs: -1 }, "timeout reached"],
  ];
  for (const [label, budget, gap] of caps) {
    it(`${label}: stops, reports the gap, and never returns a cheating row`, async () => {
      const client = cheatingClient(g, attacks);
      const res = await runAgent(s.ctx, opts(s, { client, budget }));
      expect(res.gaps ?? []).toContain(gap);
      expect(res.mode).toBe("fallback");
      expect(checkResult(s.ctx, res)).toEqual([]);
      for (const a of attacks) expect(res.candidates.some((c) => a.check(c, s.ctx.activities)), `attack leaked: ${a.label}`).toBe(false);
    });
  }
});

describe.skipIf(!HAS_AGENT)("planning agent: privacy and read-only surface", () => {
  it("constraints canary never appears in output or trace (scripted agent path)", async () => {
    const s = SCENARIOS[0]; const core = runCore(s.ctx);
    if (!core.candidates.length) return;
    const g = core.candidates[0];
    const res = await runAgent(s.ctx, { client: cheatingClient(g, []) });
    expect(leaks(res, [CANARY])).toEqual([]);
  });
});
