// The tool loop: call Claude, run read-only tools, hand submit_candidates to the validator,
// give one repair round, stop on a clean submission or a cap. Model access goes through an
// injected client, so tests use a scripted fake and no network.
import type { Activity, AgentUsage, Candidate } from "@/lib/types";
import { SYSTEM_PROMPT } from "./prompt";
import type { Budget } from "./budget";
import { TraceLog, summarize } from "./trace";
import { READ_TOOLS, SUBMIT_TOOL, TOOL_DEFINITIONS, runTool, type RunState } from "./tools";
import { validateRow } from "./validate";

export const AGENT_MODEL = "claude-sonnet-5-5";
const MAX_TURNS = 12;
const MAX_OUTPUT_TOKENS = 4096;
const TOOL_RESULT_LIMIT = 8000;
/** First submission plus one repair round. */
const SUBMIT_LIMIT = 2;

type ContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> };

/** Shape of the Messages API reply that the loop reads. */
export interface ModelReply {
  stop_reason: string | null;
  content: ContentBlock[];
  usage?: { input_tokens: number; output_tokens: number };
}

/** The part of the Anthropic client the loop uses. The real SDK and the scripted fake both fit. */
export interface ModelClient {
  messages: { create(body: Record<string, unknown>): Promise<ModelReply> };
}

export interface LoopOutcome {
  accepted: Candidate[];
  discovered: Activity[];
  trace: TraceLog;
  usage: AgentUsage;
  gaps: string[];
}

export interface LoopParams {
  client: ModelClient;
  state: RunState;
  budget: Budget;
  onProgress?: (e: { step: string; detail?: string }) => void;
}

export async function runLoop({ client, state, budget, onProgress }: LoopParams): Promise<LoopOutcome> {
  const started = Date.now();
  const trace = new TraceLog();
  const usage: AgentUsage = { toolCalls: 0, inputTokens: 0, outputTokens: 0 };
  const gaps: string[] = [];
  const accepted = new Map<string, Candidate>();
  const discovered = new Map<string, Activity>();
  const messages: { role: "user" | "assistant"; content: unknown }[] = [
    { role: "user", content: "Plan this week's team social event. Start with get_team_context." },
  ];
  let submissions = 0;

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    if (Date.now() - started > budget.timeoutMs) {
      gaps.push("timeout reached");
      break;
    }

    let reply: ModelReply;
    try {
      reply = await client.messages.create({
        model: AGENT_MODEL,
        max_tokens: MAX_OUTPUT_TOKENS,
        system: SYSTEM_PROMPT,
        tools: TOOL_DEFINITIONS,
        messages,
      });
    } catch (e) {
      gaps.push(`model call failed: ${e instanceof Error ? e.message : String(e)}`);
      break;
    }

    usage.inputTokens += reply.usage?.input_tokens ?? 0;
    usage.outputTokens += reply.usage?.output_tokens ?? 0;
    if (usage.inputTokens + usage.outputTokens > budget.maxTokens) {
      gaps.push("token cap reached");
      break;
    }
    messages.push({ role: "assistant", content: reply.content });

    const toolUses = reply.content.filter((b): b is Extract<ContentBlock, { type: "tool_use" }> => b.type === "tool_use");
    if (reply.stop_reason !== "tool_use" || toolUses.length === 0) break;

    const results: unknown[] = [];
    let finished = false;
    for (const block of toolUses) {
      if (usage.toolCalls >= budget.maxToolCalls) {
        gaps.push("tool-call cap reached");
        results.push(toolResult(block.id, { error: "tool-call cap reached" }, true));
        finished = true;
        break;
      }
      usage.toolCalls++;
      const t0 = Date.now();
      onProgress?.({ step: block.name });

      if (block.name === SUBMIT_TOOL) {
        submissions++;
        const rows = Array.isArray(block.input?.candidates) ? (block.input.candidates as unknown[]) : [];
        const rejections: { index: number; reasons: string[] }[] = [];
        let added = 0;
        rows.forEach((row, index) => {
          const verdict = validateRow(row, state, [...discovered.values()]);
          if (!verdict.ok || !verdict.candidate) {
            rejections.push({ index, reasons: verdict.reasons });
            return;
          }
          if (accepted.has(verdict.candidate.id)) return; // already accepted in an earlier submission
          accepted.set(verdict.candidate.id, verdict.candidate);
          if (verdict.discovered) discovered.set(verdict.discovered.id, verdict.discovered);
          added++;
        });
        trace.record(SUBMIT_TOOL, block.input, summarize({ accepted: added, rejected: rejections.length }), t0);

        let text: string;
        if (rejections.length === 0) {
          text = `Accepted ${added} row(s). Done.`;
          finished = true;
        } else if (submissions < SUBMIT_LIMIT) {
          text = `Rejected rows (repair round, one more submission allowed):\n${rejections
            .map((r) => `row ${r.index}: ${r.reasons.join("; ")}`)
            .join("\n")}`;
        } else {
          for (const r of rejections) gaps.push(`row ${r.index} dropped after repair: ${r.reasons.join("; ")}`);
          text = `Final: ${added} accepted, ${rejections.length} dropped. Done.`;
          finished = true;
        }
        results.push(toolResult(block.id, text, false));
        continue;
      }

      if (READ_TOOLS.has(block.name)) {
        try {
          const output = await runTool(state, block.name, block.input ?? {});
          trace.record(block.name, block.input, summarize(output), t0);
          results.push(toolResult(block.id, truncate(JSON.stringify(output)), false));
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          trace.record(block.name, block.input, "", t0, message);
          gaps.push(`${block.name} failed: ${message}`);
          results.push(toolResult(block.id, { error: message }, true));
        }
        continue;
      }

      trace.record(block.name, block.input, "", t0, "unknown tool");
      results.push(toolResult(block.id, { error: `unknown tool ${block.name}` }, true));
    }

    messages.push({ role: "user", content: results });
    if (finished) break;
  }

  return { accepted: [...accepted.values()], discovered: [...discovered.values()], trace, usage, gaps };
}

function toolResult(toolUseId: string, body: unknown, isError: boolean) {
  const content = typeof body === "string" ? body : JSON.stringify(body);
  return { type: "tool_result", tool_use_id: toolUseId, content, ...(isError ? { is_error: true } : {}) };
}

function truncate(text: string): string {
  return text.length > TOOL_RESULT_LIMIT ? `${text.slice(0, TOOL_RESULT_LIMIT)}…` : text;
}
