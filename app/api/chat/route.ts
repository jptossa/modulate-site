import { ToolLoopAgent, createAgentUIStreamResponse, isStepCount, type UIMessage } from "ai";
import { z } from "zod";
import { getPreferredArea } from "@/lib/area";
import { getCurrentUser } from "@/lib/auth";
import { createEscalation } from "@/lib/chat/escalation";
import { systemPrompt } from "@/lib/chat/system-prompt";
import { buildTools } from "@/lib/chat/tools";
import { withinRateLimit } from "@/lib/chat/rate-limit";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

const MAX_MESSAGES = 30;
const MAX_USER_TEXT = 2000;

const Body = z.object({ messages: z.array(z.unknown()).min(1).max(MAX_MESSAGES) });

/** `code` lets the client react to a failure without matching on the message text. */
const json = (body: { error: string; code?: "guest_limit" | "user_limit" }, status: number) => Response.json(body, { status });

/** The newest message must be from the user and short enough; older turns are the client's own history. */
function lastUserTextTooLong(messages: UIMessage[]): boolean {
  const last = messages.at(-1);
  if (last?.role !== "user") return true;
  const text = last.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
  return text.length > MAX_USER_TEXT;
}

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) return json({ error: "Chat isn't available right now." }, 503);

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "That request couldn't be read." }, 400);
  const messages = parsed.data.messages as UIMessage[];
  if (lastUserTextTooLong(messages)) return json({ error: `Keep each message under ${MAX_USER_TEXT} characters.` }, 400);

  // The toolset is built from the verified session, never from anything in the request body.
  const user = await getCurrentUser();
  if (!(await withinRateLimit(req.headers, user?.id ?? null))) {
    return json(
      user
        ? { error: "You've reached today's chat limit. It resets tomorrow.", code: "user_limit" }
        : {
            error: "You've reached today's guest chat limit. Create a free account to keep going, or come back tomorrow.",
            code: "guest_limit",
          },
      429,
    );
  }

  const db = await createClient();
  // Local figures are an extra: if the area tables are not there yet, chat still works with national data.
  const area = await getPreferredArea(db, user).catch(() => null);
  const tiers = createEscalation(req.headers, user?.id ?? null);
  const agent = new ToolLoopAgent({
    model: tiers.baseModel,
    instructions: systemPrompt(!!user, "escalate" in tiers.tools, area?.name ?? null),
    tools: { ...buildTools(db, user, area), ...tiers.tools },
    stopWhen: isStepCount(8),
    prepareStep: () => ({ model: tiers.model() }),
  });

  return createAgentUIStreamResponse({ agent, uiMessages: messages });
}
