import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";

export type QueryHistoryEntry = {
  id: string;
  thread_id: string | null;
  purpose: string | null;
  sql: string;
  row_count: number;
  duration_ms: number;
  error: string | null;
  is_favorite: boolean;
  created_at: string;
};

export type DashboardTile = {
  id: string;
  thread_id: string | null;
  kind: string;
  title: string;
  payload: Json;
  position: number;
  created_at: string;
};

const HISTORY_COLUMNS =
  "id, thread_id, purpose, sql, row_count, duration_ms, error, is_favorite, created_at";
const TILE_COLUMNS = "id, thread_id, kind, title, payload, position, created_at";

/** Every SQL statement the agent has run for this user, newest first. */
export const listQueryHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<QueryHistoryEntry[]> => {
    const { data, error } = await context.supabase
      .from("query_history")
      .select(HISTORY_COLUMNS)
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) throw new Error(error.message);
    return (data ?? []) as QueryHistoryEntry[];
  });

export const setQueryFavorite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; isFavorite: boolean }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("query_history")
      .update({ is_favorite: data.isFavorite })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteQueryHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("query_history").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Tiles pinned to the user's dashboard, in display order. */
export const listDashboardTiles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DashboardTile[]> => {
    const { data, error } = await context.supabase
      .from("dashboard_tiles")
      .select(TILE_COLUMNS)
      .order("position", { ascending: true })
      .limit(100);
    if (error) throw new Error(error.message);
    return (data ?? []) as DashboardTile[];
  });

export const createDashboardTile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { kind: "chart" | "table"; title: string; payload: Json; threadId?: string }) => input,
  )
  .handler(async ({ data, context }): Promise<DashboardTile> => {
    const { data: last } = await context.supabase
      .from("dashboard_tiles")
      .select("position")
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: created, error } = await context.supabase
      .from("dashboard_tiles")
      .insert({
        user_id: context.userId,
        thread_id: data.threadId ?? null,
        kind: data.kind,
        title: data.title.slice(0, 160),
        payload: data.payload,
        position: (last?.position ?? 0) + 1,
      })
      .select(TILE_COLUMNS)
      .single();
    if (error) throw new Error(error.message);
    return created as DashboardTile;
  });

export const deleteDashboardTile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("dashboard_tiles").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Swaps a tile with its neighbour so the user can reorder the dashboard. */
export const moveDashboardTile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; direction: "up" | "down" }) => input)
  .handler(async ({ data, context }) => {
    const { data: tiles, error } = await context.supabase
      .from("dashboard_tiles")
      .select("id, position")
      .order("position", { ascending: true });
    if (error) throw new Error(error.message);

    const list = tiles ?? [];
    const index = list.findIndex((tile) => tile.id === data.id);
    const targetIndex = data.direction === "up" ? index - 1 : index + 1;
    if (index < 0 || targetIndex < 0 || targetIndex >= list.length) return { ok: true };

    const current = list[index]!;
    const target = list[targetIndex]!;

    const updates = await Promise.all([
      context.supabase
        .from("dashboard_tiles")
        .update({ position: target.position })
        .eq("id", current.id),
      context.supabase
        .from("dashboard_tiles")
        .update({ position: current.position })
        .eq("id", target.id),
    ]);
    const failed = updates.find((result) => result.error);
    if (failed?.error) throw new Error(failed.error.message);
    return { ok: true };
  });
