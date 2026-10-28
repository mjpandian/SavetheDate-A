import type { Category } from "@/lib/types";

export const CATEGORY_LABEL: Record<Category, string> = {
  dining: "Dining",
  drinks: "Drinks",
  outdoor: "Outdoor",
  sports: "Sports",
  culture: "Culture",
  games: "Games",
  creative: "Creative",
  wellness: "Wellness",
};

/** Sticker colors per category: gradient start, gradient end, and a readable ink color on top. */
export const CATEGORY_STYLE: Record<Category, { from: string; to: string; ink: string }> = {
  dining: { from: "#FF6B4A", to: "#FFB347", ink: "#3A1000" },
  drinks: { from: "#FFC93C", to: "#FF9F1C", ink: "#3A2600" },
  outdoor: { from: "#2EC4B6", to: "#7BE495", ink: "#052B25" },
  sports: { from: "#4CC9F0", to: "#4895EF", ink: "#041B33" },
  culture: { from: "#FF5D8F", to: "#FF99C8", ink: "#3B0620" },
  games: { from: "#8E7CFF", to: "#5E60CE", ink: "#FFFFFF" },
  creative: { from: "#E9FF70", to: "#B8F34A", ink: "#2A3300" },
  wellness: { from: "#3DDAD7", to: "#2BA9C9", ink: "#03262E" },
};
export const NEUTRAL_STYLE = { from: "#C9CCE8", to: "#9EA3D1", ink: "#14103A" };

const formatters = new Map<string, Intl.NumberFormat>();
/** Money in the team's currency (USD unless the team data says otherwise): "$24", but "$12.50". */
export function formatMoney(n: number, currency = "USD"): string {
  const digits = Number.isInteger(n) ? 0 : 2;
  const key = `${currency}:${digits}`;
  let f = formatters.get(key);
  if (!f) {
    try {
      f = new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: digits, maximumFractionDigits: digits });
    } catch {
      // An unknown currency code must not break the page.
      f = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: digits, maximumFractionDigits: digits });
    }
    formatters.set(key, f);
  }
  return f.format(n);
}

/** "Thu 5 Nov, 17:30 to 19:30" in the viewer's time zone. */
export function formatSlot(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "Time to be confirmed";
  const day = start.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  const hm = (d: Date) => d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return `${day}, ${hm(start)} to ${hm(end)}`;
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** "today", "tomorrow", "in 8 days" or "already happened". */
export function daysUntil(iso: string, now: Date = new Date()): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const days = Math.ceil((t - now.getTime()) / 86_400_000);
  if (days < 0) return "already happened";
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
}

export function joinNames(ids: string[], names: Record<string, string>): string {
  return ids.map((id) => names[id] ?? id).join(", ");
}
