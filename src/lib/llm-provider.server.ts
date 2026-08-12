import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
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
 * 1. Google Gemini: GEMINI_API_KEY (with optional GEMINI_BASE_URL and GEMINI_MODEL)
 * 2. Standard OpenAI-compatible API: LLM_API_KEY (with optional LLM_BASE_URL and LLM_MODEL)
 * 3. Lovable AI Gateway: LOVABLE_API_KEY (with optional LLM_MODEL)
 */
export function getLLMModel(runIdFetch?: ReturnType<typeof createRunIdFetch>): LLMProviderConfig {
  const llmApiKey = process.env["LLM_API_KEY"] || process.env["XAI_API_KEY"];
  const llmBaseUrl = process.env["LLM_BASE_URL"] || process.env["XAI_BASE_URL"] || "https://api.x.ai/v1";
  const llmModel = process.env["LLM_MODEL"] || process.env["XAI_MODEL"] || "grok-4-1-fast-reasoning";
  const geminiApiKey = process.env["GEMINI_API_KEY"];
  const geminiBaseUrl = process.env["GEMINI_BASE_URL"];
  const geminiModel = process.env["GEMINI_MODEL"];
  const lovableApiKey = process.env["LOVABLE_API_KEY"];

  if (geminiApiKey) {
    // Only pass custom baseURL if it points to a proxy/custom host, not the standard Google API host.
    const isStandardHost = !geminiBaseUrl || geminiBaseUrl.includes("generativelanguage.googleapis.com");
    const google = createGoogleGenerativeAI({
      apiKey: geminiApiKey,
      ...(!isStandardHost ? { baseURL: geminiBaseUrl } : {}),
      ...(runIdFetch ? { fetch: runIdFetch.fetch } : {}),
    });
    const modelName = geminiModel || "gemini-2.5-flash";
    return {
      model: google(modelName),
      providerName: "google-gemini",
      modelName,
    };
  }

  if (llmApiKey) {
    const openai = createOpenAI({
      apiKey: llmApiKey,
      ...(llmBaseUrl ? { baseURL: llmBaseUrl } : {}),
      ...(runIdFetch ? { fetch: runIdFetch.fetch } : {}),
    });
    const modelName = llmModel;
    return {
      model: openai(modelName),
      providerName: "xai-grok",
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
    "No LLM configuration found. Please set LLM_API_KEY (for Grok/xAI) or GEMINI_API_KEY in server environment variables."
  );
}
