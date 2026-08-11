import { createOpenAI } from "@ai-sdk/openai";
import { createGateway, createRunIdFetch } from "./ai-gateway.server";
import type { LanguageModel } from "ai";

export type LLMProviderConfig = {
  model: LanguageModel;
  providerName: string;
  modelName: string;
};

/**
 * Server-only LLM Provider abstraction.
 * Resolves the configured LLM model based on environment variables.
 * 
 * Config precedence:
 * 1. Standard OpenAI-compatible API: LLM_API_KEY (with optional LLM_BASE_URL and LLM_MODEL)
 * 2. Lovable AI Gateway: LOVABLE_API_KEY (with optional LLM_MODEL)
 */
export function getLLMModel(runIdFetch?: ReturnType<typeof createRunIdFetch>): LLMProviderConfig {
  const llmApiKey = process.env["LLM_API_KEY"];
  const llmBaseUrl = process.env["LLM_BASE_URL"];
  const llmModel = process.env["LLM_MODEL"];
  const lovableApiKey = process.env["LOVABLE_API_KEY"];

  if (llmApiKey) {
    const openai = createOpenAI({
      apiKey: llmApiKey,
      ...(llmBaseUrl ? { baseURL: llmBaseUrl } : {}),
      ...(runIdFetch ? { fetch: runIdFetch.fetch } : {}),
    });
    const modelName = llmModel || "gpt-4o";
    return {
      model: openai(modelName),
      providerName: "openai-compatible",
      modelName,
    };
  }

  if (lovableApiKey) {
    const fetcher = runIdFetch || createRunIdFetch();
    const gateway = createGateway(lovableApiKey, fetcher);
    const modelName = llmModel || "openai/gpt-5.6-sol";
    return {
      model: gateway.responses(modelName),
      providerName: "lovable-gateway",
      modelName,
    };
  }

  throw new Error(
    "No LLM configuration found. Please set LLM_API_KEY (or LOVABLE_API_KEY) in server environment variables."
  );
}
