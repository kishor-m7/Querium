/** Browser-safe mirrors of the agent tool payload shapes (no server imports). */

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

export type QueryPayload = {
  purpose?: string;
  sql: string;
  columns: string[];
  rows: Array<Record<string, unknown>>;
  rowCount: number;
  durationMs: number;
  truncated: boolean;
  error?: string;
};

export type ChartPayload = {
  chartType: "bar" | "line" | "pie" | "scatter" | "area";
  title: string;
  xKey: string;
  series: Array<{ key: string; label: string }>;
  reason: string;
  rows: Array<Record<string, unknown>>;
  sql: string;
  error?: string;
};

export type DiagramPayload = {
  kind: "er_diagram" | "workflow" | "decision_tree";
  title: string;
  mermaid: string;
};

export type InsightPayload = {
  headline: string;
  insights: string[];
  trend: string | null;
  recommendation: string | null;
};
