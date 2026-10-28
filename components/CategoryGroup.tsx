import type { CandidateView } from "@/lib/api-client";
import type { Category } from "@/lib/types";
import { CandidateCard } from "@/components/CandidateCard";
import { CategoryIcon } from "@/components/CategoryIcon";
import { CATEGORY_LABEL, CATEGORY_STYLE } from "@/components/format";

export function CategoryGroup({
  category,
  candidates,
  names,
  onRemove,
  removingId,
  emptyText = "No options this run",
}: {
  category: Category | null;
  candidates: CandidateView[];
  names: Record<string, string>;
  onRemove?: (candidate: CandidateView) => void;
  removingId?: string | null;
  emptyText?: string;
}) {
  const title = category ? CATEGORY_LABEL[category] : "Other";
  const look = category ? CATEGORY_STYLE[category] : null;
  return (
    <section aria-labelledby={`cat-${category ?? "other"}`} className="grid gap-3">
      <h2 id={`cat-${category ?? "other"}`} className="display flex items-center gap-2.5 text-xl font-extrabold">
        {category && look && (
          <span
            className="grid size-9 place-items-center rounded-xl border-2 border-[var(--ink)]"
            style={{ background: `linear-gradient(135deg, ${look.from}, ${look.to})`, color: look.ink }}
          >
            <CategoryIcon category={category} className="size-5" />
          </span>
        )}
        {title}
        <span className="text-sm font-semibold text-zinc-600 dark:text-zinc-400">
          {candidates.length} {candidates.length === 1 ? "option" : "options"}
        </span>
      </h2>
      {candidates.length === 0 ? (
        <p className="rounded-2xl border-2 border-dashed border-zinc-300 px-4 py-3 text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
          {emptyText}
        </p>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {candidates.map((c, i) => (
            <CandidateCard
              key={c.id}
              candidate={c}
              names={names}
              index={i}
              onRemove={onRemove ? () => onRemove(c) : undefined}
              removing={removingId === c.id}
            />
          ))}
        </div>
      )}
    </section>
  );
}
