import type { Category } from "@/lib/types";

const PATHS: Record<Category, React.ReactNode> = {
  dining: <path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 3c-2.2 2-2.2 6.2 0 8.2V21" />,
  drinks: <path d="M4 4h16l-8 9zM12 13v7M8 20h8M15 6.5l3-3" />,
  outdoor: <path d="M2.5 20 9 8l4 7 2.5-4L21.5 20zM17 5.5a1.5 1.5 0 1 0 0 .01" />,
  sports: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c3.5 3 3.5 15 0 18M12 3c-3.5 3-3.5 15 0 18" />
    </>
  ),
  culture: <path d="M4 5h16v11H4zM8 20h8M12 16v4M9 9.5h.01M15 9.5h.01M9.5 12.5q2.5 2 5 0" />,
  games: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="4" />
      <path d="M8.5 8.5h.01M15.5 8.5h.01M12 12h.01M8.5 15.5h.01M15.5 15.5h.01" />
    </>
  ),
  creative: <path d="M12 3a9 9 0 1 0 0 18c1.6 0 2.2-1.1 1.6-2.2s-.1-2.3 1.4-2.3H18a3 3 0 0 0 3-3c0-5-4-10.5-9-10.5zM7.5 11h.01M10 7.5h.01M14.5 7.5h.01" />,
  wellness: <path d="M12 21c-5-3-8-7-8-12 4 0 7 2 8 5 1-3 4-5 8-5 0 5-3 9-8 12zM12 14v7" />,
};

/** Stroke icon for a category. Decorative: the category name is always written next to it. */
export function CategoryIcon({ category, className = "size-5" }: { category: Category; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[category]}
    </svg>
  );
}
