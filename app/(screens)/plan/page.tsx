"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { api, type CandidateView } from "@/lib/api-client";
import { CATEGORIES, type Category } from "@/lib/types";
import { CategoryGroup } from "@/components/CategoryGroup";
import { ErrorBanner } from "@/components/ErrorBanner";
import { HeroBanner } from "@/components/HeroBanner";
import { PlannerTheater } from "@/components/PlannerTheater";
import { Spinner } from "@/components/Spinner";
import { formatDate } from "@/components/format";
import { errMsg, useRunData } from "@/components/useRunData";

export default function PlanPage() {
  const { run, setRun, candidates, names, loading, error, setError, reload } = useRunData();
  const [planning, setPlanning] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const groups = useMemo(() => {
    const byCat = new Map<Category | null, CandidateView[]>();
    for (const c of candidates) byCat.set(c.category, [...(byCat.get(c.category) ?? []), c]);
    const fixed = CATEGORIES.map((cat) => ({ category: cat as Category | null, items: byCat.get(cat) ?? [] }));
    const other = byCat.get(null);
    return other ? [...fixed, { category: null, items: other }] : fixed;
  }, [candidates]);

  async function runPlanning() {
    setPlanning(true);
    setError(null);
    try {
      setRun(await api.runPlan());
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setPlanning(false);
    }
  }

  async function remove(c: CandidateView) {
    if (!run) return;
    const before = run;
    // Optimistic: drop the card now, roll back if the server refuses.
    setRun({ ...run, candidates: run.candidates.filter((x) => x.id !== c.id) });
    setRemovingId(c.id);
    try {
      setRun(await api.removeCandidate(run.id, c.id));
    } catch (e) {
      setRun(before);
      setError(`Could not remove "${c.activityName}". ${errMsg(e)}`);
    } finally {
      setRemovingId(null);
    }
  }

  const total = candidates.length;
  const populated = groups.filter((g) => g.items.length > 0).length;

  return (
    <div className="grid gap-7">
      <HeroBanner
        title="Let's plan something"
        subtitle="One planning run checks every idea against your budget, everyone's calendar, the weather and your history, then picks the best in each category. Remove anything you don't love, then open the vote."
      >
        <button type="button" onClick={runPlanning} disabled={planning} className="btn-party">
          {planning ? <Spinner label="Planning" /> : run ? "Run planning again" : "Run planning"}
        </button>
      </HeroBanner>

      {error && <ErrorBanner message={error} onRetry={run ? undefined : reload} />}

      {planning && <PlannerTheater />}

      {loading && !run ? (
        <Spinner label="Loading the latest run" />
      ) : !run ? (
        !planning && (
          <p className="rounded-2xl border-2 border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
            No planning run yet. Press &quot;Run planning&quot; to build the first shortlist.
          </p>
        )
      ) : (
        <>
          <p className="text-sm text-zinc-600 dark:text-zinc-400" aria-live="polite">
            Run from {formatDate(run.createdAt)}: <strong className="text-[var(--text)]">{total}</strong>{" "}
            {total === 1 ? "option" : "options"} in <strong className="text-[var(--text)]">{populated}</strong> of{" "}
            {CATEGORIES.length} categories.
            {total > 0 && (
              <>
                {" "}
                Ready?{" "}
                <Link href="/vote" className="link-party">
                  Open the vote
                </Link>
                .
              </>
            )}
          </p>
          <div className={`grid gap-10 transition-opacity ${planning ? "opacity-40" : ""}`} aria-busy={planning}>
            {groups.map((g) => (
              <CategoryGroup
                key={g.category ?? "other"}
                category={g.category}
                candidates={g.items}
                names={names}
                onRemove={remove}
                removingId={removingId}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
