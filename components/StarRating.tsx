"use client";

type Score = 1 | 2 | 3 | 4 | 5;

/** 1 to 5 rating as a radio group of buttons. Keyboard friendly: Tab to a star, Enter or Space to pick. */
export function StarRating({
  value,
  onChange,
  label,
  disabled = false,
}: {
  value: number | null;
  onChange: (score: Score) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex gap-1">
      {([1, 2, 3, 4, 5] as const).map((n) => {
        const on = value !== null && n <= value;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} out of 5`}
            disabled={disabled}
            onClick={() => onChange(n)}
            className={`size-8 rounded-md border text-lg leading-none focus-visible:ring-2 focus-visible:ring-[var(--tomato)] ${
              on
                ? "border-amber-400 bg-amber-100 text-amber-700 dark:border-amber-600 dark:bg-amber-900/50 dark:text-amber-300"
                : "border-zinc-300 bg-white text-zinc-400 hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900"
            }`}
          >
            <span aria-hidden="true">★</span>
          </button>
        );
      })}
    </div>
  );
}
