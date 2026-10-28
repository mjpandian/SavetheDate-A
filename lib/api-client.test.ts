import { beforeEach, describe, expect, it, vi } from "vitest";
import { validateTeam, toDraft } from "@/components/validateTeam";

// Mock mode is decided when the module loads, so load a fresh copy per test.
async function freshClient() {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_USE_MOCKS", "1");
  return (await import("@/lib/api-client")).api;
}

describe("api-client in mock mode", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it("serves members, team and a latest run from fixtures", async () => {
    const api = await freshClient();
    const members = await api.listMembers();
    expect(members.length).toBeGreaterThanOrEqual(6);
    expect(members[0]).toEqual({ id: expect.any(String), name: expect.any(String) });
    const team = await api.getTeam();
    expect(team.limit).toBe(50);
    expect(team.currency).toBe("USD");
    const run = await api.latestRun();
    expect(run?.candidates.length).toBeGreaterThan(0);
  });

  it("votes then tallies: 3, 2 and 1 points, and re-voting replaces the ballot", async () => {
    const api = await freshClient();
    const run = (await api.latestRun())!;
    const [a, b, c] = run.candidates.map((x) => x.id);
    await api.castVote({ runId: run.id, memberId: "m1", ranking: [a, b, c] });
    await api.castVote({ runId: run.id, memberId: "m2", ranking: [b, a, c] });

    let tally = await api.tally(run.id);
    expect(tally.ballotsCast).toBe(2);
    expect(Object.fromEntries(tally.rows.map((r) => [r.candidateId, r.points]))).toEqual({ [a]: 5, [b]: 5, [c]: 2 });

    // m1 changes their mind: the old ballot must not count twice
    await api.castVote({ runId: run.id, memberId: "m1", ranking: [c, b, a] });
    tally = await api.tally(run.id);
    expect(tally.ballotsCast).toBe(2);
    expect(Object.fromEntries(tally.rows.map((r) => [r.candidateId, r.points]))).toEqual({ [a]: 3, [b]: 5, [c]: 4 });
  });

  it("rejects a ballot with a repeated option", async () => {
    const api = await freshClient();
    const run = (await api.latestRun())!;
    const [a, b] = run.candidates.map((x) => x.id);
    await expect(api.castVote({ runId: run.id, memberId: "m1", ranking: [a, a, b] })).rejects.toThrow(/three different/i);
  });

  it("breaks a points tie by higher attendance, then lower price", async () => {
    const api = await freshClient();
    const run = (await api.latestRun())!;
    const ramen = run.candidates.find((c) => c.id === "cand-ramen")!; // 88%
    const bowling = run.candidates.find((c) => c.id === "cand-bowling")!; // 100%
    const other = run.candidates.find((c) => c.id === "cand-museum")!;
    await api.castVote({ runId: run.id, memberId: "m1", ranking: [ramen.id, bowling.id, other.id] });
    await api.castVote({ runId: run.id, memberId: "m2", ranking: [bowling.id, ramen.id, other.id] });
    const res = await api.result(run.id);
    expect(res.ranking[0].points).toBe(res.ranking[1].points);
    expect(res.winner?.id).toBe("cand-bowling");
  });

  it("returns no winner when nobody voted", async () => {
    const api = await freshClient();
    const run = (await api.latestRun())!;
    expect((await api.result(run.id)).winner).toBeNull();
    expect(await api.icsHref(run.id)).toBeNull();
  });

  it("removes a candidate and reports a category with no options left", async () => {
    const api = await freshClient();
    const run = (await api.latestRun())!;
    const after = await api.removeCandidate(run.id, "cand-bowling"); // the only sports card
    expect(after.candidates.some((c) => c.id === "cand-bowling")).toBe(false);
    expect(after.emptyCategories).toContain("sports");
  });

  it("applies the budget when planning again", async () => {
    const api = await freshClient();
    await api.saveTeam({ limit: 15 });
    const run = await api.runPlan();
    const acts = await api.listActivities();
    expect(run.candidates.length).toBeGreaterThan(0);
    for (const c of run.candidates) {
      expect(acts.find((a) => a.id === c.activityId)!.pricePerPerson).toBeLessThanOrEqual(15);
    }
  });

  it("builds a calendar file for the winner", async () => {
    const api = await freshClient();
    const run = (await api.latestRun())!;
    await api.castVote({ runId: run.id, memberId: "m1", ranking: [run.candidates[0].id, run.candidates[1].id, run.candidates[2].id] });
    const href = await api.icsHref(run.id);
    expect(href).toMatch(/^blob:/);
  });
});

describe("team settings validation", () => {
  const ok = toDraft({
    limit: 40, currency: "EUR", windowDays: 14, eventLengthMin: 120,
    attendanceThresholdPct: 55, noveltyWeeks: 6, city: "Lisbon", timeWindows: [],
  });

  it("accepts the defaults", () => {
    expect(validateTeam(ok)).toEqual({});
  });

  it("flags each invalid field with its own message", () => {
    const errs = validateTeam({ limit: "0", windowDays: "90", attendanceThresholdPct: "101", noveltyWeeks: "-1" });
    expect(Object.keys(errs).sort()).toEqual(["attendanceThresholdPct", "limit", "noveltyWeeks", "windowDays"]);
  });

  it("rejects blanks and decimals where whole numbers are needed", () => {
    expect(validateTeam({ ...ok, limit: "" }).limit).toBeDefined();
    expect(validateTeam({ ...ok, windowDays: "7.5" }).windowDays).toBeDefined();
  });
});
