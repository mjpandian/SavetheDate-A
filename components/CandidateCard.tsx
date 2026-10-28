"use client";

import type { CSSProperties, ReactNode } from "react";
import { AvatarStack } from "@/components/Avatar";
import { CategoryIcon } from "@/components/CategoryIcon";
import { CriteriaBadges } from "@/components/CriteriaBadges";
import { CATEGORY_LABEL, CATEGORY_STYLE, NEUTRAL_STYLE, formatMoney, formatSlot, joinNames } from "@/components/format";
import { useCurrency } from "@/components/TeamProvider";
import type { CandidateView } from "@/lib/api-client";

/**
 * One option on Plan, Vote and Result. Shows every field the plan asks for: name, price (with an
 * "estimate" marker), slot, attendance, matched members by name, weather, rule badges,
 * explanation and a safe source link. Styled as a sticker-banded ticket.
 */
export function CandidateCard({
  candidate,
  names,
  onRemove,
  removing = false,
  highlight = false,
  footer,
  index = 0,
}: {
  candidate: CandidateView;
  names: Record<string, string>;
  onRemove?: () => void;
  removing?: boolean;
  highlight?: boolean;
  footer?: ReactNode;
  /** Position in a list: staggers the entrance animation. */
  index?: number;
}) {
  const c = candidate;
  const currency = useCurrency();
  const look = c.category ? CATEGORY_STYLE[c.category] : NEUTRAL_STYLE;
  const style = { "--c1": look.from, "--c2": look.to, "--cink": look.ink, "--i": index } as CSSProperties;
  const freeCount = c.availableMemberIds.length;
  const pct = Math.max(0, Math.min(100, Math.round(c.attendancePct)));

  return (
    <article
      aria-label={c.activityName}
      style={style}
      className={`party-card card-lift pop-in ${highlight ? "is-winner" : ""} ${removing ? "opacity-50" : ""}`}
    >
      <div className="band">
        {c.category && <CategoryIcon category={c.category} className="size-5" />}
        <span>{c.category ? CATEGORY_LABEL[c.category] : "Idea"}</span>
        {highlight && <span className="ribbon">Team pick</span>}
      </div>

      <header className="flex items-start justify-between gap-4 p-4 pb-2">
        <h3 className="display min-w-0 text-lg font-extrabold leading-snug">{c.activityName}</h3>
        <p className="stub shrink-0">
          <span className="block text-2xl font-extrabold tabular-nums">
            {c.pricePerPerson === null ? "Price unknown" : formatMoney(c.pricePerPerson, currency)}
          </span>
          <span className="block text-xs text-zinc-600 dark:text-zinc-400">
            per person
            {c.priceIsEstimate && (
              <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 font-bold text-amber-900 dark:bg-amber-900/50 dark:text-amber-100">
                estimate
              </span>
            )}
          </span>
        </p>
      </header>

      <div className="grid gap-3 p-4 pt-2">
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs font-bold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">When</dt>
            <dd className="font-semibold">{formatSlot(c.slotStart, c.slotEnd)}</dd>
          </div>
          <div>
            <dt className="text-xs font-bold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">Attendance</dt>
            <dd>
              <span className="font-extrabold tabular-nums">{pct}%</span> free ({freeCount} {freeCount === 1 ? "person" : "people"})
            </dd>
          </div>
          <div>
            <dt className="text-xs font-bold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">Matches the interests of</dt>
            <dd>{c.matchedMemberIds.length ? joinNames(c.matchedMemberIds, names) : "Nobody yet"}</dd>
          </div>
          {c.weather && (
            <div>
              <dt className="text-xs font-bold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">Weather</dt>
              <dd>{c.weather}</dd>
            </div>
          )}
          <div className="sm:col-span-2">
            <dt className="mb-1 text-xs font-bold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">Who can come</dt>
            <dd className="grid gap-2">
              <span className="meter" role="img" aria-label={`${pct} percent of the team is free`}>
                <span style={{ width: `${pct}%` }} />
              </span>
              <AvatarStack ids={c.availableMemberIds} names={names} highlight={c.matchedMemberIds} />
            </dd>
          </div>
        </dl>

        <CriteriaBadges candidate={c} />

        {c.explanation && <p className="text-sm leading-relaxed">{c.explanation}</p>}

        <footer className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <a href={c.sourceUrl} target="_blank" rel="noopener noreferrer" className="link-party">
            Source<span className="sr-only"> for {c.activityName} (opens in a new tab)</span>
          </a>
          {footer}
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              disabled={removing}
              aria-label={`Remove ${c.activityName} from the shortlist`}
              className="rounded-full border-2 border-[var(--ink)] px-3.5 py-1 font-extrabold transition-colors hover:bg-[var(--tomato)] hover:text-white disabled:cursor-not-allowed"
            >
              {removing ? "Removing…" : "Remove"}
            </button>
          )}
        </footer>
      </div>
    </article>
  );
}
