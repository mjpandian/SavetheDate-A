import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RankPicker, isComplete, optionsFor, setRank, type Ranking } from "@/components/RankPicker";

const options = [
  { id: "a", label: "Ramen" },
  { id: "b", label: "Bowling" },
  { id: "c", label: "Escape room" },
  { id: "d", label: "Museum" },
];

describe("RankPicker logic", () => {
  it("never offers an option another slot already holds", () => {
    const value: Ranking = ["a", "b", ""];
    expect(optionsFor(2, value, options).map((o) => o.id)).toEqual(["c", "d"]);
    // a slot can still keep its own pick
    expect(optionsFor(0, value, options).map((o) => o.id)).toEqual(["a", "c", "d"]);
  });

  it("setRank clears the other slot when the same id is picked twice", () => {
    expect(setRank(["a", "b", "c"], 2, "a")).toEqual(["", "b", "a"]);
  });

  it("isComplete needs three different, non-empty picks", () => {
    expect(isComplete(["a", "b", "c"])).toBe(true);
    expect(isComplete(["a", "b", ""])).toBe(false);
    expect(isComplete(["a", "a", "b"])).toBe(false);
  });
});

describe("RankPicker component", () => {
  it("renders three labelled selects", () => {
    render(<RankPicker options={options} value={["", "", ""]} onChange={() => {}} />);
    expect(screen.getByLabelText(/1st choice/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/2nd choice/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/3rd choice/i)).toBeInTheDocument();
  });

  it("hides already chosen options from the other selects", () => {
    render(<RankPicker options={options} value={["a", "", ""]} onChange={() => {}} />);
    const second = screen.getByLabelText(/2nd choice/i) as HTMLSelectElement;
    const labels = Array.from(second.options).map((o) => o.text);
    expect(labels).not.toContain("Ramen");
    expect(labels).toContain("Bowling");
  });

  it("reports a change with no duplicate ranks", () => {
    const onChange = vi.fn();
    render(<RankPicker options={options} value={["a", "b", ""]} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText(/3rd choice/i), { target: { value: "c" } });
    expect(onChange).toHaveBeenCalledWith(["a", "b", "c"]);
  });
});
