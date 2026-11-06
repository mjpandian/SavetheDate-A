// Trace of every tool call in a run, so each option can be traced back to the evidence behind it.
import type { ToolCallLog } from "@/lib/types";

/** Short, JSON-safe summary of a tool output for the trace. */
export function summarize(value: unknown, max = 200): string {
  const text = typeof value === "string" ? value : JSON.stringify(value) ?? "";
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

export class TraceLog {
  readonly entries: ToolCallLog[] = [];

  record(tool: string, input: unknown, outputSummary: string, startedAt: number, error?: string): void {
    this.entries.push({
      tool,
      input,
      outputSummary,
      ms: Date.now() - startedAt,
      ...(error ? { error } : {}),
    });
  }
}
