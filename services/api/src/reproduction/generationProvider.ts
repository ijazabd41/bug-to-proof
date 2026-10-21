import { ragConfig } from "../ai/providers";
import { callLLMWithDiagnostics, type LLMCallResult } from "../llm/client";
import type { GenerationContext, GenerationResult } from "./reproductionService";

export const REPRODUCTION_SYSTEM_POLICY = "Generate only one strict JSON ReproductionDefinitionV1 object. Never emit code, markdown, selectors, URLs, imports, shell commands, or commentary.";
export const REPRODUCTION_MAX_OUTPUT_TOKENS = 2_048;

export class GenerationProviderError extends Error {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly model: string,
    public readonly responseShape: string,
    public readonly requestAttempts: number,
    public readonly httpStatus?: number,
  ) { super(message); this.name = "GenerationProviderError"; }
}

export async function preflightReproductionProvider(): Promise<{ ready: boolean; provider: string; model: string; code: string; httpStatus?: number }> {
  const config = ragConfig();
  const provider = config.generationProvider;
  const model = config.generationModel || (provider === "legacy" ? process.env.LLM_MODEL || "" : "");
  if (provider === "disabled") return { ready: false, provider, model, code: "PROVIDER_DISABLED" };
  const key = provider === "legacy" ? process.env.LLM_API_KEY : process.env.RAG_GENERATION_API_KEY || process.env.LLM_API_KEY || process.env.OPENAI_API_KEY;
  if (provider !== "ollama" && (!key || (provider === "legacy" && process.env.LLM_ENABLED !== "true"))) return { ready: false, provider, model, code: "CREDENTIALS_MISSING" };
  if (!model) return { ready: false, provider, model, code: "MODEL_MISSING" };
  const base = (provider === "legacy" ? process.env.LLM_API_URL || "https://api.openai.com/v1" : config.generationBaseUrl).replace(/\/$/, "");
  try {
    const response = await fetch(`${base}${provider === "ollama" ? "/api/tags" : "/models"}`, {
      headers: provider === "ollama" ? undefined : { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return { ready: false, provider, model, code: `HTTP_${response.status}`, httpStatus: response.status };
    if (provider === "ollama") {
      const body = await response.json() as { models?: Array<{ name?: string; model?: string }> };
      const found = body.models?.some(item => item.name === model || item.model === model || item.name?.split(":")[0] === model);
      if (!found) return { ready: false, provider, model, code: "MODEL_NOT_INSTALLED" };
    }
    return { ready: true, provider, model, code: provider === "ollama" ? "READY" : "ENDPOINT_REACHABLE_MODEL_UNVERIFIED" };
  } catch {
    return { ready: false, provider, model, code: "CONNECTION_FAILED_OR_TIMED_OUT" };
  }
}

function providerFailureMessage(responseShape: string): string {
  if (responseShape === "request_failed") return "Provider connection failed before an HTTP response (request_failed)";
  if (responseShape === "request_aborted_or_timed_out") return "Provider request timed out or was cancelled (request_aborted_or_timed_out)";
  if (responseShape === "request_timed_out") return "Provider request timed out (request_timed_out)";
  if (responseShape === "request_cancelled") return "Provider request was cancelled (request_cancelled)";
  if (responseShape.startsWith("http_error:")) return `Provider returned HTTP ${responseShape.slice("http_error:".length)} (${responseShape})`;
  if (responseShape === "request_not_sent:disabled_or_missing_key") return "Provider request was not sent because generation is disabled or its key is missing";
  return `Provider request failed (${responseShape})`;
}

const REPRODUCTION_SCHEMA_GUIDANCE = Object.freeze({
  requiredKeys: ["schemaVersion", "title", "startPath", "preconditions", "steps", "assertion", "rationale", "reportMapping"],
  preconditions: [
    { type: "clearLocalStorage" },
    { type: "seedCart", productId: "number from allowed.products", quantity: "positive integer" },
  ],
  actions: [
    { type: "goto", path: "allowed route" },
    { type: "click", role: "allowed control role", name: "exact allowed control name", within: { kind: "product", productId: "required only when supplied inventory context disambiguates a repeated product control" } },
    { type: "fill", label: "exact allowed textbox name", text: "bounded text" },
    { type: "selectOption", label: "exact allowed combobox name", value: "bounded value" },
    { type: "waitForVisible", role: "allowed control or heading role", name: "exact allowed name", within: { kind: "product", productId: "optional discovered product context" } },
    { type: "clickTarget", testId: "exact testId from allowed.targets" },
    { type: "fillTarget", testId: "exact testId from allowed.targets", text: "bounded text" },
    { type: "waitForTargetVisible", testId: "exact testId from allowed.targets" },
    { type: "reload" },
  ],
  assertions: [
    { type: "visibleTextEquals", role: "allowed role", name: "exact allowed name", expected: "text" },
    { type: "numberEquals", role: "allowed role", name: "exact allowed name", expected: "number" },
    { type: "currencyEquals", role: "allowed role", name: "exact allowed name", expected: "number", currency: "USD" },
    { type: "countEquals", role: "allowed role", name: "optional exact allowed name", expected: "non-negative integer" },
    { type: "urlPathEquals", expected: "allowed route" },
    { type: "visibilityEquals", role: "allowed role", name: "exact allowed name", visible: "boolean" },
    { type: "accessibleAttributeEquals", role: "allowed role", name: "exact allowed name", attribute: "aria-*", expected: "text" },
    { type: "targetTextEquals", testId: "exact testId from allowed.targets", expected: "text" },
    { type: "targetNumberEquals", testId: "exact testId from allowed.targets", expected: "number" },
    { type: "targetCurrencyEquals", testId: "exact testId from allowed.targets", expected: "number", currency: "USD" },
    { type: "targetCurrencySumEquals", testId: "result testId from allowed.targets", terms: ["two or more operand testIds from allowed.targets"], currency: "USD" },
    { type: "targetVisibilityEquals", testId: "exact testId from allowed.targets", visible: "boolean" },
  ],
  reportMappingItem: { reportFact: "verbatim report fact", definitionPath: "path such as assertion.expected" },
});

export function buildReproductionPrompt(context: GenerationContext): string {
  const safeContext = {
    promptVersion: context.promptVersion,
    report: context.report,
    allowed: {
      routes: context.discovery.routes,
      controls: context.discovery.controls.map(({ role, name, context }) => ({ role, name, ...(context ? { context } : {}) })),
      headings: context.discovery.headings.map(({ level, text }) => ({ level, text })),
      targets: (context.discovery.targets ?? []).map(({ testId, context }) => ({ testId, ...(context ? { context } : {}) })),
      products: context.discovery.fixtures.products,
    },
    attempt: context.attempt,
    previousDiagnostics: context.previousDiagnostics.map(value => value.slice(0, 2_000)),
  };
  return `${REPRODUCTION_SYSTEM_POLICY}\nSchema version: 1.0. Use exactly the required keys and one allowed shape for each array item. The assertion must be exactly one object, never an array. JSON string placeholders below describe value types; replace them with values. Prefer clickTarget, fillTarget, and target assertions whenever an exact allowed.targets testId exists. Use only supplied routes, exact accessible roles/names, exact target testIds, and product IDs. Never invent headings, controls, target IDs, expected values, or extra steps. Do not combine seedCart for a product with click/clickTarget add actions for the same setup. Hard navigation after an interactive state change can discard the in-memory cart; click a discovered link to navigate instead of using goto or reload. For navigation assertions, prefer clickTarget with an allowed navigation testId and urlPathEquals. Use targetVisibilityEquals for existence; targetTextEquals requires the entire target text to equal the expected string. Do not assert a validation message by reading a textbox's text content; use the discovered status or message target. If the report says to wait for validation or other asynchronous behavior, wait for the reported result after asynchronous actions before asserting it. The assertion expected value must come from report.expected, not report.actual. When report.expected is a relational currency expectation such as total equals subtotal plus shipping, use targetCurrencySumEquals with discovered result and term testIds; never copy that prose into targetTextEquals.expected. Map the assertion to report facts.\nSCHEMA_GUIDANCE:\n${JSON.stringify(REPRODUCTION_SCHEMA_GUIDANCE)}\nINPUT_JSON:\n${JSON.stringify(safeContext)}`;
}

export async function generateReproductionCandidate(context: GenerationContext, abortSignal?: AbortSignal): Promise<GenerationResult> {
  const config = ragConfig();
  if (config.generationProvider === "disabled") throw new GenerationProviderError("Reproduction generation provider is disabled", "disabled", "", "request_not_sent:disabled", 0);
  const prompt = buildReproductionPrompt(context);
  let response: LLMCallResult;
  if (config.generationProvider === "legacy") {
    response = await callLLMWithDiagnostics(prompt, config.timeoutMs, abortSignal, REPRODUCTION_MAX_OUTPUT_TOKENS);
  } else {
    if (!config.generationModel) throw new GenerationProviderError("Set RAG_GENERATION_MODEL", config.generationProvider, "", "request_not_sent:model_missing", 0);
    const apiKey = config.generationProvider === "openai" ? process.env.RAG_GENERATION_API_KEY || process.env.LLM_API_KEY || process.env.OPENAI_API_KEY : undefined;
    response = await callLLMWithDiagnostics(prompt, config.timeoutMs, abortSignal, REPRODUCTION_MAX_OUTPUT_TOKENS,
      { apiUrl: config.generationBaseUrl, apiKey, model: config.generationModel, protocol: config.generationProvider });
  }
  if (!response.content && (response.responseShape.startsWith("request_") || response.responseShape.startsWith("http_error:"))) {
    throw new GenerationProviderError(providerFailureMessage(response.responseShape), config.generationProvider,
      config.generationModel || "legacy", response.responseShape, response.requestAttempts ?? 1, response.httpStatus);
  }
  return { raw: response.content, responseShape: response.responseShape, provider: config.generationProvider,
    model: config.generationModel || "legacy", requestAttempts: response.requestAttempts ?? 1 };
}
