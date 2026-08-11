import { useRef, useState } from "react";
import { AlertTriangle, Database, Download, Table2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { downloadCsv, formatCellValue, slugify } from "@/lib/export-utils";

export type QueryResultCardProps = {
  purpose?: string | undefined;
  sql: string;
  columns: string[];
  rows: Array<Record<string, unknown>>;
  rowCount: number;
  durationMs: number;
  truncated: boolean;
  error?: string | undefined;
};

const PAGE = 20;

export function QueryResultCard({
  purpose,
  sql,
  columns,
  rows,
  rowCount,
  durationMs,
  truncated,
  error,
}: QueryResultCardProps) {
  const [visible, setVisible] = useState(PAGE);
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div className="panel overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex min-w-0 items-start gap-2">
          <Table2 className="mt-0.5 size-4 shrink-0 text-primary" />
          <div className="min-w-0">
            <h4 className="truncate text-sm font-semibold text-foreground">
              {purpose ?? "Query result"}
            </h4>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <Badge variant="secondary" className="font-mono text-[10px]">
                {rowCount.toLocaleString()} rows
              </Badge>
              <Badge variant="secondary" className="font-mono text-[10px]">
                {durationMs} ms
              </Badge>
              {truncated && (
                <Badge variant="outline" className="text-[10px]">
                  showing first {rows.length}
                </Badge>
              )}
            </div>
          </div>
        </div>
        {rows.length > 0 && (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Download result as CSV"
            onClick={() => downloadCsv(rows, `${slugify(purpose ?? "query-result")}.csv`)}
          >
            <Download className="size-4" />
          </Button>
        )}
      </div>

      <details open className="border-b border-border">
        <summary className="flex cursor-pointer items-center gap-2 px-4 py-2 text-xs text-muted-foreground hover:text-foreground">
          <Database className="size-3.5" /> SQL
        </summary>
        <pre className="overflow-x-auto bg-code px-4 py-3 text-xs leading-relaxed text-code-foreground">
          {sql}
        </pre>
      </details>

      {error ? (
        <p className="flex items-start gap-2 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {error}
        </p>
      ) : rows.length === 0 ? (
        <p className="px-4 py-4 text-sm text-muted-foreground">No rows matched this query.</p>
      ) : (
        <>
          <div ref={scrollRef} className="max-h-80 overflow-auto">
            <table className="w-full border-collapse text-xs">
              <thead className="sticky top-0 bg-surface-raised">
                <tr>
                  {columns.map((column) => (
                    <th
                      key={column}
                      className="whitespace-nowrap border-b border-border px-3 py-2 text-left font-medium uppercase tracking-wider text-muted-foreground"
                    >
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, visible).map((row, index) => (
                  <tr key={index} className="odd:bg-muted/30">
                    {columns.map((column) => (
                      <td
                        key={column}
                        className="whitespace-nowrap px-3 py-1.5 font-mono text-foreground/90"
                      >
                        {formatCellValue(row[column])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {visible < rows.length && (
            <div className="border-t border-border px-4 py-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() => setVisible((v) => v + PAGE)}
              >
                Show {Math.min(PAGE, rows.length - visible)} more rows
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
