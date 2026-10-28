// Stream C. The ONLY module that talks to the backend (or to fixtures in mock mode).
// One typed function per route in workstreams/CONTRACT.md. No screen may call fetch
// or import fixtures directly.
//
// Mock mode: NEXT_PUBLIC_USE_MOCKS=1 serves fixtures/ and keeps ratings, votes and
// removals in a module-level store. Unset the variable to talk to the real /api routes.
import {
  CATEGORIES,
  type Activity,
  type Ballot,
  type Candidate,
  type Category,
  type Member,
  type PastEvent,
  type Rating,
  type Run,
  type TallyRow,
  type Team,
} from "@/lib/types";

export const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS === "1";
const BASE = "/api";

// ---- response shapes that the contract describes but lib/types.ts does not export ----
export interface MemberSummary { id: string; name: string }
export type PastEventView = PastEvent & { activityName: string; teamAvgRating: number | null };
export interface TallyResponse { rows: TallyRow[]; ballotsCast: number }
export type RankedRow = TallyRow & { candidate: Candidate };
export interface ResultResponse { winner: Candidate | null; ranking: RankedRow[] }

/**
 * Candidate plus the activity facts a card must show. The frozen contract's `Candidate`
 * only carries `activityId`, so name, category and price are joined in here from
 * `listActivities()`. See workstreams/C-frontend/contract-requests.md.
 */
export interface CandidateView extends Candidate {
  activityName: string;
  category: Category | null;
  pricePerPerson: number | null;
}

export class ApiError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "ApiError";
  }
}

export function enrich(candidate: Candidate, activities: Activity[]): CandidateView {
  const a = activities.find((x) => x.id === candidate.activityId);
  return {
    ...candidate,
    activityName: a?.name ?? candidate.activityId,
    category: a?.category ?? null,
    pricePerPerson: a?.pricePerPerson ?? null,
  };
}

