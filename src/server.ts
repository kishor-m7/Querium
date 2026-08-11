import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response, isApiRoute: boolean): Promise<Response> {
  if (response.status < 400) return response;

  const contentType = response.headers.get("content-type") ?? "";
  const body = await response.clone().text();

  if (isApiRoute) {
    if (contentType.includes("text/html") || body.trim().startsWith("<!doctype") || body.trim().startsWith("<html")) {
      const capturedErr = consumeLastCapturedError();
      console.error("[API Error Intercepted]", capturedErr ?? new Error(`API returned HTML: ${body.slice(0, 200)}`));
      return new Response(
        JSON.stringify({
          error: true,
          message: (capturedErr as Error | undefined)?.message || "Internal server error in API route",
        }),
        {
          status: response.status >= 400 ? response.status : 500,
          headers: { "content-type": "application/json" },
        },
      );
    }

    if (response.status >= 500 && isH3SwallowedErrorBody(body)) {
      const capturedErr = consumeLastCapturedError();
      console.error("[API Swallowed Error Intercepted]", capturedErr ?? new Error(`h3 swallowed API error: ${body}`));
      return new Response(
        JSON.stringify({
          error: true,
          message: (capturedErr as Error | undefined)?.message || "Internal server error in API route",
        }),
        {
          status: 500,
          headers: { "content-type": "application/json" },
        },
      );
    }
    return response;
  }

  if (!contentType.includes("application/json")) return response;
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    const url = new URL(request.url);
    const isApiRoute = url.pathname.startsWith("/api/");
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response, isApiRoute);
    } catch (error) {
      console.error("[Server Catastrophic Error]", error);
      if (isApiRoute) {
        return new Response(
          JSON.stringify({
            error: true,
            message: error instanceof Error ? error.message : "Internal server error",
          }),
          {
            status: 500,
            headers: { "content-type": "application/json" },
          },
        );
      }
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};

