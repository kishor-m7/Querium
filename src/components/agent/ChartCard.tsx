import { useMemo, useRef } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Download, ImageDown, Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tooltip as UiTooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { downloadCsv, downloadElementPng, formatCellValue, slugify } from "@/lib/export-utils";

export type ChartCardProps = {
  chartType: "bar" | "line" | "pie" | "scatter" | "area";
  title: string;
  xKey: string;
  series: Array<{ key: string; label: string }>;
  reason: string;
  rows: Array<Record<string, unknown>>;
  sql: string;
};

const PALETTE = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
  "var(--color-chart-6)",
];

const axisProps = {
  stroke: "var(--color-muted-foreground)",
  tick: { fontSize: 11, fill: "var(--color-muted-foreground)" },
  tickLine: false,
} as const;

const tooltipStyle = {
  contentStyle: {
    background: "var(--color-popover)",
    border: "1px solid var(--color-border)",
    borderRadius: 10,
    fontSize: 12,
    color: "var(--color-popover-foreground)",
  },
  labelStyle: { color: "var(--color-muted-foreground)" },
} as const;

export function ChartCard({ chartType, title, xKey, series, reason, rows, sql }: ChartCardProps) {
  const captureRef = useRef<HTMLDivElement>(null);

  const data = useMemo(
    () =>
      rows.map((row) => {
        const next: Record<string, unknown> = { ...row };
        for (const s of series) {
          const raw = row[s.key];
          next[s.key] = raw === null || raw === undefined ? null : Number(raw);
        }
        next[xKey] = row[xKey] === null || row[xKey] === undefined ? "—" : String(row[xKey]);
        return next;
      }),
    [rows, series, xKey],
  );

  const primary = series[0]?.key ?? "value";

  return (
    <div className="panel overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <h4 className="truncate text-sm font-semibold text-foreground">{title}</h4>
          <p className="mt-0.5 text-xs uppercase tracking-wider text-muted-foreground">
            {chartType} chart · {rows.length} points
          </p>
        </div>
        <div className="flex items-center gap-1">
          <UiTooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Why this chart type">
                <Info className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-xs">{reason}</TooltipContent>
          </UiTooltip>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Download chart as PNG"
            onClick={() => {
              if (captureRef.current)
                void downloadElementPng(captureRef.current, `${slugify(title)}.png`);
            }}
          >
            <ImageDown className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Download data as CSV"
            onClick={() => downloadCsv(rows, `${slugify(title)}.csv`)}
          >
            <Download className="size-4" />
          </Button>
        </div>
      </div>

      <div ref={captureRef} className="bg-card px-2 py-4">
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            {chartType === "bar" ? (
              <BarChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--color-border)"
                  vertical={false}
                />
                <XAxis dataKey={xKey} {...axisProps} interval="preserveStartEnd" />
                <YAxis {...axisProps} width={64} />
                <Tooltip {...tooltipStyle} />
                {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
                {series.map((s, index) => (
                  <Bar
                    key={s.key}
                    dataKey={s.key}
                    name={s.label}
                    fill={PALETTE[index % PALETTE.length]}
                    radius={[4, 4, 0, 0]}
                  />
                ))}
              </BarChart>
            ) : chartType === "line" ? (
              <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--color-border)"
                  vertical={false}
                />
                <XAxis dataKey={xKey} {...axisProps} interval="preserveStartEnd" />
                <YAxis {...axisProps} width={64} />
                <Tooltip {...tooltipStyle} />
                {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
                {series.map((s, index) => (
                  <Line
                    key={s.key}
                    type="monotone"
                    dataKey={s.key}
                    name={s.label}
                    stroke={PALETTE[index % PALETTE.length]}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                ))}
              </LineChart>
            ) : chartType === "area" ? (
              <AreaChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--color-border)"
                  vertical={false}
                />
                <XAxis dataKey={xKey} {...axisProps} interval="preserveStartEnd" />
                <YAxis {...axisProps} width={64} />
                <Tooltip {...tooltipStyle} />
                {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
                {series.map((s, index) => (
                  <Area
                    key={s.key}
                    type="monotone"
                    dataKey={s.key}
                    name={s.label}
                    stroke={PALETTE[index % PALETTE.length]}
                    fill={PALETTE[index % PALETTE.length]}
                    fillOpacity={0.18}
                    strokeWidth={2}
                  />
                ))}
              </AreaChart>
            ) : chartType === "pie" ? (
              <PieChart>
                <Tooltip {...tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Pie
                  data={data}
                  dataKey={primary}
                  nameKey={xKey}
                  innerRadius={54}
                  outerRadius={96}
                  paddingAngle={2}
                  stroke="var(--color-card)"
                >
                  {data.map((_, index) => (
                    <Cell key={index} fill={PALETTE[index % PALETTE.length]} />
                  ))}
                </Pie>
              </PieChart>
            ) : (
              <ScatterChart margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey={xKey} {...axisProps} name={xKey} />
                <YAxis dataKey={primary} {...axisProps} width={64} />
                <Tooltip {...tooltipStyle} />
                {series.map((s, index) => (
                  <Scatter
                    key={s.key}
                    data={data}
                    dataKey={s.key}
                    name={s.label}
                    fill={PALETTE[index % PALETTE.length]}
                  />
                ))}
              </ScatterChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      <details className="border-t border-border">
        <summary className="cursor-pointer px-4 py-2 text-xs text-muted-foreground hover:text-foreground">
          SQL behind this chart
        </summary>
        <pre className="overflow-x-auto bg-code px-4 py-3 text-xs text-code-foreground">{sql}</pre>
      </details>
      {rows.length > 0 && (
        <details className="border-t border-border">
          <summary className="cursor-pointer px-4 py-2 text-xs text-muted-foreground hover:text-foreground">
            First rows plotted
          </summary>
          <div className="max-h-56 overflow-auto px-4 pb-3 text-xs">
            <table className="w-full">
              <tbody>
                {rows.slice(0, 12).map((row, index) => (
                  <tr key={index} className="border-b border-border/60 last:border-0">
                    <td className="py-1 pr-4 text-muted-foreground">
                      {formatCellValue(row[xKey])}
                    </td>
                    {series.map((s) => (
                      <td key={s.key} className="py-1 pr-4 text-right font-mono">
                        {formatCellValue(row[s.key])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );
}
