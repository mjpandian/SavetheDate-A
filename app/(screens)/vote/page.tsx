"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, type TallyResponse } from "@/lib/api-client";
import { Avatar } from "@/components/Avatar";
import { CategoryGroup } from "@/components/CategoryGroup";
import { Confetti } from "@/components/Confetti";
import { ErrorBanner } from "@/components/ErrorBanner";
import { HeroBanner } from "@/components/HeroBanner";
import { useMember } from "@/components/MemberProvider";
import { RankPicker, isComplete, type Ranking } from "@/components/RankPicker";
import { Spinner } from "@/components/Spinner";
import { TallyTable } from "@/components/TallyTable";
import { useCurrency } from "@/components/TeamProvider";
import { formatMoney, formatSlot } from "@/components/format";
import { errMsg, useRunData } from "@/components/useRunData";
import { CATEGORIES, type Category } from "@/lib/types";

const EMPTY: Ranking = ["", "", ""];

/** Your picks as a little podium: 2nd, 1st, 3rd, tallest block in the middle. */
function Podium({ ranking, labels }: { ranking: Ranking; labels: Record<string, string> }) {
  return (
    <ol className="podium m-0 p-0" aria-label="Your podium">
      {[1, 0, 2].map((slot) => {
        const id = ranking[slot];
        return (
          <li key={slot} className={`step-${slot + 1}`}>
            <span className="medal">{slot + 1}</span>
            <span className={`block ${id ? "" : "empty"}`}>{id ? labels[id] ?? id : "Pick one"}</span>
          </li>
        );
      })}
    </ol>
  );
}

export default function VotePage() {
  const { run, candidates, names, loading, error: loadError, reload } = useRunData();
  const { member, memberId, members } = useMember();
  const currency = useCurrency();
  const [ranking, setRanking] = useState<Ranking>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tally, setTally] = useState<TallyResponse>({ rows: [], ballotsCast: 0 });
  const [burst, setBurst] = useState(0);

  // A new person or a new run starts with a clean ballot.
  useEffect(() => {
    setRanking(EMPTY);
    setSaved(false);
  }, [memberId, run?.id]);

  const refreshTally = useCallback(async () => {
    if (!run) return;
    try {
      setTally(await api.tally(run.id));
    } catch {
      /* the live panel is best effort; the next poll will retry */
    }
  }, [run]);

  useEffect(() => {
    void refreshTally();
    const t = setInterval(() => void refreshTally(), 3000);
    return () => clearInterval(t);
  }, [refreshTally]);

  const options = useMemo(
    () =>
      candidates.map((c) => ({
        id: c.id,
        label: `${c.activityName} · ${c.pricePerPerson === null ? "?" : formatMoney(c.pricePerPerson, currency)} · ${formatSlot(c.slotStart, c.slotEnd)}`,
      })),
    [candidates, currency],
  );
  const labels = useMemo(() => Object.fromEntries(candidates.map((c) => [c.id, c.activityName])), [candidates]);
  const groups = useMemo(
    () =>
      CATEGORIES.map((cat) => ({ category: cat as Category, items: candidates.filter((c) => c.category === cat) })).filter(
        (g) => g.items.length,
      ),
    [candidates],
  );

  async function submit() {
    if (!run || !memberId || !isComplete(ranking)) return;
    setSaving(true);
    setError(null);
    try {
      await api.castVote({ runId: run.id, memberId, ranking: [ranking[0], ranking[1], ranking[2]] });
      setSaved(true);
      setBurst((b) => b + 1);
      await refreshTally();
    } catch (e) {
      setSaved(false);
      setError(errMsg(e));
    } finally {
      setSaving(false);
    }
  }

  if (loading && !run) return <Spinner label="Loading the shortlist" />;
  if (loadError) return <ErrorBanner message={loadError} onRetry={reload} />;
  if (!run || candidates.length === 0) {
    return (
      <div className="grid gap-4">
        <HeroBanner title="Nothing to vote on" highlight="yet" subtitle="Ask the organizer to run planning first, then come back to rank your favorites." />
        <p>
          <Link href="/plan" className="link-party">Go to Plan</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-8">
      <Confetti burst={burst} />
      <HeroBanner
        title={`${member ? `${member.name}, who's` : "Who's"} in? Rank your`}
        highlight="top 3"
        subtitle="First choice gets 3 points, second 2, third 1. You can change your ballot any time until the next planning run."
      />

      <section
        aria-label="Your ballot"
        className="grid gap-5 rounded-2xl border-2 border-[var(--ink)] bg-white p-5 shadow-[5px_5px_0_var(--ink)] dark:bg-zinc-900"
      >
        <div className="flex items-center gap-3">
          {member && <Avatar id={member.id} name={member.name} size={40} ring />}
          <h2 className="display text-xl font-extrabold">Your podium</h2>
        </div>
        <Podium ranking={ranking} labels={labels} />
        <RankPicker
          options={options}
          value={ranking}
          onChange={(r) => {
            setRanking(r);
            setSaved(false);
          }}
          disabled={saving}
        />
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={submit} disabled={!isComplete(ranking) || saving || !memberId} className="btn-party">
            {saving ? "Saving…" : saved ? "Update my ballot" : "Submit my ballot"}
          </button>
          <p role="status" className="text-sm">
            {saved ? (
              <span className="font-extrabold text-[var(--tomato)]">Ballot saved. You're in! You can still change it.</span>
            ) : isComplete(ranking) ? null : (
              <span className="text-zinc-600 dark:text-zinc-400">Choose three different options to submit.</span>
            )}
          </p>
        </div>
        {error && <ErrorBanner message={error} />}
      </section>

      <TallyTable rows={tally.rows} labels={labels} ballotsCast={tally.ballotsCast} totalMembers={members.length || undefined} />

      <div className="grid gap-9">
        <h2 className="display text-2xl font-extrabold">The options</h2>
        {groups.map((g) => (
          <CategoryGroup key={g.category} category={g.category} candidates={g.items} names={names} />
        ))}
      </div>
    </div>
  );
}
