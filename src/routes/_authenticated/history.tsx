import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, Play, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { ThreadSidebar, threadsQueryKey } from "@/components/agent/ThreadSidebar";
import { CodeBlock } from "@/components/ai-elements/code-block";
import { Button } from "@/components/ui/button";
import { createThread } from "@/lib/threads.functions";
import { deleteQueryHistory, listQueryHistory, setQueryFavorite } from "@/lib/workspace.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/history")({
  head: () => ({
    meta: [
      { title: "Query history · Querium" },
      {
        name: "description",
        content: "Every SQL statement Querium ran for you, with favourites and one-click re-runs.",
      },
      { property: "og:title", content: "Query history · Querium" },
      {
        property: "og:description",
        content: "Every SQL statement Querium ran for you, with favourites and one-click re-runs.",
      },
    ],
  }),
  component: HistoryPage,
});

function HistoryPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const historyKey = ["query-history"] as const;

  const history = useQuery({ queryKey: historyKey, queryFn: () => listQueryHistory() });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: historyKey });

  const favorite = useMutation({
    mutationFn: (input: { id: string; isFavorite: boolean }) => setQueryFavorite({ data: input }),
    onSuccess: () => void invalidate(),
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteQueryHistory({ data: { id } }),
    onSuccess: () => void invalidate(),
    onError: (error: Error) => toast.error(error.message),
  });

  const rerun = useMutation({
    mutationFn: async (sql: string) => {
      const thread = await createThread();
      return { threadId: thread.id, sql };
    },
    onSuccess: async ({ threadId, sql }) => {
      await queryClient.invalidateQueries({ queryKey: threadsQueryKey });
      void navigate({
        to: "/c/$threadId",
        params: { threadId },
        search: { q: `Re-run this query and explain the result:\n\n${sql}` },
      });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const entries = history.data ?? [];

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <ThreadSidebar />
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 border-b border-border px-5 py-3">
          <Clock className="size-4 text-primary" />
          <h1 className="font-display text-sm font-semibold text-foreground">Query history</h1>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6">
          <div className="mx-auto w-full max-w-3xl space-y-3">
            {history.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading history…</p>
            ) : entries.length === 0 ? (
              <div className="panel p-8 text-center">
                <p className="font-display text-base font-semibold text-foreground">
                  No queries yet
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Every SQL statement the agent runs lands here automatically.
                </p>
              </div>
            ) : (
              entries.map((entry) => (
                <article key={entry.id} className="panel p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-display text-sm font-semibold text-foreground">
                        {entry.purpose ?? "SQL query"}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {new Date(entry.created_at).toLocaleString()} · {entry.row_count} rows ·{" "}
                        {entry.duration_ms} ms
                        {entry.error ? " · failed" : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={entry.is_favorite ? "Remove favourite" : "Save as favourite"}
                        onClick={() =>
                          favorite.mutate({ id: entry.id, isFavorite: !entry.is_favorite })
                        }
                      >
                        <Star
                          className={cn("size-4", entry.is_favorite && "fill-primary text-primary")}
                        />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Re-run this query"
                        disabled={rerun.isPending}
                        onClick={() => rerun.mutate(entry.sql)}
                      >
                        <Play className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Delete from history"
                        onClick={() => remove.mutate(entry.id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="mt-3">
                    <CodeBlock code={entry.sql} language="sql" />
                  </div>
                  {entry.error && (
                    <p className="mt-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                      {entry.error}
                    </p>
                  )}
                </article>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
