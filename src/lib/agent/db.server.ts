import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type SchemaInfo = {
  schema: string;
  tables: Array<{
    table: string;
    columns: Array<{ name: string; type: string; nullable: boolean }>;
  }>;
  relationships: Array<{
    from_table: string;
    from_column: string;
    to_table: string;
    to_column: string;
  }>;
};

export type QueryRow = Record<string, unknown>;

export type QueryResult = {
  sql: string;
  columns: string[];
  rows: QueryRow[];
  rowCount: number;
  durationMs: number;
  truncated: boolean;
};

const MAX_RETURNED_ROWS = 500;

/** Client-side guard mirroring the database-level guard in demo_run_select. */
const FORBIDDEN =
  /\b(insert|update|delete|drop|alter|create|truncate|grant|revoke|copy|vacuum|call|do|merge|set|reset|listen|notify|pg_sleep|pg_read_file|dblink)\b/i;

export function assertReadOnlySelect(sql: string): string {
  const cleaned = sql
    .trim()
    .replace(/;+\s*$/, "")
    .trim();
  if (!cleaned) throw new Error("Empty SQL statement.");

  // Strip single-line and multi-line comments for security validation
  const noComments = cleaned
    .replace(/--.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .trim();

  if (!/^(select|with)\s/i.test(noComments)) {
    throw new Error("Only read-only SELECT / WITH queries are allowed.");
  }
  if (noComments.includes(";")) {
    throw new Error("Only a single statement is allowed per query.");
  }
  if (FORBIDDEN.test(noComments)) {
    throw new Error("Query contains a write or administrative keyword and was blocked.");
  }
  return cleaned;
}

export async function getSchema(): Promise<SchemaInfo> {
  const { data, error } = await supabaseAdmin.rpc("demo_get_schema" as never);
  if (error) throw new Error(`Schema inspection failed: ${error.message}`);
  return data as unknown as SchemaInfo;
}

export async function runSelect(sql: string): Promise<QueryResult> {
  const cleaned = assertReadOnlySelect(sql);
  const startedAt = Date.now();
  const { data, error } = await supabaseAdmin.rpc(
    "demo_run_select" as never,
    {
      query_text: cleaned,
    } as never,
  );
  const durationMs = Date.now() - startedAt;

  if (error) throw new Error(error.message);

  const allRows = (data ?? []) as QueryRow[];
  const rows = allRows.slice(0, MAX_RETURNED_ROWS);
  const columns = rows.length > 0 ? Object.keys(rows[0]!) : [];

  return {
    sql: cleaned,
    columns,
    rows,
    rowCount: allRows.length,
    durationMs,
    truncated: allRows.length > rows.length,
  };
}
