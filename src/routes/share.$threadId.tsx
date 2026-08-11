import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import type { UIMessage } from "ai";
import { ArrowLeft, Sparkles } from "lucide-react";

import {
  Conversation,
  ConversationContent,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import { Reasoning, ReasoningContent, ReasoningTrigger } from "@/components/ai-elements/reasoning";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { ToolPartView } from "@/components/agent/ToolPartView";
import { Button } from "@/components/ui/button";
import { getSharedThreadMessages } from "@/lib/threads.functions";
import queriumMark from "@/assets/querium-mark.png";

export const Route = createFileRoute("/share/$threadId")({
  head: () => ({
    meta: [
      { title: "Shared Analysis · Querium" },
      {
        name: "description",
        content: "View a shared read-only database analysis conversation on Querium.",
      },
    ],
  }),
  component: SharedThreadPage,
});

function SharedThreadPage() {
  const { threadId } = Route.useParams();

  const sharedQuery = useQuery({
    queryKey: ["shared-thread", threadId],
    queryFn: () => getSharedThreadMessages({ data: { threadId } }),
    staleTime: 5 * 60 * 1000, // 5 minutes stale time
    retry: false,
  });

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Public Shared Header */}
      <header className="flex items-center justify-between border-b border-border bg-card/60 px-5 py-4 backdrop-blur">
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2.5">
            <img src={queriumMark} alt="Querium Logo" width={28} height={28} className="size-7" />
            <span className="font-display text-sm font-semibold text-foreground">Querium</span>
          </Link>
          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary">
            Shared Conversation
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/auth">Sign in</Link>
          </Button>
          <Button asChild size="sm" className="shadow-[var(--shadow-glow)]">
            <Link to="/auth" className="flex items-center gap-1.5">
              <Sparkles className="size-3.5" />
              Analyze your own data
            </Link>
          </Button>
        </div>
      </header>

      {/* Main content area */}
      <main className="flex-1 min-h-0 overflow-hidden flex flex-col">
        {sharedQuery.isLoading ? (
          <div className="flex flex-1 items-center justify-center">
            <Shimmer className="text-sm">Loading shared analysis…</Shimmer>
          </div>
        ) : sharedQuery.isError ? (
          <div className="flex flex-1 flex-col items-center justify-center p-4 text-center">
            <div className="max-w-md rounded-xl border border-destructive/40 bg-destructive/10 p-6">
              <h2 className="text-lg font-semibold text-destructive">Shared thread not available</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {sharedQuery.error instanceof Error
                  ? sharedQuery.error.message
                  : "This link may be private or the thread has been deleted by the owner."}
              </p>
              <Button asChild className="mt-5" variant="outline">
                <Link to="/">
                  <ArrowLeft className="mr-2 size-4" />
                  Back to Querium
                </Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex flex-col">
            {/* Thread Title Header */}
            <div className="border-b border-border/40 bg-card/20 px-6 py-3 text-center">
              <h2 className="font-display text-base font-semibold text-foreground">
                {sharedQuery.data?.title}
              </h2>
            </div>

            {/* Conversation Messages */}
            <Conversation className="min-h-0 flex-1">
              <ConversationContent className="mx-auto w-full max-w-3xl px-4 pb-12 pt-6">
                {(sharedQuery.data?.messages as unknown as UIMessage[] ?? []).map((message) => (
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
                          return (
                            <ToolPartView
                              key={key}
                              part={part as never}
                              threadId={threadId}
                              readOnly={true}
                            />
                          );
                        }
                        return null;
                      })}
                    </MessageContent>
                  </Message>
                ))}
              </ConversationContent>
            </Conversation>
          </div>
        )}
      </main>
    </div>
  );
}
