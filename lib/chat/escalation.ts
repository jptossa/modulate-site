import "server-only";
import { anthropic } from "@ai-sdk/anthropic";
import { tool, type LanguageModel } from "ai";
import { z } from "zod";
import { withinSonnetLimit } from "./rate-limit";
import type { EscalateOutput } from "./types";

export const DEFAULT_MODEL = "claude-haiku-5-5";
export const DEFAULT_ESCALATION_MODEL = "claude-sonnet-5-5";

/**
 * Two-tier model setup: a fast model answers by default and can hand the rest of its reply to a stronger
 * one. The fast model decides, by calling the `escalate` tool; the daily cap is per person and enforced
 * here, not by the model. State lives in this closure, so build one per request.
 */
export function createEscalation(headers: Headers, userId: string | null) {
  const baseId = process.env.CHAT_MODEL || DEFAULT_MODEL;
  const strongId = process.env.CHAT_ESCALATION_MODEL || DEFAULT_ESCALATION_MODEL;
  let escalated = false;

  const base: LanguageModel = anthropic(baseId);
  const strong: LanguageModel = anthropic(strongId);

  const escalate = tool({
    description:
      "Hand the rest of this reply to a stronger, slower model. Call it before answering when the question is genuinely hard: comparing several roles against each other, weighing conflicting or missing data, a vague or multi-part career goal, or a trade-off that needs careful reasoning. Do not call it for lookups, simple questions or follow-ups. Each person can use it only a few times a day.",
    inputSchema: z.object({
      reason: z.string().trim().max(200).describe("One short sentence on why this needs more careful reasoning."),
    }),
    execute: async (): Promise<EscalateOutput> => {
      if (escalated) return { escalated: true };
      if (!(await withinSonnetLimit(headers, userId))) {
        return { escalated: false, note: "Daily limit for deeper analysis reached. Carry on and answer as well as you can." };
      }
      escalated = true;
      return { escalated: true };
    },
  });

  // Empty when both tiers are the same model: escalating would change nothing but the quota.
  const tools: Record<string, typeof escalate> = {};
  if (baseId !== strongId) tools.escalate = escalate;

  return {
    tools,
    /** For `prepareStep`: the model for the next step. */
    model: (): LanguageModel => (escalated ? strong : base),
    baseModel: base,
  };
}
