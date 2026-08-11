import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

import { ThreadSidebar, threadsQueryKey } from "@/components/agent/ThreadSidebar";
import { ensureThread } from "@/lib/threads.functions";
import { useQueryClient } from "@tanstack/react-query";
import { Shimmer } from "@/components/ai-elements/shimmer";

export const Route = createFileRoute("/_authenticated/c/")({
  head: () => ({
    meta: [
      { title: "New analysis · Querium" },
      { name: "description", content: "Start a new database conversation with the Querium agent." },
      { property: "og:title", content: "New analysis · Querium" },
      {
        property: "og:description",
        content: "Start a new database conversation with the Querium agent.",
      },
    ],
  }),
  component: NewConversation,
});

function NewConversation() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void (async () => {
      const thread = await ensureThread();
      await queryClient.invalidateQueries({ queryKey: threadsQueryKey });
      void navigate({ to: "/c/$threadId", params: { threadId: thread.id }, replace: true });
    })();
  }, [navigate, queryClient]);

  return (
    <div className="flex h-screen bg-background">
      <ThreadSidebar />
      <div className="flex flex-1 items-center justify-center">
        <Shimmer className="text-sm">Opening a new analysis…</Shimmer>
      </div>
    </div>
  );
}
