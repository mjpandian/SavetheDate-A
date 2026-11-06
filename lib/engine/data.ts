// Static data loaders for the engine. Reads data/*.json at call time, validates the shape,
// and keeps the engine pure of HTTP and DB code. Graph getSchedule and Open-Meteo replace
// these later behind the same signatures.
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import type { Activity, BusyMap, Forecast, Team } from "@/lib/types";
import { ActivitySchema } from "./schemas";

const TimeWindowSchema = z.object({
  days: z.array(z.number().int().min(0).max(6)).min(1),
  start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
});
const TeamDataSchema = z.object({
  limit: z.number().positive(),
  currency: z.literal("EUR"),
  windowDays: z.number().int().positive(),
  eventLengthMin: z.number().int().positive(),
  attendanceThresholdPct: z.number().min(0).max(100),
  noveltyWeeks: z.number().int().min(0),
  city: z.string().min(1),
  timeWindows: z.array(TimeWindowSchema).min(1),
});
const ForecastSchema = z.object({
  date: z.string(),
  rainPct: z.number(),
  tempC: z.number(),
  windKmh: z.number(),
  summary: z.string(),
});

/** Directory holding the seed JSON. `DATA_DIR` overrides it, which the backend tests use. */
export function engineDataDir(): string {
  return process.env.DATA_DIR ?? path.join(process.cwd(), "data");
}

function readJson(name: string): unknown {
  const file = path.join(engineDataDir(), name);
  return JSON.parse(fs.readFileSync(file, "utf8")) as unknown;
}

export function loadTeam(): Team {
  return TeamDataSchema.parse(readJson("team.json")) as Team;
}

export function loadActivities(): Activity[] {
  return z.array(ActivitySchema).parse(readJson("activities.json")) as Activity[];
}

export function loadBusy(): BusyMap {
  return z.record(z.string(), z.array(z.object({ start: z.string(), end: z.string() }))).parse(readJson("busy.json"));
}

/** Forecast for one local date (YYYY-MM-DD), or null when the seed has no entry for it. */
export function loadForecast(dateISO: string): Forecast | null {
  const all = z.array(ForecastSchema).parse(readJson("forecast.json"));
  return all.find((f) => f.date === dateISO.slice(0, 10)) ?? null;
}

/**
 * Resolve an activity id: the catalog first, then the activities discovered in the run (contract v2).
 * Callers never look only in the catalog, so `disc:` ids resolve too.
 */
export function resolveActivity(
  id: string,
  catalog: readonly Activity[],
  discovered: readonly Activity[] = [],
): Activity | undefined {
  return catalog.find((a) => a.id === id) ?? discovered.find((a) => a.id === id);
}
