import { describe, expect, it } from "vitest";
import { costByModel, costUsd } from "./pricing";

describe("eval cost pricing", () => {
  it("prices one million input and output tokens at the list rate", () => {
    expect(costUsd("claude-opus-5-5", { inputTokens: 1_000_000, outputTokens: 0 })).toBeCloseTo(4);
    expect(costUsd("claude-opus-5-5", { inputTokens: 0, outputTokens: 1_000_000 })).toBeCloseTo(20);
    expect(costUsd("claude-sonnet-5-5", { inputTokens: 1_000_000, outputTokens: 1_000_000 })).toBeCloseTo(12);
  });

  it("returns zero for an empty run", () => {
    expect(costUsd("claude-opus-5-5", { inputTokens: 0, outputTokens: 0 })).toBe(0);
  });

  it("reports every priced model for one usage record", () => {
    const byModel = costByModel({ inputTokens: 10_000, outputTokens: 2_000 });
    expect(Object.keys(byModel).sort()).toEqual(["claude-opus-5-5", "claude-sonnet-5-5"]);
    expect(byModel["claude-opus-5-5"]).toBeCloseTo(0.04 + 0.04);
    expect(byModel["claude-sonnet-5-5"]).toBeCloseTo(0.02 + 0.02);
  });

  it("throws on an unpriced model rather than reporting zero", () => {
    expect(() => costUsd("claude-unknown", { inputTokens: 1, outputTokens: 1 })).toThrow(/No price/);
  });
});
