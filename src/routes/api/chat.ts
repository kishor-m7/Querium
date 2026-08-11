import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { convertToModelMessages, streamText, stepCountIs, type UIMessage } from "ai";

import {
  AGENT_MODEL,
  createGateway,
  createRunIdFetch,
  getRunIdFromRequest,
} from "@/lib/ai-gateway.server";
import { AGENT_SYSTEM_PROMPT, agentTools } from "@/lib/agent/tools.server";

type ChatBody = { messages?: UIMessage[]; threadId?: string; confirmSql?: boolean };

type ToolPartLike = {
  type?: string;
  state?: string;
  output?: {
    sql?: unknown;
    purpose?: unknown;
    rowCount?: unknown;
    durationMs?: unknown;
    error?: unknown;
    title?: unknown;
  };
};

/** Records every SQL statement the agent executed so the history panel can replay it. */
function collectQueryHistoryRows(message: { parts?: unknown }) {
  const parts = Array.isArray(message.parts) ? (message.parts as ToolPartLike[]) : [];
  return parts
    .filter(
      (part) =>
        part.type === "tool-execute_query" &&
        part.state === "output-available" &&
        typeof part.output?.sql === "string",
    )
    .map((part) => ({
      sql: String(part.output?.sql),
      purpose:
        typeof part.output?.purpose === "string"
          ? part.output.purpose
          : typeof part.output?.title === "string"
            ? part.output.title
            : null,
      row_count: typeof part.output?.rowCount === "number" ? part.output.rowCount : 0,
      duration_ms: typeof part.output?.durationMs === "number" ? part.output.durationMs : 0,
      error: typeof part.output?.error === "string" ? part.output.error : null,
    }));
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function authenticate(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice("Bearer ".length);
  if (token.split(".").length !== 3) return null;

  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) return null;

  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
      headers: { Authorization: `Bearer ${token}` },
    },
  });

  const { data, error } = await client.auth.getClaims(token);
  if (error || !data?.claims?.sub) return null;
  return { userId: data.claims.sub as string };
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await authenticate(request);
        if (!auth) return json({ error: "Unauthorized" }, 401);

        const body = (await request.json()) as ChatBody;
        const messages = body.messages;
        const threadId = body.threadId;
        if (!Array.isArray(messages) || !threadId) {
          return json({ error: "messages and threadId are required" }, 400);
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: thread, error: threadError } = await supabaseAdmin
          .from("threads")
          .select("id, user_id, title")
          .eq("id", threadId)
          .maybeSingle();
        if (threadError) return json({ error: threadError.message }, 500);
        if (!thread || thread.user_id !== auth.userId) {
          return json({ error: "Thread not found" }, 404);
        }

        const lastMessage = messages[messages.length - 1];
        if (lastMessage?.role === "user") {
          const { error: insertError } = await supabaseAdmin.from("messages").insert({
            thread_id: threadId,
            user_id: auth.userId,
            client_message_id: lastMessage.id,
            role: "user",
            content: lastMessage as never,
          });
          if (insertError) console.error("[chat] failed to persist user message", insertError);

          const firstText = lastMessage.parts
            .map((part) => (part.type === "text" ? part.text : ""))
            .join(" ")
            .trim();
          const isFirstTurn = messages.filter((m) => m.role === "user").length === 1;
          const patch =
            isFirstTurn && firstText
              ? {
                  title: firstText.length > 60 ? `${firstText.slice(0, 57)}...` : firstText,
                  updated_at: new Date().toISOString(),
                }
              : { updated_at: new Date().toISOString() };
          await supabaseAdmin.from("threads").update(patch).eq("id", threadId);
        }

        const initialRunId = getRunIdFromRequest(request);
        const runIdFetch = createRunIdFetch(initialRunId);

        let llmConfig;
        try {
          llmConfig = (await import("@/lib/llm-provider.server")).getLLMModel(runIdFetch);
        } catch (err) {
          const message = err instanceof Error ? err.message : "LLM configuration error";
          return json({ error: message }, 500);
        }

        try {
          const result = streamText({
            model: llmConfig.model,
            system: AGENT_SYSTEM_PROMPT,
            messages: await convertToModelMessages(messages),
            tools: body.confirmSql
              ? {
                  ...agentTools,
                  execute_query: { ...agentTools.execute_query, needsApproval: true },
                }
              : agentTools,

            stopWhen: stepCountIs(50),
            ...(llmConfig.providerName === "lovable-gateway"
              ? {
                  providerOptions: {
                    openai: {
                      forceReasoning: true,
                      reasoningEffort: "medium",
                      reasoningSummary: "auto",
                      store: false,
                      include: ["reasoning.encrypted_content"],
                    },
                  },
                }
              : {}),
            onError: ({ error }) => {
              console.error("[chat] stream error", error);
            },
          });

          return result.toUIMessageStreamResponse({
            originalMessages: messages,
            sendReasoning: true,
            onFinish: async ({ responseMessage }) => {
              const { error } = await supabaseAdmin.from("messages").insert({
                thread_id: threadId,
                user_id: auth.userId,
                client_message_id: responseMessage.id,
                role: "assistant",
                content: responseMessage as never,
              });
              if (error) console.error("[chat] failed to persist assistant message", error);

              const historyRows = collectQueryHistoryRows(responseMessage).map((row) => ({
                ...row,
                thread_id: threadId,
                user_id: auth.userId,
              }));
              if (historyRows.length > 0) {
                const { error: historyError } = await supabaseAdmin
                  .from("query_history")
                  .insert(historyRows);
                if (historyError) console.error("[chat] failed to log query history", historyError);
              }
            },
          });
        } catch (error) {
          console.error("[chat] fatal", error);
          const message = error instanceof Error ? error.message : "Agent failed";
          const status = /rate limit|429/i.test(message)
            ? 429
            : /credit|402|payment/i.test(message)
              ? 402
              : 500;
          return json({ error: message }, status);
        }
      },
    },
  },
});
