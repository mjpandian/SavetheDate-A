import { getDb } from "@/lib/db";
import { buildIcs } from "@/lib/ics";
import { loadActivities, resolveActivity } from "@/lib/plan-provider";
import { fail, handle } from "../../_lib/http";
import { computeResult, resolveRun } from "../../_lib/runs";

/** GET /api/result/ics?runId= -> text/calendar attachment for the winner (404 until someone has voted). */
export function GET(req: Request) {
  return handle(() => {
    const db = getDb();
    const run = resolveRun(db, new URL(req.url).searchParams.get("runId"));
    const { winner } = computeResult(db, run);
    if (!winner) fail(404, "No winner yet: no votes have been cast");
    const activity = resolveActivity(winner.activityId, loadActivities(), run?.discovered);
    return new Response(buildIcs(winner, activity), {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'attachment; filename="team-event.ics"',
      },
    });
  });
}
