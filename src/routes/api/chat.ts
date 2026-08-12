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
import { supabaseAdmin } from "@/integrations/supabase/client.server";

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
  try {
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

    let userId: string | null = null;

    // Try getClaims if supported by the client instance
    if (typeof (client.auth as unknown as { getClaims?: Function }).getClaims === "function") {
      const res = await (client.auth as unknown as { getClaims: (t: string) => Promise<{ data?: { claims?: { sub?: string } }; error?: unknown }> }).getClaims(token);
      if (!res.error && res.data?.claims?.sub) {
        userId = res.data.claims.sub;
      }
    }

    // Fallback to getUser
    if (!userId) {
      const { data: userData, error: userError } = await client.auth.getUser(token);
      if (!userError && userData?.user?.id) {
        userId = userData.user.id;
      }
    }

    // Fallback to parsing standard JWT sub
    if (!userId) {
      try {
        const payloadBase64 = token.split(".")[1];
        if (payloadBase64) {
          const payloadJson = Buffer.from(payloadBase64, "base64").toString("utf-8");
          const payload = JSON.parse(payloadJson);
          if (payload && typeof payload.sub === "string") {
            userId = payload.sub;
          }
        }
      } catch {
        // ignore parse error
      }
    }

    if (!userId) return null;
    return { userId, token };
  } catch (err) {
    console.error("[CHAT] Authentication error:", err);
    return null;
  }
}

function getDbClient(token: string) {
  const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (serviceKey) {
    return supabaseAdmin;
  }
  const url = process.env["SUPABASE_URL"]!;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient(url, key, {
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
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          console.log("[CHAT] Request received");

          const auth = await authenticate(request);
          if (!auth) {
            console.log("[CHAT] Authentication failed or missing");
            return json({ error: true, message: "Unauthorized" }, 401);
          }
          console.log("[CHAT] Authentication checked");

          let body: ChatBody;
          try {
            body = (await request.json()) as ChatBody;
          } catch {
            console.log("[CHAT] Invalid JSON request body");
            return json({ error: true, message: "Invalid JSON body" }, 400);
          }
          const messages = body.messages;
          const threadId = body.threadId;
          if (!Array.isArray(messages)) {
            return json({ error: true, message: "messages array is required" }, 400);
          }

          const targetThreadId = threadId || crypto.randomUUID();
          const dbClient = getDbClient(auth.token);

          let { data: thread, error: threadError } = await dbClient
            .from("threads")
            .select("id, user_id, title")
            .eq("id", targetThreadId)
            .maybeSingle();

          if (threadError) {
            console.error("[CHAT] Thread retrieval error:", threadError);
            const isJwtError = /PGRST301|No suitable key|JWT/i.test(threadError.message || "");
            const msg = isJwtError
              ? "Authentication token invalid or expired. Please sign in again."
              : threadError.message;
            return json({ error: true, message: msg }, isJwtError ? 401 : 500);
          }

          if (!thread) {
            console.log(`[CHAT] Thread ${targetThreadId} not found, auto-creating for user ${auth.userId}`);
            const { data: created, error: createError } = await dbClient
              .from("threads")
              .insert({
                id: targetThreadId,
                user_id: auth.userId,
                title: "New conversation",
              })
              .select("id, user_id, title")
              .single();

            if (createError) {
              console.error("[CHAT] Failed to auto-create thread:", createError);
              return json({ error: true, message: "Thread not found" }, 404);
            }
            thread = created;
          } else if (thread.user_id !== auth.userId) {
            console.warn(`[CHAT] User ${auth.userId} attempted to access thread ${targetThreadId} owned by ${thread.user_id}`);
            return json({ error: true, message: "Thread not found" }, 404);
          }

          const activeThreadId = thread.id;

          const lastMessage = messages[messages.length - 1];
          if (lastMessage?.role === "user") {
            const { error: insertError } = await dbClient.from("messages").insert({
              thread_id: activeThreadId,
              user_id: auth.userId,
              client_message_id: lastMessage.id,
              role: "user",
              content: lastMessage as never,
            });
            if (insertError) console.error("[CHAT] Failed to persist user message:", insertError);

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
            await dbClient.from("threads").update(patch).eq("id", activeThreadId);
          }

          const initialRunId = getRunIdFromRequest(request);
          const runIdFetch = createRunIdFetch(initialRunId);

          let llmConfig;
          try {
            llmConfig = (await import("@/lib/llm-provider.server")).getLLMModel(runIdFetch);
            console.log("[CHAT] LLM provider initialized:", llmConfig.providerName);
          } catch (err) {
            const message = err instanceof Error ? err.message : "LLM configuration error";
            console.error("[CHAT] LLM initialization failed:", message);
            return json({ error: true, message }, 500);
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
              onError: (error) => {
                console.error("[CHAT STREAM ERROR]", error);
                const msg = normalizeError(error);
                if (/no credits|credit|402|payment/i.test(msg)) {
                  return "OpenAI API Key has no credits remaining. Please add billing credits at https://platform.openai.com/settings/organization/billing/.";
                }
                return msg || "An error occurred in AI stream";
              },
              onFinish: async ({ responseMessage }) => {
                const { error } = await dbClient.from("messages").insert({
                  thread_id: activeThreadId,
                  user_id: auth.userId,
                  client_message_id: responseMessage.id,
                  role: "assistant",
                  content: responseMessage as never,
                });
                if (error) console.error("[chat] failed to persist assistant message", error);

                const historyRows = collectQueryHistoryRows(responseMessage).map((row) => ({
                  ...row,
                  thread_id: activeThreadId,
                  user_id: auth.userId,
                }));
                if (historyRows.length > 0) {
                  const { error: historyError } = await dbClient
                    .from("query_history")
                    .insert(historyRows);
                  if (historyError) console.error("[chat] failed to log query history", historyError);
                }
              },
            });
          } catch (error) {
            console.error("[CHAT] Fatal agent execution error:", error);
            const message = normalizeError(error);
            const status = /rate limit|429/i.test(message)
              ? 429
              : /credit|402|payment/i.test(message)
                ? 402
                : 500;
            return json({ error: true, message }, status);
          }
        } catch (fatalError) {
          console.error("[CHAT FATAL UNHANDLED ERROR]", fatalError);
          const message = normalizeError(fatalError);
          return json({ error: true, message }, 500);
        }
      },
    },
  },
});
