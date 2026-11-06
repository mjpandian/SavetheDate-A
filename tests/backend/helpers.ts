// Shared test helpers (not a *.test.ts file, so Vitest does not collect it).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { openDb, setDb } from "@/lib/db";
import type { Db } from "@/lib/db";
import { seed } from "@/lib/seed";
import type { Candidate } from "@/lib/types";

/**
 * In-memory SQLite seeded from tests/backend/fixtures, a temp DATA_DIR (so team.json
 * writes never touch the repo) and no API key. Call the returned cleanup in afterEach.
 */
export function useTestEnv(): { db: Db; dir: string; cleanup: () => void } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "savethedate-"));
  // The engine loaders read DATA_DIR. Catalog and events come from this suite's fixtures; busy, forecast and team come from data/.
  fs.copyFileSync(path.join(process.cwd(), "tests", "backend", "fixtures", "activities.json"), path.join(dir, "activities.json"));
  for (const name of ["busy.json", "forecast.json", "team.json"]) {
    fs.copyFileSync(path.join(process.cwd(), "data", name), path.join(dir, name));
  }
  process.env.DATA_DIR = dir;
  delete process.env.ANTHROPIC_API_KEY;
  const db = openDb(":memory:");
  seed(db);
  setDb(db);
  return {
    db,
    dir,
    cleanup: () => {
      setDb(null);
      delete process.env.DATA_DIR;
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

export function req(method: string, url: string, body?: unknown): Request {
  return new Request(`http://localhost${url}`, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export function candidate(id: string, over: Partial<Candidate> = {}): Candidate {
  return {
    id,
    activityId: "a-bistro",
    slotStart: "2026-11-03T17:30:00+01:00",
    slotEnd: "2026-11-03T19:30:00+01:00",
    attendancePct: 80,
    availableMemberIds: ["m1", "m2", "m3"],
    matchedMemberIds: ["m1", "m2"],
    weather: "Cloudy, 12 C",
    criteria: { C1: true, C2: 2, C3: null, C4: true, C5: true, C5penalty: false },
    score: 0.6,
    explanation: "",
    priceIsEstimate: false,
    sourceUrl: "https://example.com/bistro",
    ...over,
  };
}
