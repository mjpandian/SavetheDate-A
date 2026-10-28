"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { HOLIDAYS, PARTY, nextOccurrence, pickHoliday, type Holiday, type HolidayId } from "@/components/holidays";

const STORAGE_KEY = "savethedate.holiday";
type Mode = "auto" | HolidayId;

interface HolidayCtx {
  holiday: Holiday;
  /** Days until the active holiday, or null before the date is known. */
  days: number | null;
  mode: Mode;
  setMode: (m: Mode) => void;
}

const Ctx = createContext<HolidayCtx>({ holiday: PARTY, days: null, mode: "auto", setMode: () => {} });
export const useHoliday = () => useContext(Ctx);

const isMode = (v: string | null): v is Mode => v === "auto" || HOLIDAYS.some((h) => h.id === v);

/**
 * Themes the whole screens area to the closest upcoming holiday. Override for demos:
 * `?date=2026-11-20` previews another day, `?holiday=christmas` forces a theme, or use the picker.
 * The theme is decided after mount, so the server HTML never disagrees with the browser's clock.
 */
export function HolidayProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<Mode>("auto");
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const asked = q.get("date");
    const parsed = asked ? new Date(`${asked}T12:00:00`) : null;
    setNow(parsed && !Number.isNaN(parsed.getTime()) ? parsed : new Date());
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(STORAGE_KEY);
    } catch {
      /* storage can be blocked */
    }
    const wanted = q.get("holiday") ?? saved;
    if (isMode(wanted)) setModeState(wanted);
  }, []);

  const setMode = useCallback((m: Mode) => {
    setModeState(m);
    try {
      localStorage.setItem(STORAGE_KEY, m);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo<HolidayCtx>(() => {
    if (!now) return { holiday: PARTY, days: null, mode, setMode };
    if (mode === "auto") {
      const p = pickHoliday(now);
      return { holiday: p.holiday, days: p.days, mode, setMode };
    }
    const h = HOLIDAYS.find((x) => x.id === mode) ?? PARTY;
    return { holiday: h, days: nextOccurrence(h, now).days, mode, setMode };
  }, [now, mode, setMode]);

  const { holiday } = value;
  return (
    <Ctx.Provider value={value}>
      <div className="party flex min-h-full flex-1 flex-col" data-holiday={holiday.id}>
        <div className="party-bg" aria-hidden="true">
          <span className="blob b1" />
          <span className="blob b2" />
          <span className="blob b3" />
          <Particles holiday={holiday} />
        </div>
        <div className="ticker" aria-hidden="true">
          <div className="ticker-track">{holiday.ticker.repeat(5)}</div>
        </div>
        {children}
      </div>
    </Ctx.Provider>
  );
}

/** Falling or rising glyphs. Positions come from the index, so there is nothing random to mismatch. */
function Particles({ holiday }: { holiday: Holiday }) {
  if (holiday.glyphs.length === 0) return null;
  return (
    <div className={`particles ${holiday.motion}`}>
      {Array.from({ length: 20 }, (_, i) => {
        const duration = 14 + ((i * 7) % 13);
        const style = {
          "--x": `${(i * 37 + 11) % 100}%`,
          "--s": `${20 + ((i * 11) % 18)}px`,
          "--d": `${duration}s`,
          "--delay": `${-((i * 1.9) % duration)}s`,
          "--dx": `${(i % 2 ? 1 : -1) * (24 + ((i * 5) % 46))}px`,
        } as CSSProperties;
        return (
          <span key={i} className="particle" style={style}>
            {holiday.glyphs[i % holiday.glyphs.length]}
          </span>
        );
      })}
    </div>
  );
}

/** Auto follows the calendar. Pick a holiday to preview its theme. */
export function HolidayPicker() {
  const { mode, setMode, holiday } = useHoliday();
  return (
    <div className="flex items-center gap-1.5">
      <label htmlFor="holiday-select" className="text-xs font-extrabold uppercase tracking-wider">
        Theme
      </label>
      <select
        id="holiday-select"
        value={mode}
        onChange={(e) => setMode(e.target.value as Mode)}
        className="rounded-full border-2 border-[var(--ink)] bg-[var(--card)] px-2.5 py-1 text-sm font-bold outline-none focus-visible:ring-2 focus-visible:ring-[var(--tomato)]"
      >
        <option value="auto">Auto{mode === "auto" && holiday.id !== "party" ? ` (${holiday.name})` : ""}</option>
        {HOLIDAYS.map((h) => (
          <option key={h.id} value={h.id}>
            {h.glyphs[0]} {h.name}
          </option>
        ))}
      </select>
    </div>
  );
}
