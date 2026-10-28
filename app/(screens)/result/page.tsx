"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, enrich, type ResultResponse } from "@/lib/api-client";
import { CandidateCard } from "@/components/CandidateCard";
import { Confetti } from "@/components/Confetti";
import { ErrorBanner } from "@/components/ErrorBanner";
import { HeroBanner } from "@/components/HeroBanner";
import { useHoliday } from "@/components/HolidayProvider";
import { Spinner } from "@/components/Spinner";
import { useCurrency } from "@/components/TeamProvider";
import { daysUntil, formatMoney } from "@/components/format";
import { errMsg, useRunData } from "@/components/useRunData";

const MEDAL = ["#FFD23F", "#C9D0E4", "#E0985A"];

function tieNote(res: ResultResponse, price: (id: string) => number | null, currency: string): string | null {
  const [a, b] = res.ranking;
  if (!a || !b || a.points !== b.points) return null;
  if (a.candidate.attendancePct !== b.candidate.attendancePct) {
    return `Tie on ${a.points} points. The higher attendance (${Math.round(a.candidate.attendancePct)}% against ${Math.round(b.candidate.attendancePct)}%) breaks it.`;
  }
  const pa = price(a.candidate.activityId);
  const pb = price(b.candidate.activityId);
  return `Tie on ${a.points} points and on attendance. The lower price${pa !== null && pb !== null ? ` (${formatMoney(pa, currency)} against ${formatMoney(pb, currency)})` : ""} breaks it.`;
}

export default function ResultPage() {
  const { run, activities, names, loading, error: loadError, reload } = useRunData();
  const { holiday } = useHoliday();
  const currency = useCurrency();
  const [result, setResult] = useState<ResultResponse | null>(null);
  const [icsHref, setIcsHref] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [burst, setBurst] = useState(0);

  useEffect(() => {
    if (!run) return;
    let alive = true;
    setBusy(true);
    setError(null);
    Promise.all([api.result(run.id), api.icsHref(run.id)])
      .then(([r, href]) => {
        if (!alive) return;
        setResult(r);
        setIcsHref(href);
      })
      .catch((e: unknown) => alive && setError(errMsg(e)))
      .finally(() => alive && setBusy(false));
    return () => {
      alive = false;
    };
  }, [run]);

  // Drumroll first, then the reveal and the confetti.
  useEffect(() => {
    setRevealed(false);
    if (!result?.winner) return;
    const t = setTimeout(() => {
      setRevealed(true);
      setBurst((b) => b + 1);
    }, 1400);
    return () => clearTimeout(t);
  }, [result]);

  if ((loading && !run) || busy) return <Spinner label="Counting the votes" />;
  if (loadError) return <ErrorBanner message={loadError} onRetry={reload} />;
  if (error) return <ErrorBanner message={error} />;

  if (!run || !result || !result.winner) {
    return (
      <div className="grid gap-4">
        <HeroBanner title="And the winner is" highlight="…nobody yet" subtitle="Once people vote, the winning option shows up here with a drumroll." />
        <p className="rounded-2xl border-2 border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
          No ballots yet, so there is no winner.{" "}
          <Link href="/vote" className="link-party">Go to Vote</Link>
        </p>
      </div>
    );
  }

  if (!revealed) {
    return (
      <div className="drum" role="status" aria-live="polite">
        <p className="display text-4xl font-extrabold sm:text-6xl">
          <span className="gradient-text">Drumroll…</span>
        </p>
        <span className="dots" aria-hidden="true"><i /><i /><i /></span>
        <p className="font-bold text-zinc-600 dark:text-zinc-400">Counting the votes</p>
      </div>
    );
  }

  const winner = enrich(result.winner, activities);
  const priceOf = (activityId: string) => activities.find((a) => a.id === activityId)?.pricePerPerson ?? null;
  const note = tieNote(result, priceOf, currency);

  return (
    <div className="grid gap-9">
      <Confetti burst={burst} big />
      <HeroBanner
        title="We have a"
        highlight="winner"
        subtitle="The team has spoken. Add it to your calendar and get ready."
      />

      <section aria-label="Winner" className="grid gap-5">
        <h2 className="display text-2xl font-extrabold">Winner</h2>
        <div className="spotlight winner-pop mx-auto w-full max-w-xl">
          <CandidateCard candidate={winner} names={names} highlight />
        </div>
        <p className="mx-auto flex flex-wrap items-center justify-center gap-3">
          <span className="countdown">
            <span aria-hidden="true">{holiday.glyphs[0] ?? "🎉"}</span> {daysUntil(winner.slotStart)}
          </span>
        </p>
        {note && (
          <p role="note" className="mx-auto max-w-xl rounded-xl border-2 border-[var(--ink)] bg-[var(--sun)] px-4 py-2 text-sm font-bold text-[#14103a]">
            {note}
          </p>
        )}
        {icsHref && (
          <div className="text-center">
            <a href={icsHref} download="savethedate-invite.ics" className="btn-party inline-block">
              Download invite (.ics)
            </a>
            <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">Opens in Outlook, Google Calendar and Apple Calendar.</p>
          </div>
        )}
      </section>

      <section aria-label="Full ranking" className="grid gap-3">
        <h2 className="display text-2xl font-extrabold">Full ranking</h2>
        <ol className="grid gap-2.5">
          {result.ranking.map((r, i) => {
            const name = activities.find((a) => a.id === r.candidate.activityId)?.name ?? r.candidate.activityId;
            return (
              <li
                key={r.candidateId}
                className="pop-in flex flex-wrap items-center justify-between gap-2 rounded-2xl border-2 border-[var(--ink)] bg-white px-4 py-2.5 text-sm shadow-[3px_3px_0_var(--ink)] dark:bg-zinc-900"
                style={{ "--i": i } as React.CSSProperties}
              >
                <span className="flex items-center gap-3">
                  <span
                    className="grid size-8 place-items-center rounded-full border-2 border-[var(--ink)] font-extrabold text-[#14103a]"
                    style={{ background: MEDAL[i] ?? "var(--card)" }}
                    aria-hidden="true"
                  >
                    {i + 1}
                  </span>
                  <span className="font-extrabold">{name}</span>
                </span>
                <span className="tabular-nums text-zinc-600 dark:text-zinc-400">
                  {r.points} points · {r.firstChoiceVotes} first {r.firstChoiceVotes === 1 ? "choice" : "choices"}
                </span>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
