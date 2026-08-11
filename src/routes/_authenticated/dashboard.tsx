import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, LayoutDashboard, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { ChartCard } from "@/components/agent/ChartCard";
import { QueryResultCard } from "@/components/agent/QueryResultCard";
import { ThreadSidebar } from "@/components/agent/ThreadSidebar";
import { Button } from "@/components/ui/button";
import {
  deleteDashboardTile,
  listDashboardTiles,
  moveDashboardTile,
  type DashboardTile,
} from "@/lib/workspace.functions";
import type { ChartPayload, QueryPayload } from "@/lib/agent/schema-types";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard · Querium" },
      {
        name: "description",
        content: "Charts and tables you pinned from Querium analyses, in one live dashboard.",
      },
      { property: "og:title", content: "Dashboard · Querium" },
      {
        property: "og:description",
        content: "Charts and tables you pinned from Querium analyses, in one live dashboard.",
      },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const queryClient = useQueryClient();
  const tilesKey = ["dashboard-tiles"] as const;

  const tiles = useQuery({ queryKey: tilesKey, queryFn: () => listDashboardTiles() });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: tilesKey });

  const remove = useMutation({
    mutationFn: (id: string) => deleteDashboardTile({ data: { id } }),
    onSuccess: () => void invalidate(),
    onError: (error: Error) => toast.error(error.message),
  });

  const move = useMutation({
    mutationFn: (input: { id: string; direction: "up" | "down" }) =>
      moveDashboardTile({ data: input }),
    onSuccess: () => void invalidate(),
    onError: (error: Error) => toast.error(error.message),
  });

  const list = tiles.data ?? [];

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <ThreadSidebar />
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 border-b border-border px-5 py-3">
          <LayoutDashboard className="size-4 text-primary" />
          <h1 className="font-display text-sm font-semibold text-foreground">Pinned dashboard</h1>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6">
          <div className="mx-auto w-full max-w-4xl space-y-5">
            {tiles.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading dashboard…</p>
            ) : list.length === 0 ? (
              <div className="panel p-8 text-center">
                <p className="font-display text-base font-semibold text-foreground">
                  Nothing pinned yet
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Run an analysis, then use “Pin to dashboard” under any chart or table.
                </p>
              </div>
            ) : (
              list.map((tile, index) => (
                <section key={tile.id} className="space-y-2">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Move up"
                      disabled={index === 0 || move.isPending}
                      onClick={() => move.mutate({ id: tile.id, direction: "up" })}
                    >
                      <ArrowUp className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Move down"
                      disabled={index === list.length - 1 || move.isPending}
                      onClick={() => move.mutate({ id: tile.id, direction: "down" })}
                    >
                      <ArrowDown className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove ${tile.title}`}
                      onClick={() => remove.mutate(tile.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                  <TileBody tile={tile} />
                </section>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function TileBody({ tile }: { tile: DashboardTile }) {
  if (tile.kind === "chart") {
    const payload = tile.payload as unknown as ChartPayload;
    if (!payload?.rows?.length) return null;
    return (
      <ChartCard
        chartType={payload.chartType}
        title={payload.title ?? tile.title}
        xKey={payload.xKey}
        series={payload.series ?? []}
        reason={payload.reason}
        rows={payload.rows}
        sql={payload.sql}
      />
    );
  }

  const payload = tile.payload as unknown as QueryPayload;
  return (
    <QueryResultCard
      purpose={payload?.purpose ?? tile.title}
      sql={payload?.sql ?? ""}
      columns={payload?.columns ?? []}
      rows={payload?.rows ?? []}
      rowCount={payload?.rowCount ?? 0}
      durationMs={payload?.durationMs ?? 0}
      truncated={Boolean(payload?.truncated)}
    />
  );
}
