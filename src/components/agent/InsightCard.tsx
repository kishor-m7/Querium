import { Lightbulb, TrendingUp, Target } from "lucide-react";

export type InsightCardProps = {
  headline: string;
  insights: string[];
  trend: string | null;
  recommendation: string | null;
};

export function InsightCard({ headline, insights, trend, recommendation }: InsightCardProps) {
  return (
    <div className="panel border-primary/25 bg-gradient-to-br from-card to-surface p-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Lightbulb className="size-4" />
        </span>
        <div className="min-w-0 space-y-3">
          <h4 className="font-display text-base font-semibold leading-snug text-foreground">
            {headline}
          </h4>
          <ul className="space-y-1.5">
            {insights.map((insight, index) => (
              <li key={index} className="flex gap-2 text-sm text-muted-foreground">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" />
                <span className="text-foreground/90">{insight}</span>
              </li>
            ))}
          </ul>
          {trend && (
            <p className="flex items-start gap-2 rounded-lg bg-muted/60 px-3 py-2 text-sm text-foreground/90">
              <TrendingUp className="mt-0.5 size-4 shrink-0 text-success" />
              {trend}
            </p>
          )}
          {recommendation && (
            <p className="flex items-start gap-2 text-sm text-foreground/90">
              <Target className="mt-0.5 size-4 shrink-0 text-accent" />
              {recommendation}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
