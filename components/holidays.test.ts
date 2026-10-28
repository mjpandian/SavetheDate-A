import { describe, expect, it } from "vitest";
import { HOLIDAYS, countdownText, easterSunday, nextOccurrence, pickHoliday } from "@/components/holidays";
import { formatMoney } from "@/components/format";

const day = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12);
const idOn = (y: number, m: number, d: number) => pickHoliday(day(y, m, d)).holiday.id;

describe("pickHoliday: the closest holiday still ahead", () => {
  it("a few days before Halloween, it is Halloween", () => {
    expect(idOn(2026, 10, 28)).toBe("halloween");
    expect(pickHoliday(day(2026, 10, 28)).days).toBe(3);
  });

  it("on Halloween itself it is still Halloween, with 0 days to go", () => {
    expect(pickHoliday(day(2026, 10, 31))).toMatchObject({ days: 0 });
    expect(idOn(2026, 10, 31)).toBe("halloween");
  });

  it("the day after Halloween it flips to Thanksgiving (4th Thursday of November)", () => {
    expect(idOn(2026, 11, 1)).toBe("thanksgiving");
    expect(pickHoliday(day(2026, 11, 1)).date.getDate()).toBe(26);
  });

  it("after Thanksgiving it is Christmas, then New Year's Eve", () => {
    expect(idOn(2026, 11, 27)).toBe("christmas");
    expect(idOn(2026, 12, 26)).toBe("newyear");
  });

  it("rolls into the next year: January picks Valentine's Day", () => {
    expect(idOn(2027, 1, 2)).toBe("valentine");
  });

  it("walks the whole year in order", () => {
    expect(idOn(2027, 2, 15)).toBe("stpatrick");
    expect(idOn(2027, 3, 18)).toBe("easter");
    expect(idOn(2027, 3, 28)).toBe("easter"); // Easter Sunday itself
    expect(idOn(2027, 3, 29)).toBe("memorial"); // the day after, it moves on
    expect(idOn(2027, 6, 1)).toBe("july4");
    expect(idOn(2027, 7, 5)).toBe("labor");
    expect(idOn(2027, 9, 8)).toBe("halloween");
  });

  it("always finds a holiday, every day of a year", () => {
    for (let d = new Date(2026, 0, 1); d.getFullYear() === 2026; d.setDate(d.getDate() + 1)) {
      const { holiday, days } = pickHoliday(new Date(d));
      expect(holiday.id).toBeTruthy();
      expect(days).toBeGreaterThanOrEqual(0);
      expect(days).toBeLessThan(150);
    }
  });
});

describe("holiday dates", () => {
  it("computes Easter", () => {
    expect(easterSunday(2026)).toEqual(new Date(2026, 3, 5));
    expect(easterSunday(2027)).toEqual(new Date(2027, 2, 28));
  });

  it("finds Thanksgiving, Memorial Day and Labor Day", () => {
    const by = (id: string) => HOLIDAYS.find((h) => h.id === id)!;
    expect(by("thanksgiving").date(2026)).toEqual(new Date(2026, 10, 26));
    expect(by("memorial").date(2026)).toEqual(new Date(2026, 4, 25));
    expect(by("labor").date(2026)).toEqual(new Date(2026, 8, 7));
  });

  it("nextOccurrence moves to next year once a holiday has passed", () => {
    const halloween = HOLIDAYS.find((h) => h.id === "halloween")!;
    expect(nextOccurrence(halloween, day(2026, 11, 2)).date.getFullYear()).toBe(2027);
  });

  it("every holiday has glyphs, a ticker and a word for the headline", () => {
    for (const h of HOLIDAYS) {
      expect(h.glyphs.length).toBeGreaterThanOrEqual(3);
      expect(h.ticker.length).toBeGreaterThan(10);
      expect(h.word.length).toBeGreaterThan(2);
    }
  });
});

describe("countdown text", () => {
  const halloween = HOLIDAYS.find((h) => h.id === "halloween")!;
  it("says today, tomorrow or the number of days", () => {
    expect(countdownText(halloween, 0)).toBe("Halloween is today!");
    expect(countdownText(halloween, 1)).toBe("Halloween is tomorrow");
    expect(countdownText(halloween, 3)).toBe("Halloween in 3 days");
  });
});

describe("money", () => {
  it("shows dollars by default and follows the team's currency", () => {
    expect(formatMoney(24)).toBe("$24");
    expect(formatMoney(12.5)).toBe("$12.50");
    expect(formatMoney(24, "EUR")).toBe("€24");
  });

  it("does not crash on a currency code it does not know", () => {
    expect(() => formatMoney(10, "not-a-currency")).not.toThrow();
  });
});
