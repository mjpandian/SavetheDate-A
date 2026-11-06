// Per-run caps. Hitting any cap ends the tool loop; accepted rows are kept, otherwise the run falls back.
export interface Budget {
  /** Tool calls executed in one run (submit_candidates included). */
  maxToolCalls: number;
  /** Input plus output tokens summed over every model call in one run. */
  maxTokens: number;
  /** Wall-clock limit for the whole loop. */
  timeoutMs: number;
}

export const DEFAULT_BUDGET: Budget = { maxToolCalls: 20, maxTokens: 30_000, timeoutMs: 60_000 };

export function resolveBudget(partial: Partial<Budget> = {}): Budget {
  return { ...DEFAULT_BUDGET, ...partial };
}
