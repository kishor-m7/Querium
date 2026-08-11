import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { History, LayoutDashboard, LogOut, MessageSquarePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { createThread, deleteThread, listThreads } from "@/lib/threads.functions";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import queriumMark from "@/assets/querium-mark.png";

export const threadsQueryKey = ["threads"] as const;

export function ThreadSidebar({ activeThreadId }: { activeThreadId?: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const threads = useQuery({
    queryKey: threadsQueryKey,
    queryFn: () => listThreads(),
  });

  const create = useMutation({
    mutationFn: () => createThread(),
    onSuccess: async (thread) => {
      await queryClient.invalidateQueries({ queryKey: threadsQueryKey });
      void navigate({ to: "/c/$threadId", params: { threadId: thread.id } });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: (threadId: string) => deleteThread({ data: { threadId } }),
    onSuccess: async (_result, threadId) => {
      await queryClient.invalidateQueries({ queryKey: threadsQueryKey });
      if (threadId === activeThreadId) void navigate({ to: "/c" });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex items-center gap-2.5 px-4 py-4">
        <img src={queriumMark} alt="" width={32} height={32} className="size-8" />
        <div className="leading-tight">
          <p className="font-display text-sm font-semibold text-sidebar-foreground">Querium</p>
          <p className="text-[11px] text-muted-foreground">data analyst agent</p>
        </div>
      </div>

      <div className="px-3">
        <Button
          className="w-full justify-start gap-2"
          disabled={create.isPending}
          onClick={() => create.mutate()}
        >
          <MessageSquarePlus className="size-4" />
          New analysis
        </Button>
      </div>

      <div className="mt-3 space-y-0.5 px-2">
        <Link
          to="/dashboard"
          className="flex items-center gap-2 rounded-md px-2 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent/60"
          activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground" }}
        >
          <LayoutDashboard className="size-4" />
          Dashboard
        </Link>
        <Link
          to="/history"
          className="flex items-center gap-2 rounded-md px-2 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent/60"
          activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground" }}
        >
          <History className="size-4" />
          Query history
        </Link>
      </div>

      <nav className="mt-4 min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        <p className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          History
        </p>
        {threads.isLoading ? (
          <div className="space-y-1 px-2">
            {[0, 1, 2].map((index) => (
              <div key={index} className="h-8 animate-pulse rounded-md bg-sidebar-accent" />
            ))}
          </div>
        ) : (threads.data?.length ?? 0) === 0 ? (
          <p className="px-2 py-2 text-xs text-muted-foreground">No conversations yet.</p>
        ) : (
          <ul className="space-y-0.5">
            {threads.data?.map((thread) => (
              <li
                key={thread.id}
                className={cn(
                  "group flex items-center gap-1 rounded-md pr-1 transition-colors",
                  thread.id === activeThreadId
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "hover:bg-sidebar-accent/60",
                )}
              >
                <Link
                  to="/c/$threadId"
                  params={{ threadId: thread.id }}
                  className="min-w-0 flex-1 truncate px-2 py-2 text-sm text-sidebar-foreground"
                >
                  {thread.title}
                </Link>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Delete ${thread.title}`}
                  className="opacity-0 transition-opacity group-hover:opacity-100"
                  onClick={() => remove.mutate(thread.id)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </nav>

      <div className="border-t border-sidebar-border p-2">
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 text-muted-foreground"
          onClick={async () => {
            await supabase.auth.signOut();
            queryClient.clear();
            void navigate({ to: "/auth" });
          }}
        >
          <LogOut className="size-4" />
          Sign out
        </Button>
      </div>
    </aside>
  );
}
