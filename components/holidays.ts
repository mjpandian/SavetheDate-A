// Holiday engine: which holiday is the next one, and the words and graphics for its theme.
// Colors live in app/(screens)/holidays.css, keyed by the same ids (data-holiday="halloween").

export type HolidayId =
  | "newyear" | "valentine" | "stpatrick" | "easter" | "memorial"
  | "july4" | "labor" | "halloween" | "thanksgiving" | "christmas";

export interface Holiday {
  id: HolidayId | "party";
  name: string;
  /** One word that finishes "Let's plan something ...". */
  word: string;
  eyebrow: string;
  glyphs: string[];
  /** fall = snow, leaves and confetti drift down; rise = hearts, ghosts and sparks float up. */
  motion: "fall" | "rise";
  ticker: string;
  date: (year: number) => Date;
}

/** Used before the date is known (first paint) and in tests: no theme, no particles. */
export const PARTY: Holiday = {
  id: "party",
  name: "Team time",
  word: "unforgettable",
  eyebrow: "Team events, made easy",
  glyphs: [],
  motion: "fall",
  ticker: "SAVE THE DATE  ★  PICK A PLACE  ★  RANK YOUR TOP THREE  ★  WHO'S IN?  ★  ",
  date: (y) => new Date(y, 0, 1),
};

const nthWeekday = (y: number, m: number, weekday: number, n: number) => {
  const first = new Date(y, m, 1);
  return new Date(y, m, 1 + ((7 + weekday - first.getDay()) % 7) + (n - 1) * 7);
};
const lastWeekday = (y: number, m: number, weekday: number) => {
  const last = new Date(y, m + 1, 0);
  return new Date(y, m, last.getDate() - ((7 + last.getDay() - weekday) % 7));
};

/** Western Easter Sunday (anonymous Gregorian algorithm). */
export function easterSunday(y: number): Date {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(y, month - 1, day);
}

export const HOLIDAYS: Holiday[] = [
  { id: "newyear", name: "New Year's Eve", word: "sparkling", eyebrow: "Ring in the new year",
    glyphs: ["🎆", "🥂", "✨", "🎉"], motion: "rise",
    ticker: "COUNTDOWN TO MIDNIGHT  ★  POP THE BUBBLY  ★  PICK THE PARTY  ★  ",
    date: (y) => new Date(y, 11, 31) },
  { id: "valentine", name: "Valentine's Day", word: "lovely", eyebrow: "Spread the love",
    glyphs: ["💖", "💘", "🌹", "💌"], motion: "rise",
    ticker: "SPREAD THE LOVE  ★  TEAM DATE NIGHT  ★  PICK SOMETHING SWEET  ★  ",
    date: (y) => new Date(y, 1, 14) },
  { id: "stpatrick", name: "St. Patrick's Day", word: "lucky", eyebrow: "Feeling lucky",
    glyphs: ["☘️", "🍀", "🌈", "🪙"], motion: "fall",
    ticker: "LUCK OF THE TEAM  ★  FIND THE POT OF GOLD  ★  GREEN IS GOOD  ★  ",
    date: (y) => new Date(y, 2, 17) },
  { id: "easter", name: "Easter", word: "egg-stra special", eyebrow: "Spring has sprung",
    glyphs: ["🐣", "🌷", "🥚", "🐰"], motion: "rise",
    ticker: "SPRING HAS SPRUNG  ★  HOP TO IT  ★  EGG-STRA SPECIAL PLANS  ★  ",
    date: easterSunday },
  { id: "memorial", name: "Memorial Day weekend", word: "sunny", eyebrow: "Summer kicks off",
    glyphs: ["☀️", "🌴", "🍉", "😎"], motion: "rise",
    ticker: "SUMMER KICKOFF  ★  SUN'S OUT  ★  PLAN SOMETHING OUTSIDE  ★  ",
    date: (y) => lastWeekday(y, 4, 1) },
  { id: "july4", name: "Independence Day", word: "star-spangled", eyebrow: "Red, white and team spirit",
    glyphs: ["🎆", "⭐", "🇺🇸", "🧨"], motion: "rise",
    ticker: "FIREWORKS  ★  RED, WHITE AND TEAM SPIRIT  ★  PLAN A BLAST  ★  ",
    date: (y) => new Date(y, 6, 4) },
  { id: "labor", name: "Labor Day", word: "relaxed", eyebrow: "A well-earned break",
    glyphs: ["🍔", "🌤️", "🎈", "🍹"], motion: "rise",
    ticker: "YOU'VE EARNED IT  ★  CLOSE OUT THE SUMMER  ★  FIRE UP THE GRILL  ★  ",
    date: (y) => nthWeekday(y, 8, 1, 1) },
  { id: "halloween", name: "Halloween", word: "spooky", eyebrow: "Spooky season is here",
    glyphs: ["🎃", "👻", "🦇", "🕸️", "🍬"], motion: "rise",
    ticker: "TRICK OR TREAT  ★  SPOOKY SEASON  ★  VOTE IF YOU DARE  ★  ",
    date: (y) => new Date(y, 9, 31) },
  { id: "thanksgiving", name: "Thanksgiving", word: "grateful", eyebrow: "Giving thanks together",
    glyphs: ["🦃", "🍂", "🥧", "🌽", "🍁"], motion: "fall",
    ticker: "GIVING THANKS  ★  GATHER THE TEAM  ★  SAVE ROOM FOR PIE  ★  ",
    date: (y) => nthWeekday(y, 10, 4, 4) },
  { id: "christmas", name: "Christmas", word: "merry", eyebrow: "Tis the season",
    glyphs: ["🎄", "❄️", "🎁", "⛄", "⭐"], motion: "fall",
    ticker: "MERRY AND BRIGHT  ★  TEAM HOLIDAY PARTY  ★  DECK THE HALLS  ★  ",
    date: (y) => new Date(y, 11, 25) },
];

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** Next occurrence of a holiday on or after `now` (today counts). */
export function nextOccurrence(h: Holiday, now: Date): { date: Date; days: number } {
  const today = startOfDay(now);
  let date = h.date(today.getFullYear());
  if (date < today) date = h.date(today.getFullYear() + 1);
  return { date, days: Math.round((date.getTime() - today.getTime()) / 86_400_000) };
}

/** The closest holiday that is still ahead (or today). Always finds one. */
export function pickHoliday(now: Date = new Date()): { holiday: Holiday; date: Date; days: number } {
  let best: { holiday: Holiday; date: Date; days: number } | null = null;
  for (const holiday of HOLIDAYS) {
    const { date, days } = nextOccurrence(holiday, now);
    if (!best || date < best.date) best = { holiday, date, days };
  }
  return best!;
}

export const countdownText = (h: Holiday, days: number | null) =>
  h.id === "party" || days === null
    ? ""
    : days === 0 ? `${h.name} is today!` : days === 1 ? `${h.name} is tomorrow` : `${h.name} in ${days} days`;
