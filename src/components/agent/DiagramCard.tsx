import { useEffect, useRef, useState } from "react";
import { ImageDown, Workflow } from "lucide-react";

import { Button } from "@/components/ui/button";
import { downloadBlob, downloadElementPng, slugify } from "@/lib/export-utils";

export type DiagramCardProps = {
  kind: "er_diagram" | "workflow" | "decision_tree";
  title: string;
  mermaid: string;
};

const KIND_LABEL: Record<DiagramCardProps["kind"], string> = {
  er_diagram: "ER diagram",
  workflow: "Process flow",
  decision_tree: "Decision tree",
};

let mermaidReady: Promise<typeof import("mermaid").default> | null = null;

async function loadMermaid() {
  if (!mermaidReady) {
    mermaidReady = import("mermaid").then((module) => {
      const mermaid = module.default;
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        theme: "dark",
        fontFamily: "DM Sans, sans-serif",
        themeVariables: {
          background: "transparent",
          primaryColor: "#1f2a37",
          primaryTextColor: "#e8f4f6",
          primaryBorderColor: "#4ecdd4",
          lineColor: "#8aa0b2",
          secondaryColor: "#243244",
          tertiaryColor: "#1b2431",
        },
      });
      return mermaid;
    });
  }
  return mermaidReady;
}

export function DiagramCard({ kind, title, mermaid }: DiagramCardProps) {
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const captureRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(`mmd-${Math.random().toString(36).slice(2, 10)}`);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const engine = await loadMermaid();
        const { svg: rendered } = await engine.render(idRef.current, mermaid);
        if (!cancelled) {
          setSvg(rendered);
          setError(null);
        }
      } catch (renderError) {
        if (!cancelled) {
          setError(renderError instanceof Error ? renderError.message : "Diagram failed to render");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mermaid]);

  return (
    <div className="panel overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <Workflow className="size-4 shrink-0 text-primary" />
          <div className="min-w-0">
            <h4 className="truncate text-sm font-semibold text-foreground">{title}</h4>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              {KIND_LABEL[kind]}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Download diagram as PNG"
            onClick={() => {
              if (captureRef.current)
                void downloadElementPng(captureRef.current, `${slugify(title)}.png`);
            }}
          >
            <ImageDown className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs"
            onClick={() => downloadBlob(mermaid, `${slugify(title)}.mmd`, "text/plain")}
          >
            .mmd
          </Button>
        </div>
      </div>

      <div ref={captureRef} className="overflow-auto bg-card p-4">
        {error ? (
          <p className="text-xs text-destructive">Could not render this diagram: {error}</p>
        ) : svg ? (
          // Mermaid output is rendered with securityLevel "strict", which strips scripts.
          <div
            className="[&_svg]:mx-auto [&_svg]:h-auto [&_svg]:max-w-full"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        ) : (
          <div className="h-32 animate-pulse rounded-lg bg-muted" />
        )}
      </div>

      <details className="border-t border-border">
        <summary className="cursor-pointer px-4 py-2 text-xs text-muted-foreground hover:text-foreground">
          Mermaid source
        </summary>
        <pre className="overflow-x-auto bg-code px-4 py-3 text-xs text-code-foreground">
          {mermaid}
        </pre>
      </details>
    </div>
  );
}
