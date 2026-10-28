import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CandidateCard } from "@/components/CandidateCard";
import { criteriaBadges } from "@/components/CriteriaBadges";
import type { CandidateView } from "@/lib/api-client";

const base: CandidateView = {
  id: "cand-1",
  activityId: "act-kayak",
  activityName: "Guided sunset kayak",
  category: "outdoor",
  pricePerPerson: 29,
  slotStart: "2026-11-07T14:00:00.000Z",
  slotEnd: "2026-11-07T16:00:00.000Z",
  attendancePct: 75,
  availableMemberIds: ["m1", "m3", "m4"],
  matchedMemberIds: ["m3", "m6"],
  weather: "Dry, 17 °C, light wind",
  criteria: { C1: true, C2: 2, C3: true, C4: true, C5: true, C5penalty: false },
  score: 0.74,
  explanation: "Dry and mild on Saturday.",
  priceIsEstimate: false,
  sourceUrl: "https://example.com/kayak",
};
const names = { m1: "Ava", m3: "Chloé", m4: "Dev", m6: "Farid" };

describe("CandidateCard", () => {
  it("shows name, price, attendance, matched members by name, weather and explanation", () => {
    render(<CandidateCard candidate={base} names={names} />);
    expect(screen.getByRole("heading", { name: "Guided sunset kayak" })).toBeInTheDocument();
    expect(screen.getByText("$29")).toBeInTheDocument();
    expect(screen.getByText(/75%/)).toBeInTheDocument();
    expect(screen.getByText("Chloé, Farid")).toBeInTheDocument();
    expect(screen.getByText("Dry, 17 °C, light wind")).toBeInTheDocument();
    expect(screen.getByText("Dry and mild on Saturday.")).toBeInTheDocument();
  });

  it("marks an estimated price and leaves it off exact prices", () => {
    const { rerender } = render(<CandidateCard candidate={{ ...base, priceIsEstimate: true }} names={names} />);
    expect(screen.getByText("estimate")).toBeInTheDocument();
    rerender(<CandidateCard candidate={base} names={names} />);
    expect(screen.queryByText("estimate")).not.toBeInTheDocument();
  });

  it("opens the source in a new tab without leaking the opener", () => {
    render(<CandidateCard candidate={base} names={names} />);
    const link = screen.getByRole("link", { name: /source/i });
    expect(link).toHaveAttribute("href", "https://example.com/kayak");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
    expect(link).toHaveAttribute("rel", expect.stringContaining("noreferrer"));
  });

  it("shows a Remove button only when onRemove is given, and calls it", () => {
    const onRemove = vi.fn();
    const { rerender } = render(<CandidateCard candidate={base} names={names} />);
    expect(screen.queryByRole("button", { name: /remove/i })).not.toBeInTheDocument();
    rerender(<CandidateCard candidate={base} names={names} onRemove={onRemove} />);
    screen.getByRole("button", { name: /remove guided sunset kayak/i }).click();
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it("hides the weather row when there is no weather text", () => {
    render(<CandidateCard candidate={{ ...base, weather: "" }} names={names} />);
    expect(screen.queryByText("Weather")).not.toBeInTheDocument();
  });
});

describe("criteria badges", () => {
  it("shows C1 to C5 and the novelty penalty", () => {
    const badges = criteriaBadges({ ...base, criteria: { ...base.criteria, C5penalty: true } });
    expect(badges.map((b) => b.code)).toEqual(["C1", "C2", "C3", "C4", "C5", "C5"]);
    expect(badges.at(-1)).toMatchObject({ label: "Same category as last event", tone: "warn" });
  });

  it("treats C3 null as 'no rule' and a failed rule as a failure", () => {
    expect(criteriaBadges({ ...base, criteria: { ...base.criteria, C3: null } })[2]).toMatchObject({ tone: "neutral" });
    expect(criteriaBadges({ ...base, criteria: { ...base.criteria, C1: false } })[0]).toMatchObject({ tone: "fail", label: "Over budget" });
  });

  it("renders every badge as a labelled list item", () => {
    render(<CandidateCard candidate={base} names={names} />);
    const list = screen.getByRole("list", { name: /rules this option meets/i });
    expect(within(list).getAllByRole("listitem")).toHaveLength(5);
  });
});
