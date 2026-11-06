// Run-level logic shared by the plan, votes and result routes.
import { randomUUID } from "node:crypto";
import type { Db } from "@/lib/db";
import { getRun, latestRun, listEvents, listMembers, listRatings, listVotes, saveRun } from "@/lib/db";
import { explain } from "@/lib/explain";
import { loadActivities, loadBusy, loadForecast, resolveActivity, runPlanningAgent } from "@/lib/plan-provider";
import { tallyVotes } from "@/lib/tally";
import type { Candidate, PlanContext, Rating, Run, TallyRow } from "@/lib/types";
import { fail } from "./http";
import { readTeam } from "./team-store";

/** Spec section 6: load inputs, plan, explain, persist. Never throws on a missing API key. */
export async function createRun(db: Db): Promise<Run> {
  const members = listMembers(db);
  const activities = loadActivities();
  const ctx: PlanContext = {
    team: readTeam(),
    members,
    activities,
    history: listEvents(db),
    ratings: listRatings(db) as Rating[],
    busy: loadBusy(),
    forecastFor: loadForecast,
    now: new Date().toISOString(),
  };
  // Agent path when a key exists; otherwise (or on any failure) the deterministic planner, same PlanResult shape.
  const result = await runPlanningAgent(ctx);
  const candidates = await explain(result.candidates, { activities, discovered: result.discovered, members });
  const run: Run = {
    id: randomUUID(),
    createdAt: ctx.now,
    candidates,
    emptyCategories: result.emptyCategories,
    discovered: result.discovered,
  };
  saveRun(db, run);
  return run;
}

/** `runId` given: that run or 404. Omitted: the latest run, or null when none exists. */
export function resolveRun(db: Db, runId: string | null): Run | null {
  if (runId) return getRun(db, runId) ?? fail(404, `Run not found: ${runId}`);
  return latestRun(db);
}

export function computeTally(db: Db, run: Run): { rows: TallyRow[]; ballotsCast: number } {
  const catalog = loadActivities();
  return tallyVotes(listVotes(db, run.id), run.candidates, (id) => resolveActivity(id, catalog, run.discovered)?.pricePerPerson);
}

export function computeResult(db: Db, run: Run | null): {
  winner: Candidate | null;
  ranking: (TallyRow & { candidate: Candidate })[];
} {
  if (!run) return { winner: null, ranking: [] };
  const { rows, ballotsCast } = computeTally(db, run);
  const byId = new Map(run.candidates.map((c) => [c.id, c]));
  const ranking = rows.map((r) => ({ ...r, candidate: byId.get(r.candidateId)! }));
  return { winner: ballotsCast > 0 ? (ranking[0]?.candidate ?? null) : null, ranking };
}
