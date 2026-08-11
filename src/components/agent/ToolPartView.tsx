import type { ToolUIPart } from "ai";
import { useMutation } from "@tanstack/react-query";
import { Pin } from "lucide-react";
import { toast } from "sonner";

import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";
import { ChartCard } from "@/components/agent/ChartCard";
import { DiagramCard } from "@/components/agent/DiagramCard";
import { InsightCard } from "@/components/agent/InsightCard";
import { QueryResultCard } from "@/components/agent/QueryResultCard";
import { SchemaCard } from "@/components/agent/SchemaCard";
import { Button } from "@/components/ui/button";
import { createDashboardTile } from "@/lib/workspace.functions";
import type { Json } from "@/integrations/supabase/types";
import type {
  ChartPayload,
  DiagramPayload,
  InsightPayload,
  QueryPayload,
  SchemaInfo,
} from "@/lib/agent/schema-types";

const TOOL_TITLES: Record<string, string> = {
  "tool-get_schema": "Inspecting the database schema",
  "tool-execute_query": "Running SQL",
  "tool-generate_chart": "Building a chart",
  "tool-generate_flowchart": "Drawing a diagram",
  "tool-explain_data": "Interpreting the numbers",
};

const PINNABLE: Record<string, "chart" | "table"> = {
  "tool-generate_chart": "chart",
  "tool-execute_query": "table",
};

/**
 * Renders an agent tool invocation: a collapsed activity row while it runs,
 * and a rich domain-specific card once the result arrives.
 */
export function ToolPartView({
  part,
  threadId,
  readOnly,
}: {
  part: ToolUIPart;
  threadId?: string;
  readOnly?: boolean;
}) {
  const title = TOOL_TITLES[part.type] ?? part.type.replace("tool-", "").replace(/_/g, " ");
  const done = part.state === "output-available";
  const output = part.output as Record<string, unknown> | undefined;
  const outputError =
    done && output && typeof output["error"] === "string" ? (output["error"] as string) : null;
  const pinKind = PINNABLE[part.type];

  const pin = useMutation({
    mutationFn: () =>
      createDashboardTile({
        data: {
          kind: pinKind ?? "table",
          title:
            (typeof output?.["title"] === "string" && output["title"]) ||
            (typeof output?.["purpose"] === "string" && output["purpose"]) ||
            title,
          payload: output as unknown as Json,
          ...(threadId ? { threadId } : {}),
        },
      }),
    onSuccess: () => toast.success("Pinned to your dashboard"),
    onError: (error: Error) => toast.error(error.message || "Could not pin this result"),
  });

  return (
    <div className="space-y-3">
      <Tool defaultOpen={false} className="mb-0 border-border bg-surface/60">
        <ToolHeader type={part.type} state={part.state} title={title} />
        <ToolContent>
          <ToolInput input={part.input} />
          {(part.state === "output-available" || part.state === "output-error") && (
            <ToolOutput output={part.output} errorText={part.errorText} />
          )}
        </ToolContent>
      </Tool>

      {done && !outputError && output && renderResult(part.type, output)}

      {done && !outputError && output && pinKind && !readOnly && (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            disabled={pin.isPending}
            onClick={() => pin.mutate()}
            className="text-xs text-muted-foreground"
          >
            <Pin className="mr-1.5 size-3.5" />
            Pin to dashboard
          </Button>
        </div>
      )}

      {outputError && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {outputError}
        </p>
      )}
    </div>
  );
}

function renderResult(type: string, output: Record<string, unknown>) {
  switch (type) {
    case "tool-get_schema":
      return <SchemaCard schema={output as unknown as SchemaInfo} />;
    case "tool-execute_query": {
      const payload = output as unknown as QueryPayload;
      return (
        <QueryResultCard
          purpose={payload.purpose}
          sql={payload.sql}
          columns={payload.columns ?? []}
          rows={payload.rows ?? []}
          rowCount={payload.rowCount ?? 0}
          durationMs={payload.durationMs ?? 0}
          truncated={Boolean(payload.truncated)}
        />
      );
    }
    case "tool-generate_chart": {
      const payload = output as unknown as ChartPayload;
      if (!payload.rows || payload.rows.length === 0) return null;
      return (
        <ChartCard
          chartType={payload.chartType}
          title={payload.title}
          xKey={payload.xKey}
          series={payload.series ?? []}
          reason={payload.reason}
          rows={payload.rows}
          sql={payload.sql}
        />
      );
    }
    case "tool-generate_flowchart": {
      const payload = output as unknown as DiagramPayload;
      if (!payload.mermaid) return null;
      return <DiagramCard kind={payload.kind} title={payload.title} mermaid={payload.mermaid} />;
    }
    case "tool-explain_data": {
      const payload = output as unknown as InsightPayload;
      return (
        <InsightCard
          headline={payload.headline}
          insights={payload.insights ?? []}
          trend={payload.trend ?? null}
          recommendation={payload.recommendation ?? null}
        />
      );
    }
    default:
      return null;
  }
}
