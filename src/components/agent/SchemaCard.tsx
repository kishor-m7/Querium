import { Database, KeyRound } from "lucide-react";

import type { SchemaInfo } from "@/lib/agent/schema-types";

export function SchemaCard({ schema }: { schema: SchemaInfo }) {
  return (
    <div className="panel overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Database className="size-4 text-primary" />
        <h4 className="text-sm font-semibold text-foreground">
          Schema · {schema.tables?.length ?? 0} tables
        </h4>
      </div>
      <div className="grid gap-3 p-4 sm:grid-cols-2">
        {(schema.tables ?? []).map((table) => (
          <div key={table.table} className="rounded-lg border border-border bg-surface p-3">
            <p className="font-mono text-xs font-semibold text-primary">{table.table}</p>
            <ul className="mt-2 space-y-0.5">
              {table.columns.map((column) => (
                <li key={column.name} className="flex items-baseline justify-between gap-3 text-xs">
                  <span className="font-mono text-foreground/90">{column.name}</span>
                  <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
                    {column.type}
                    {column.nullable ? "" : " ·　not null"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {(schema.relationships?.length ?? 0) > 0 && (
        <div className="border-t border-border px-4 py-3">
          <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <KeyRound className="size-3.5" /> Relationships
          </p>
          <ul className="mt-2 space-y-1">
            {schema.relationships.map((relation, index) => (
              <li key={index} className="font-mono text-xs text-foreground/80">
                {relation.from_table}.{relation.from_column} → {relation.to_table}.
                {relation.to_column}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
