"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { api, type PastEventView } from "@/lib/api-client";
import { CATEGORIES, type Category } from "@/lib/types";
import { CategoryIcon } from "@/components/CategoryIcon";
import { ErrorBanner } from "@/components/ErrorBanner";
import { MemberSelect, useMember } from "@/components/MemberProvider";
import { Spinner } from "@/components/Spinner";
import { StarRating } from "@/components/StarRating";
import { TagInput } from "@/components/TagInput";
import { CATEGORY_LABEL, CATEGORY_STYLE, formatDate } from "@/components/format";
import { errMsg } from "@/components/useRunData";

type Score = 1 | 2 | 3 | 4 | 5;

export default function MePage() {
  const { member, memberId, loading: membersLoading, error: membersError, reload: reloadMembers } = useMember();
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [events, setEvents] = useState<PastEventView[]>([]);
  const [eventsError, setEventsError] = useState<string | null>(null);
  // The contract never returns a member's own past scores, so show what was rated in this session.
  const [mine, setMine] = useState<Record<string, Score>>({});
  const [rateError, setRateError] = useState<string | null>(null);

  const loadEvents = useCallback(async () => {
    try {
      setEvents(await api.listEvents());
      setEventsError(null);
    } catch (e) {
      setEventsError(errMsg(e));
    }
  }, []);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  useEffect(() => {
    if (!memberId) return;
    let alive = true;
    setLoading(true);
    setStatus(null);
    setMine({});
    api
      .getMember(memberId)
      .then((m) => {
        if (!alive) return;
        setCategories(m.categories);
        setTags(m.tags);
      })
      .catch((e: unknown) => alive && setStatus({ ok: false, text: errMsg(e) }))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [memberId]);

  function toggle(cat: Category) {
    setStatus(null);
    setCategories((prev) => (prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]));
  }

  async function save() {
    if (!memberId) return;
    setSaving(true);
    setStatus(null);
    try {
      await api.saveMember(memberId, { categories, tags });
      setStatus({ ok: true, text: "Preferences saved." });
    } catch (e) {
      setStatus({ ok: false, text: `Could not save. ${errMsg(e)}` });
    } finally {
      setSaving(false);
    }
  }

  async function rate(eventId: string, score: Score) {
    if (!memberId) return;
    const previous = mine[eventId];
    setMine((m) => ({ ...m, [eventId]: score })); // optimistic
    setRateError(null);
    try {
      await api.rate(eventId, memberId, score);
      await loadEvents(); // refresh the team average
    } catch (e) {
      setMine((m) => {
        const next = { ...m };
        if (previous) next[eventId] = previous;
        else delete next[eventId];
        return next;
      });
      setRateError(`Could not save your rating. ${errMsg(e)}`);
    }
  }

  if (membersError) return <ErrorBanner message={membersError} onRetry={reloadMembers} />;

  return (
    <div className="grid gap-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-3xl font-extrabold tracking-tight sm:text-4xl">
            What are <span className="gradient-text">you</span> into?
          </h1>
          <p className="mt-1 max-w-prose text-sm text-zinc-600 dark:text-zinc-400">
            Tell the planner what you enjoy. Only you can see your own choices. The team sees averages, never individual
            ratings.
          </p>
        </div>
        <MemberSelect id="me-member" label="Pick your name" />
      </header>

      <section aria-labelledby="likes" className="grid gap-5 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 id="likes" className="display text-xl font-extrabold">
          What you like{member ? `, ${member.name}` : ""}
        </h2>
        {membersLoading || loading ? (
          <Spinner label="Loading your preferences" />
        ) : (
          <>
            <fieldset className="grid gap-2">
              <legend className="mb-1 text-sm font-medium">Categories</legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {CATEGORIES.map((cat) => {
                  const on = categories.includes(cat);
                  const look = CATEGORY_STYLE[cat];
                  return (
                    <label
                      key={cat}
                      className={`tile ${on ? "on" : ""}`}
                      style={{ "--c1": look.from, "--c2": look.to, "--cink": look.ink } as CSSProperties}
                    >
                      <input type="checkbox" checked={on} onChange={() => toggle(cat)} className="sr-only" />
                      <span className="chip">
                        <CategoryIcon category={cat} className="size-5" />
                      </span>
                      {CATEGORY_LABEL[cat]}
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <div className="grid gap-1.5">
              <label htmlFor="tags" className="text-sm font-medium">
                Specific things you like
              </label>
              <TagInput
                id="tags"
                value={tags}
                onChange={(t) => {
                  setStatus(null);
                  setTags(t);
                }}
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={save}
                disabled={saving || !memberId}
                className="btn-party"
              >
                {saving ? "Saving…" : "Save preferences"}
              </button>
              <p
                role="status"
                className={`text-sm font-extrabold ${status?.ok ? "text-[var(--tomato)]" : "text-red-700 dark:text-red-300"}`}
              >
                {status?.text}
              </p>
            </div>
          </>
        )}
      </section>

      <section aria-labelledby="past" className="grid gap-4">
        <h2 id="past" className="display text-xl font-extrabold">
          Rate past events
        </h2>
        {eventsError && <ErrorBanner message={eventsError} onRetry={loadEvents} />}
        {rateError && <ErrorBanner message={rateError} />}
        {events.length === 0 && !eventsError ? (
          <Spinner label="Loading past events" />
        ) : (
          <ul className="grid gap-3">
            {events.map((e) => (
              <li
                key={e.id}
                className="grid gap-3 rounded-xl border border-zinc-200 bg-white p-4 sm:grid-cols-[1fr_auto] sm:items-center dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div>
                  <p className="font-medium">{e.activityName}</p>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    {formatDate(e.start)} · Team average{" "}
                    <span className="font-medium tabular-nums text-foreground">
                      {e.teamAvgRating === null ? "no ratings yet" : `${e.teamAvgRating.toFixed(1)} / 5`}
                    </span>
                  </p>
                </div>
                <div className="grid gap-1 sm:justify-items-end">
                  <StarRating
                    value={mine[e.id] ?? null}
                    onChange={(s) => void rate(e.id, s)}
                    label={`Your rating for ${e.activityName}`}
                  />
                  <p className="text-xs text-zinc-600 dark:text-zinc-400">
                    {mine[e.id] ? `You rated this ${mine[e.id]} out of 5` : "Not rated by you yet"}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
