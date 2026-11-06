/**
 * Per-million-token list prices (USD) for cost reporting in evals.
 * Source: https://platform.claude.com/docs/en/about-claude/pricing (checked 2026-10-28).
 * Base input and output only; cache writes and reads are not in the agent's usage counts.
 * Haiku 5.5 has a second tier above 100K prompt tokens, so it is left out until the eval tracks per-request sizes.
 */
export const PRICE_PER_MTOK: Record<string, { input: number; output: number }> = {
  "claude-opus-5-5": { input: 4, output: 20 },
  "claude-sonnet-5-5": { input: 2, output: 10 },
};

export interface TokenUsage { inputTokens: number; outputTokens: number }

/** Cost in USD for one run's token usage at a model's list price. Throws on an unknown model so a typo cannot read as free. */
export function costUsd(model: string, usage: TokenUsage): number {
  const price = PRICE_PER_MTOK[model];
  if (!price) throw new Error(`No price for model ${model}; add it to evals/shared/pricing.ts`);
  return (usage.inputTokens * price.input + usage.outputTokens * price.output) / 1_000_000;
}

/** Cost for each priced model, so a run reads the same whichever model the agent is configured to use. */
export function costByModel(usage: TokenUsage): Record<string, number> {
  return Object.fromEntries(Object.keys(PRICE_PER_MTOK).map((m) => [m, costUsd(m, usage)]));
}
