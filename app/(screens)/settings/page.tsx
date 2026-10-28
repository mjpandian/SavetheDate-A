"use client";

import { useEffect, useState, type FormEvent } from "react";
import { api } from "@/lib/api-client";
import { ErrorBanner } from "@/components/ErrorBanner";
import { Field, describedBy, inputClass } from "@/components/Field";
import { Spinner } from "@/components/Spinner";
import { useCurrency, useTeamRefresh } from "@/components/TeamProvider";
import { errMsg } from "@/components/useRunData";
import { toDraft, validateTeam, type TeamDraft as Draft, type TeamErrors as Errors } from "@/components/validateTeam";

export default function SettingsPage() {
  const currency = useCurrency();
  const refreshTeam = useTeamRefresh();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [city, setCity] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  function load() {
    setLoadError(null);
    api
      .getTeam()
      .then((t) => {
        setDraft(toDraft(t));
        setCity(t.city);
      })
      .catch((e: unknown) => setLoadError(errMsg(e)));
  }
  useEffect(load, []);

  function set<K extends keyof Draft>(key: K, value: string) {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
    setStatus(null);
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    if (!draft) return;
    const found = validateTeam(draft);
    setErrors(found);
    if (Object.keys(found).length) {
      setStatus({ ok: false, text: "Fix the highlighted fields and try again." });
      return;
    }
    setSaving(true);
    setStatus(null);
    try {
      const saved = await api.saveTeam({
        limit: Number(draft.limit),
        windowDays: Number(draft.windowDays),
        attendanceThresholdPct: Number(draft.attendanceThresholdPct),
        noveltyWeeks: Number(draft.noveltyWeeks),
      });
      setDraft(toDraft(saved));
      refreshTeam();
      setStatus({ ok: true, text: "Settings saved. They apply to the next planning run." });
    } catch (e) {
      setStatus({ ok: false, text: `Could not save settings. ${errMsg(e)}` });
    } finally {
      setSaving(false);
    }
  }

  if (loadError) return <ErrorBanner message={loadError} onRetry={load} />;
  if (!draft) return <Spinner label="Loading team settings" />;

  const f = (id: keyof Draft, hint?: string) => ({
    id,
    "aria-invalid": errors[id] ? (true as const) : undefined,
    "aria-describedby": describedBy(id, hint, errors[id]),
    className: inputClass,
  });

  return (
    <div className="grid max-w-xl gap-6">
      <header>
        <h1 className="display text-3xl font-extrabold tracking-tight sm:text-4xl">
          Set the <span className="gradient-text">rules</span>
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          The organizer sets the rules every planning run must respect{city ? ` for ${city}` : ""}.
        </p>
      </header>

      <form onSubmit={submit} noValidate className="grid gap-5 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <Field id="limit" label={`Budget per person (${currency})`} hint="Options above this price are dropped." error={errors.limit}>
          <input {...f("limit", "Options above this price are dropped.")} type="number" inputMode="decimal" min={1} step="any" value={draft.limit} onChange={(e) => set("limit", e.target.value)} />
        </Field>
        <Field id="windowDays" label="Planning window (days ahead)" hint="How far ahead to look for a slot." error={errors.windowDays}>
          <input {...f("windowDays", "How far ahead to look for a slot.")} type="number" inputMode="numeric" min={1} max={60} value={draft.windowDays} onChange={(e) => set("windowDays", e.target.value)} />
        </Field>
        <Field id="attendanceThresholdPct" label="Minimum attendance (%)" hint="A slot needs at least this share of the team free." error={errors.attendanceThresholdPct}>
          <input {...f("attendanceThresholdPct", "A slot needs at least this share of the team free.")} type="number" inputMode="numeric" min={1} max={100} value={draft.attendanceThresholdPct} onChange={(e) => set("attendanceThresholdPct", e.target.value)} />
        </Field>
        <Field id="noveltyWeeks" label="No repeats within (weeks)" hint="The same activity is not proposed again within this time." error={errors.noveltyWeeks}>
          <input {...f("noveltyWeeks", "The same activity is not proposed again within this time.")} type="number" inputMode="numeric" min={0} max={52} value={draft.noveltyWeeks} onChange={(e) => set("noveltyWeeks", e.target.value)} />
        </Field>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="btn-party"
          >
            {saving ? "Saving…" : "Save settings"}
          </button>
          <p
            role="status"
            className={`text-sm font-extrabold ${status?.ok ? "text-[var(--tomato)]" : "text-red-700 dark:text-red-300"}`}
          >
            {status?.text}
          </p>
        </div>
      </form>
    </div>
  );
}
