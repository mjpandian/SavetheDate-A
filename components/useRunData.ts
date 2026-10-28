"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, enrich, type CandidateView } from "@/lib/api-client";
import type { Activity, Run } from "@/lib/types";

export const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong. Please try again.");

/** Latest run, enriched candidates and a member-name lookup. Shared by Plan, Vote and Result. */
export function useRunData() {
  const [run, setRun] = useState<Run | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [r, a, m] = await Promise.all([api.latestRun(), api.listActivities(), api.listMembers()]);
      setRun(r);
      setActivities(a);
      setNames(Object.fromEntries(m.map((x) => [x.id, x.name])));
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Contract v2: an activityId resolves in the catalog first, then in `Run.discovered`
  // (activities the planning agent found, ids starting "disc:").
  const known: Activity[] = useMemo(() => {
    const ids = new Set(activities.map((a) => a.id));
    return [...activities, ...(run?.discovered ?? []).filter((a) => !ids.has(a.id))];
  }, [activities, run]);

  const candidates: CandidateView[] = useMemo(
    () => (run ? run.candidates.map((c) => enrich(c, known)) : []),
    [run, known],
  );

  return { run, setRun, candidates, activities: known, names, loading, error, setError, reload: load };
}
