import { createFileRoute, Link } from "@tanstack/react-router";
import { BarChart3, Database, Network, Sparkle, Terminal } from "lucide-react";

import { Button } from "@/components/ui/button";
import queriumMark from "@/assets/querium-mark.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Querium — Talk to your database" },
      {
        name: "description",
        content:
          "Querium is an LLM agent that inspects your schema, writes read-only SQL, charts the results and explains what they mean — with every step visible.",
      },
      { property: "og:title", content: "Querium — Talk to your database" },
      {
        property: "og:description",
        content:
          "An LLM agent that inspects your schema, writes SQL, charts results and explains the numbers.",
      },
    ],
  }),
  component: Landing,
});

const CAPABILITIES = [
  {
    icon: Database,
    title: "Schema aware",
    body: "The agent inspects tables, types and foreign keys before it writes a single line of SQL.",
  },
  {
    icon: Terminal,
    title: "Transparent SQL",
    body: "Every query is shown with its runtime and row count. Read-only by construction.",
  },
  {
    icon: BarChart3,
    title: "Charts that fit",
    body: "Bar, line, area, pie or scatter — chosen deliberately, with the reasoning attached.",
  },
  {
    icon: Network,
    title: "Diagrams on demand",
    body: "Mermaid ER diagrams, process flows and decision trees rendered inline.",
  },
];

function Landing() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="grid-backdrop pointer-events-none absolute inset-0 opacity-40" aria-hidden />
      <div
        className="pointer-events-none absolute -top-40 left-1/2 size-[36rem] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl"
        aria-hidden
      />

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2.5">
          <img src={queriumMark} alt="" width={36} height={36} className="size-9" />
          <span className="font-display text-lg font-semibold text-foreground">Querium</span>
        </div>
        <Button asChild variant="ghost">
          <Link to="/auth">Sign in</Link>
        </Button>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-6xl px-6">
        <section className="py-16 text-center sm:py-24">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
            <Sparkle className="size-3.5 text-accent" />
            LLM agent · tool calling · live database
          </span>
          <h1 className="mx-auto mt-6 max-w-3xl text-balance text-4xl font-semibold leading-[1.08] sm:text-6xl">
            Ask your database <span className="text-gradient">anything</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-pretty text-base text-muted-foreground sm:text-lg">
            Querium plans the analysis, runs read-only SQL, plots the result, diagrams the schema
            and tells you what the numbers actually mean.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" className="shadow-[var(--shadow-glow)]">
              <Link to="/auth">Start analysing</Link>
            </Button>
            <span className="text-xs text-muted-foreground">
              Includes a seeded sales database · 3,200 orders
            </span>
          </div>
        </section>

        <section className="grid gap-4 pb-16 sm:grid-cols-2 lg:grid-cols-4">
          {CAPABILITIES.map((capability) => (
            <article key={capability.title} className="panel p-5">
              <capability.icon className="size-5 text-primary" />
              <h2 className="mt-3 font-display text-base font-semibold text-foreground">
                {capability.title}
              </h2>
              <p className="mt-1.5 text-sm text-muted-foreground">{capability.body}</p>
            </article>
          ))}
        </section>

        <section className="panel mb-20 overflow-hidden">
          <div className="border-b border-border px-5 py-3 text-xs uppercase tracking-wider text-muted-foreground">
            A typical turn
          </div>
          <ol className="divide-y divide-border text-sm">
            {[
              ["get_schema", "reads 4 tables and their relationships"],
              ["execute_query", "monthly revenue via date_trunc, 12 rows in 38 ms"],
              ["generate_chart", "line chart — revenue is a continuous time series"],
              ["explain_data", "Q4 peaks 34% above the yearly mean"],
            ].map(([tool, detail]) => (
              <li key={tool} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-5 py-3">
                <code className="rounded bg-code px-2 py-0.5 text-xs text-primary">{tool}</code>
                <span className="text-muted-foreground">{detail}</span>
              </li>
            ))}
          </ol>
        </section>
      </main>
    </div>
  );
}
