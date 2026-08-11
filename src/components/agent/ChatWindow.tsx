import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import { Copy, RotateCcw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageAction,
  MessageActions,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { Reasoning, ReasoningContent, ReasoningTrigger } from "@/components/ai-elements/reasoning";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { ToolPartView } from "@/components/agent/ToolPartView";
import { VoiceInputButton } from "@/components/agent/VoiceInputButton";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { CodeBlock } from "@/components/ai-elements/code-block";
import queriumMark from "@/assets/querium-mark.png";

const SUGGESTIONS = [
  "Top 5 products by revenue this quarter",
  "Show monthly revenue trends",
  "Which country has the highest sales?",
  "Draw the ER diagram",
  "Show me the workflow of how an order moves through the system",
];

const CONFIRM_KEY = "querium:confirm-sql";

export function ChatWindow({
  threadId,
  initialMessages,
  initialPrompt,
  onTurnComplete,
}: {
  threadId: string;
  initialMessages: UIMessage[];
  initialPrompt?: string;
  onTurnComplete?: () => void;
}) {
  const [input, setInput] = useState("");
  const [confirmSql, setConfirmSql] = useState(false);
  const confirmSqlRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(CONFIRM_KEY) === "1";
    setConfirmSql(stored);
    confirmSqlRef.current = stored;
  }, []);

  const updateConfirmSql = (value: boolean) => {
    setConfirmSql(value);
    confirmSqlRef.current = value;
    window.localStorage.setItem(CONFIRM_KEY, value ? "1" : "0");
  };

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        prepareSendMessagesRequest: async ({ messages }) => {
          const { data } = await supabase.auth.getSession();
          const token = data.session?.access_token;
          return {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            body: { messages, threadId, confirmSql: confirmSqlRef.current },
          };
        },
      }),
    [threadId],
  );

  const { messages, sendMessage, status, stop, error, regenerate, addToolApprovalResponse } =
    useChat({
      id: threadId,
      messages: initialMessages,
      transport,
      onError: (chatError) => {
        toast.error(chatError.message || "The agent hit an error");
      },
      onFinish: () => {
        onTurnComplete?.();
      },
    });

  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    if (!busy) textareaRef.current?.focus();
  }, [busy, threadId]);

  const submit = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setInput("");
    void sendMessage({ text: trimmed });
  };

  // Auto-runs a prompt handed over from the history panel or a dashboard tile.
  const sentInitialPrompt = useRef(false);
  useEffect(() => {
    if (!initialPrompt || sentInitialPrompt.current || messages.length > 0) return;
    sentInitialPrompt.current = true;
    void sendMessage({ text: initialPrompt });
  }, [initialPrompt, messages.length, sendMessage]);

  const lastMessage = messages[messages.length - 1];
  const showThinking =
    status === "submitted" || (status === "streaming" && lastMessage?.role === "user");

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Conversation className="min-h-0 flex-1">
        <ConversationContent className="mx-auto w-full max-w-3xl px-4 pb-6">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-center">
              <img
                src={queriumMark}
                alt="Querium"
                width={96}
                height={96}
                className="size-20 drop-shadow-[0_0_28px_oklch(0.8_0.14_193/0.35)]"
              />
              <h2 className="mt-5 font-display text-2xl font-semibold text-foreground">
                Ask anything about your data
              </h2>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                Querium inspects the schema, writes SQL, charts the answer and explains what it
                means — every step visible.
              </p>
              <div className="mt-7 grid w-full max-w-xl gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => submit(suggestion)}
                    className="rounded-xl border border-border bg-card px-4 py-3 text-left text-sm text-foreground/90 transition-colors hover:border-primary/50 hover:bg-surface-raised"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <Message key={message.id} from={message.role}>
                <MessageContent>
                  {message.parts.map((part, index) => {
                    const key = `${message.id}-${index}`;
                    if (part.type === "text") {
                      return message.role === "assistant" ? (
                        <MessageResponse key={key}>{part.text}</MessageResponse>
                      ) : (
                        <p key={key} className="whitespace-pre-wrap">
                          {part.text}
                        </p>
                      );
                    }
                    if (part.type === "reasoning") {
                      if (!part.text?.trim()) return null;
                      return (
                        <Reasoning
                          key={key}
                          isStreaming={part.state === "streaming"}
                          className="w-full"
                        >
                          <ReasoningTrigger />
                          <ReasoningContent>{part.text}</ReasoningContent>
                        </Reasoning>
                      );
                    }
                    if (part.type.startsWith("tool-")) {
                      const approvalPart = part as unknown as {
                        state?: string;
                        input?: { sql?: string; purpose?: string };
                        approval?: { id: string; approved?: boolean };
                      };
                      if (approvalPart.state === "approval-requested" && approvalPart.approval) {
                        return (
                          <ApprovalPrompt
                            key={key}
                            sql={approvalPart.input?.sql ?? ""}
                            purpose={approvalPart.input?.purpose}
                            onRespond={(approved) =>
                              addToolApprovalResponse({
                                id: approvalPart.approval!.id,
                                approved,
                              })
                            }
                          />
                        );
                      }
                      if (approvalPart.state === "approval-responded") {
                        return (
                          <p key={key} className="text-xs text-muted-foreground">
                            {approvalPart.approval?.approved
                              ? "SQL approved — running…"
                              : "SQL declined."}
                          </p>
                        );
                      }
                      return <ToolPartView key={key} part={part as never} threadId={threadId} />;
                    }
                    return null;
                  })}
                </MessageContent>
                {message.role === "assistant" && status !== "streaming" && (
                  <MessageActions>
                    <MessageAction
                      tooltip="Copy answer"
                      onClick={() => {
                        const text = message.parts
                          .map((part) => (part.type === "text" ? part.text : ""))
                          .join("\n")
                          .trim();
                        void navigator.clipboard.writeText(text);
                        toast.success("Answer copied");
                      }}
                    >
                      <Copy className="size-3.5" />
                    </MessageAction>
                    <MessageAction tooltip="Regenerate" onClick={() => void regenerate()}>
                      <RotateCcw className="size-3.5" />
                    </MessageAction>
                  </MessageActions>
                )}
              </Message>
            ))
          )}

          {showThinking && (
            <div className="py-2">
              <Shimmer className="text-sm">Planning the analysis…</Shimmer>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <p>{error.message}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => void regenerate()}
              >
                Retry
              </Button>
            </div>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="border-t border-border bg-background/80 px-4 py-3 backdrop-blur">
        <div className="mx-auto w-full max-w-3xl">
          <PromptInput
            onSubmit={(_message, event) => {
              event.preventDefault();
              submit(input);
            }}
          >
            <PromptInputTextarea
              ref={textareaRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask about revenue, customers, products, or the schema…"
            />
            <PromptInputFooter className="justify-between">
              <div className="flex items-center gap-3">
                <VoiceInputButton
                  disabled={busy}
                  onTranscript={(text) =>
                    setInput((current) => (current ? `${current} ${text}` : text))
                  }
                />
                <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                  <Switch
                    checked={confirmSql}
                    onCheckedChange={updateConfirmSql}
                    aria-label="Confirm SQL before running"
                  />
                  Confirm SQL
                </label>
              </div>
              <PromptInputSubmit
                status={status}
                disabled={!busy && input.trim().length === 0}
                onStop={() => void stop()}
              />
            </PromptInputFooter>
          </PromptInput>
        </div>
      </div>
    </div>
  );
}

/** Human-in-the-loop gate shown when "Confirm SQL" is enabled. */
function ApprovalPrompt({
  sql,
  purpose,
  onRespond,
}: {
  sql: string;
  purpose?: string | undefined;
  onRespond: (approved: boolean) => void;
}) {
  return (
    <div className="rounded-xl border border-primary/40 bg-primary/5 p-4">
      <p className="flex items-center gap-2 font-display text-sm font-semibold text-foreground">
        <ShieldCheck className="size-4 text-primary" />
        Approve this query?
      </p>
      {purpose && <p className="mt-1 text-xs text-muted-foreground">{purpose}</p>}
      <div className="mt-3">
        <CodeBlock code={sql} language="sql" />
      </div>
      <div className="mt-3 flex gap-2">
        <Button size="sm" onClick={() => onRespond(true)}>
          Run query
        </Button>
        <Button size="sm" variant="outline" onClick={() => onRespond(false)}>
          Decline
        </Button>
      </div>
    </div>
  );
}
