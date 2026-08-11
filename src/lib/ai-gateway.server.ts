import { createOpenAI } from "@ai-sdk/openai";

const RUN_ID_HEADER = "X-Lovable-AIG-Run-ID";

/**
 * Wraps fetch so the gateway-minted run id is captured from the first response
 * and resent on every subsequent request inside the same agent run.
 */
export function createRunIdFetch(initialRunId?: string) {
  let runId = initialRunId;

  const wrapped: typeof fetch = async (input, init) => {
    const headers = new Headers(init?.headers);
    if (runId) headers.set(RUN_ID_HEADER, runId);
    const response = await fetch(input, { ...init, headers });
    const returned = response.headers.get(RUN_ID_HEADER);
    if (returned) runId = returned;
    return response;
  };

  return {
    fetch: wrapped,
    get runId() {
      return runId;
    },
  };
}

export function getRunIdFromRequest(request: Request): string | undefined {
  return request.headers.get(RUN_ID_HEADER) ?? undefined;
}

/**
 * Lovable AI Gateway provider for OpenAI models over the Responses API.
 * Server-only: never construct this in browser code.
 */
export function createGateway(apiKey: string, runIdFetch: ReturnType<typeof createRunIdFetch>) {
  return createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: {
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
    fetch: runIdFetch.fetch,
  });
}

export const AGENT_MODEL = "openai/gpt-5.6-sol";
