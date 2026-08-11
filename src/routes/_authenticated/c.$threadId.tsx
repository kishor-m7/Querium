import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UIMessage } from "ai";
import { Copy, ExternalLink, Share2 } from "lucide-react";
import { toast } from "sonner";

import { ChatWindow } from "@/components/agent/ChatWindow";
import { ThreadSidebar, threadsQueryKey } from "@/components/agent/ThreadSidebar";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { getThreadMessages, toggleThreadShare } from "@/lib/threads.functions";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/c/$threadId")({
  validateSearch: (search: Record<string, unknown>): { q?: string } =>
    typeof search["q"] === "string" && search["q"] ? { q: search["q"] } : {},

  head: () => ({
    meta: [
      { title: "Analysis · Querium" },
      {
        name: "description",
        content: "A live conversation with Querium: SQL, charts, diagrams and insights.",
      },
      { property: "og:title", content: "Analysis · Querium" },
      {
        property: "og:description",
        content: "A live conversation with Querium: SQL, charts, diagrams and insights.",
      },
    ],
  }),
  component: ThreadPage,
});

function ThreadPage() {
  const { threadId } = Route.useParams();
  const { q } = Route.useSearch();
  const queryClient = useQueryClient();

  const history = useQuery({
    queryKey: ["thread", threadId],
    queryFn: () => getThreadMessages({ data: { threadId } }),
    staleTime: Infinity,
  });

  const toggleShare = useMutation({
    mutationFn: (isShared: boolean) => toggleThreadShare({ data: { threadId, isShared } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: threadsQueryKey });
      void queryClient.invalidateQueries({ queryKey: ["thread", threadId] });
      toast.success("Sharing status updated");
    },
    onError: (error: Error) => toast.error(error.message || "Failed to update sharing status"),
  });

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <ThreadSidebar activeThreadId={threadId} />
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border px-5 py-3">
          <h1 className="truncate font-display text-sm font-semibold text-foreground">
            {history.data?.title ?? "Conversation"}
          </h1>
          <div className="flex items-center gap-3">
            {history.data && (
              <SharePopover
                threadId={threadId}
                isShared={history.data.is_shared}
                onToggle={(val) => toggleShare.mutate(val)}
                isPending={toggleShare.isPending}
              />
            )}
            <span className="hidden rounded-full border border-border px-2.5 py-0.5 text-[11px] text-muted-foreground sm:block">
              demo sales database · read-only
            </span>
          </div>
        </header>
        {history.isLoading ? (
          <div className="flex flex-1 items-center justify-center">
            <Shimmer className="text-sm">Loading conversation…</Shimmer>
          </div>
        ) : (
          <ChatWindow
            key={threadId}
            threadId={threadId}
            initialMessages={(history.data?.messages ?? []) as unknown as UIMessage[]}
            {...(q ? { initialPrompt: q } : {})}

            onTurnComplete={() => {
              void queryClient.invalidateQueries({ queryKey: threadsQueryKey });
            }}
          />
        )}
      </main>
    </div>
  );
}

function SharePopover({
  threadId,
  isShared,
  onToggle,
  isPending,
}: {
  threadId: string;
  isShared: boolean;
  onToggle: (checked: boolean) => void;
  isPending: boolean;
}) {
  const shareUrl = typeof window !== "undefined"
    ? `${window.location.origin}/share/${threadId}`
    : `/share/${threadId}`;

  const copy = () => {
    void navigator.clipboard.writeText(shareUrl);
    toast.success("Share link copied to clipboard");
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          aria-label="Share this analysis"
        >
          <Share2 className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-4">
        <div>
          <h4 className="font-display text-sm font-semibold text-foreground">Share this analysis</h4>
          <p className="mt-1 text-xs text-muted-foreground">
            Make this thread public. Anyone with the link will be able to view the conversation, SQL details, and charts in read-only mode.
          </p>
        </div>
        
        <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-2.5">
          <span className="text-xs font-medium text-foreground">Enable public link</span>
          <Switch
            checked={isShared}
            disabled={isPending}
            onCheckedChange={onToggle}
          />
        </div>

        {isShared && (
          <div className="space-y-2">
            <div className="flex gap-1.5">
              <input
                readOnly
                type="text"
                value={shareUrl}
                className="flex-1 rounded-md border border-input bg-card px-2.5 py-1 text-xs text-muted-foreground outline-none"
              />
              <Button size="icon-xs" variant="outline" className="h-7 w-7" onClick={copy} aria-label="Copy link">
                <Copy className="size-3.5" />
              </Button>
              <Button asChild size="icon-xs" variant="outline" className="h-7 w-7" aria-label="Open link in new tab">
                <a href={shareUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="size-3.5" />
                </a>
              </Button>
            </div>
            <p className="text-[10px] text-primary">
              Public link is active and live.
            </p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