// --------------------------------------------------------------------------------------
// Real HTTP
// --------------------------------------------------------------------------------------
async function http<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    throw new ApiError("Could not reach the server. Check your connection and try again.");
  }
  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`.trim();
    try {
      const data = (await res.json()) as { error?: unknown };
      if (data && typeof data.error === "string") message = data.error;
    } catch {
      /* keep the status text */
    }
    throw new ApiError(message, res.status);
  }
  return (await res.json()) as T;
}

// --------------------------------------------------------------------------------------
// Mock store (module level, lives until the page is reloaded)
// --------------------------------------------------------------------------------------
interface MockState {
  members: Member[];
  activities: Activity[];
  events: PastEvent[];
  ratings: Rating[];
  team: Team;
  run: Run | null;
  baseRun: Run;
  ballots: Record<string, Record<string, Ballot>>; // runId -> memberId -> ballot
  runCounter: number;
}

let state: MockState | null = null;
const clone = <T,>(v: T): T => structuredClone(v);
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function mock(): Promise<MockState> {
  if (state) return state;
  const [members, activities, events, team, run] = await Promise.all([
    import("@/fixtures/members.json"),
    import("@/fixtures/activities.json"),
    import("@/fixtures/events.json"),
    import("@/fixtures/team.json"),
    import("@/fixtures/run.json"),
  ]);
  const baseRun = clone(run.default) as unknown as Run;
  state = {
    members: clone(members.default) as unknown as Member[],
    activities: clone(activities.default) as unknown as Activity[],
    events: clone(events.default.events) as unknown as PastEvent[],
    ratings: clone(events.default.ratings) as unknown as Rating[],
    team: clone(team.default) as unknown as Team,
    run: clone(baseRun),
    baseRun,
    ballots: {},
    runCounter: 1,
  };
  return state;
}

/** Tie rule from the contract: more points, then higher attendance, then lower price. */
function rankRows(s: MockState, run: Run, rows: TallyRow[]): RankedRow[] {
  const price = (c: Candidate) => s.activities.find((a) => a.id === c.activityId)?.pricePerPerson ?? Infinity;
  const withCandidate = rows
    .map((r) => ({ ...r, candidate: run.candidates.find((c) => c.id === r.candidateId) }))
    .filter((r): r is RankedRow => r.candidate !== undefined);
  return withCandidate.sort(
    (a, b) =>
      b.points - a.points ||
      b.candidate.attendancePct - a.candidate.attendancePct ||
      price(a.candidate) - price(b.candidate),
  );
}

function tallyFor(s: MockState, runId: string): { rows: TallyRow[]; ballotsCast: number } {
  const ballots = Object.values(s.ballots[runId] ?? {});
  const acc = new Map<string, TallyRow>();
  for (const b of ballots) {
    b.ranking.forEach((candidateId, i) => {
      const row = acc.get(candidateId) ?? { candidateId, points: 0, firstChoiceVotes: 0 };
      row.points += 3 - i;
      if (i === 0) row.firstChoiceVotes += 1;
      acc.set(candidateId, row);
    });
  }
  return { rows: [...acc.values()], ballotsCast: ballots.length };
}

function buildIcs(c: Candidate, a: Activity | undefined, team: Team): string {
  const stamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const title = a?.name ?? "Team event";
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SavetheDate//Team Social Event Planner//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${c.id}@savethedate.local`,
    `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(c.slotStart)}`,
    `DTEND:${stamp(c.slotEnd)}`,
    `SUMMARY:${title}`,
    `LOCATION:${team.city}`,
    `DESCRIPTION:${c.explanation.replace(/\r?\n/g, " ")} Source: ${c.sourceUrl}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}

// --------------------------------------------------------------------------------------
// Public API: one function per contract route (plus listActivities, see contract-requests.md)
// --------------------------------------------------------------------------------------
export const api = {
  /** GET /members */
  async listMembers(): Promise<MemberSummary[]> {
    if (!USE_MOCKS) return http("GET", "/members");
    const s = await mock();
    await sleep(120);
    return s.members.map(({ id, name }) => ({ id, name }));
  },

  /** GET /members/:id (own record only) */
  async getMember(id: string): Promise<Member> {
    if (!USE_MOCKS) return http("GET", `/members/${encodeURIComponent(id)}`);
    const s = await mock();
    await sleep(120);
    const m = s.members.find((x) => x.id === id);
    if (!m) throw new ApiError("Member not found", 404);
    return clone(m);
  },

  /** PUT /members/:id */
  async saveMember(id: string, prefs: { categories: Category[]; tags: string[] }): Promise<Member> {
    if (!USE_MOCKS) return http("PUT", `/members/${encodeURIComponent(id)}`, prefs);
    const s = await mock();
    await sleep(200);
    const m = s.members.find((x) => x.id === id);
    if (!m) throw new ApiError("Member not found", 404);
    m.categories = prefs.categories.filter((c) => (CATEGORIES as readonly string[]).includes(c));
    m.tags = prefs.tags;
    return clone(m);
  },

  /** GET /events */
  async listEvents(): Promise<PastEventView[]> {
    if (!USE_MOCKS) return http("GET", "/events");
    const s = await mock();
    await sleep(120);
    return s.events.map((e) => {
      const scores = s.ratings.filter((r) => r.eventId === e.id).map((r) => r.score);
      return {
        ...clone(e),
        activityName: s.activities.find((a) => a.id === e.activityId)?.name ?? e.activityId,
        teamAvgRating: scores.length ? scores.reduce((x, y) => x + y, 0) / scores.length : null,
      };
    });
  },

  /** POST /ratings */
  async rate(eventId: string, memberId: string, score: 1 | 2 | 3 | 4 | 5): Promise<{ ok: true }> {
    if (!USE_MOCKS) return http("POST", "/ratings", { eventId, memberId, score });
    const s = await mock();
    await sleep(150);
    const existing = s.ratings.find((r) => r.eventId === eventId && r.memberId === memberId);
    if (existing) existing.score = score;
    else s.ratings.push({ id: `r-${s.ratings.length + 1}`, eventId, memberId, score });
    return { ok: true };
  },

  /** GET /team */
  async getTeam(): Promise<Team> {
    if (!USE_MOCKS) return http("GET", "/team");
    const s = await mock();
    await sleep(100);
    return clone(s.team);
  },

  /** PUT /team (partial) */
  async saveTeam(patch: Partial<Team>): Promise<Team> {
    if (!USE_MOCKS) return http("PUT", "/team", patch);
    const s = await mock();
    await sleep(200);
    s.team = { ...s.team, ...patch };
    return clone(s.team);
  },

  /** POST /plan. Mock mode applies the budget and attendance rules so settings visibly matter. */
  async runPlan(): Promise<Run> {
    if (!USE_MOCKS) return http("POST", "/plan");
    const s = await mock();
    await sleep(1000);
    s.runCounter += 1;
    const actOf = (c: Candidate) => s.activities.find((a) => a.id === c.activityId);
    const kept = s.baseRun.candidates.filter((c) => {
      const a = actOf(c);
      return !!a && a.pricePerPerson <= s.team.limit && c.attendancePct >= s.team.attendanceThresholdPct;
    });
    const present = new Set(kept.map((c) => actOf(c)?.category));
    s.run = {
      id: `run-${s.runCounter}`,
      createdAt: new Date().toISOString(),
      candidates: clone(kept),
      emptyCategories: CATEGORIES.filter((cat) => !present.has(cat)),
      discovered: clone(s.baseRun.discovered ?? []), // contract v2: activities the agent found
    };
    return clone(s.run);
  },

  /** GET /runs/latest */
  async latestRun(): Promise<Run | null> {
    if (!USE_MOCKS) return http("GET", "/runs/latest");
    const s = await mock();
    await sleep(150);
    return s.run ? clone(s.run) : null;
  },

  /** DELETE /runs/:runId/candidates/:candidateId */
  async removeCandidate(runId: string, candidateId: string): Promise<Run> {
    if (!USE_MOCKS) {
      return http("DELETE", `/runs/${encodeURIComponent(runId)}/candidates/${encodeURIComponent(candidateId)}`);
    }
    const s = await mock();
    await sleep(200);
    if (!s.run || s.run.id !== runId) throw new ApiError("Run not found", 404);
    s.run.candidates = s.run.candidates.filter((c) => c.id !== candidateId);
    const present = new Set(s.run.candidates.map((c) => s.activities.find((a) => a.id === c.activityId)?.category));
    s.run.emptyCategories = CATEGORIES.filter((cat) => !present.has(cat));
    return clone(s.run);
  },

  /** POST /votes (re-voting replaces the member's ballot) */
  async castVote(ballot: Ballot): Promise<{ ok: true }> {
    if (!USE_MOCKS) return http("POST", "/votes", ballot);
    const s = await mock();
    await sleep(200);
    if (!s.run || s.run.id !== ballot.runId) throw new ApiError("This run is no longer open for voting", 409);
    const ids = new Set(s.run.candidates.map((c) => c.id));
    const distinct = new Set(ballot.ranking);
    if (distinct.size !== 3 || !ballot.ranking.every((id) => ids.has(id))) {
      throw new ApiError("Pick three different options from the shortlist", 400);
    }
    (s.ballots[ballot.runId] ??= {})[ballot.memberId] = clone(ballot);
    return { ok: true };
  },

  /** GET /votes/tally?runId= */
  async tally(runId: string): Promise<TallyResponse> {
    if (!USE_MOCKS) return http("GET", `/votes/tally?runId=${encodeURIComponent(runId)}`);
    const s = await mock();
    await sleep(80);
    if (!s.run || s.run.id !== runId) return { rows: [], ballotsCast: 0 };
    const { rows, ballotsCast } = tallyFor(s, runId);
    const ranked = rankRows(s, s.run, rows).map(({ candidate: _candidate, ...row }) => row);
    return { rows: ranked, ballotsCast };
  },

  /** GET /result?runId= */
  async result(runId: string): Promise<ResultResponse> {
    if (!USE_MOCKS) return http("GET", `/result?runId=${encodeURIComponent(runId)}`);
    const s = await mock();
    await sleep(150);
    if (!s.run || s.run.id !== runId) return { winner: null, ranking: [] };
    const ranking = rankRows(s, s.run, tallyFor(s, runId).rows);
    return { winner: ranking[0] ? clone(ranking[0].candidate) : null, ranking: clone(ranking) };
  },

  /**
   * GET /result/ics?runId= as a link target. Real mode: the route URL (download attachment).
   * Mock mode: a blob URL built from the winner, so the link also works without a backend.
   */
  async icsHref(runId: string): Promise<string | null> {
    if (!USE_MOCKS) return `${BASE}/result/ics?runId=${encodeURIComponent(runId)}`;
    const s = await mock();
    if (!s.run || s.run.id !== runId) return null;
    const winner = rankRows(s, s.run, tallyFor(s, runId).rows)[0]?.candidate;
    if (!winner) return null;
    const ics = buildIcs(winner, s.activities.find((a) => a.id === winner.activityId), s.team);
    return URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
  },

  /**
   * Activity catalog, used to show name, category and price on cards.
   * NOT in the frozen contract yet (see contract-requests.md). Real mode returns [] if the
   * route is missing, so screens degrade to showing the activity id instead of breaking.
   */
  async listActivities(): Promise<Activity[]> {
    if (!USE_MOCKS) {
      try {
        return await http<Activity[]>("GET", "/activities");
      } catch {
        return [];
      }
    }
    const s = await mock();
    await sleep(60);
    return clone(s.activities);
  },
};
