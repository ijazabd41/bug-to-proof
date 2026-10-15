import { generateAnswer, ragConfig } from "../ai/providers";
import { callLLMWithDiagnostics } from "../llm/client";
import type { GenerationContext, GenerationResult } from "./reproductionService";

export const REPRODUCTION_SYSTEM_POLICY = "Generate only one strict JSON ReproductionDefinitionV1 object. Never emit code, markdown, selectors, URLs, imports, shell commands, or commentary.";
export const REPRODUCTION_MAX_OUTPUT_TOKENS = 2_048;

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
  return `${REPRODUCTION_SYSTEM_POLICY}\nSchema version: 1.0. Use exactly the required keys and one allowed shape for each array item. The assertion must be exactly one object, never an array. JSON string placeholders below describe value types; replace them with values. Prefer clickTarget, fillTarget, and target assertions whenever an exact allowed.targets testId exists. Use only supplied routes, exact accessible roles/names, exact target testIds, and product IDs. Never invent headings, controls, target IDs, expected values, or extra steps. Do not combine seedCart for a product with click/clickTarget add actions for the same setup. Do not add wait steps unless the report explicitly requires waiting; the assertion already locates its target. For navigation, prefer clickTarget with an allowed navigation testId and urlPathEquals. The assertion expected value must come from report.expected, not report.actual. Map the assertion to report facts.\nSCHEMA_GUIDANCE:\n${JSON.stringify(REPRODUCTION_SCHEMA_GUIDANCE)}\nINPUT_JSON:\n${JSON.stringify(safeContext)}`;
}

export async function generateReproductionCandidate(context: GenerationContext, abortSignal?: AbortSignal): Promise<GenerationResult> {
  const config = ragConfig();
  if (config.generationProvider === "disabled") throw new Error("Reproduction generation provider is disabled");
  const prompt = buildReproductionPrompt(context);
  if (config.generationProvider === "legacy") {
    const response = await callLLMWithDiagnostics(prompt, config.timeoutMs, abortSignal, REPRODUCTION_MAX_OUTPUT_TOKENS);
    if (!response.content && !response.responseShape.startsWith("choices_array") && response.responseShape !== "response_not_object") {
      throw new Error(`Reproduction generation provider request failed (${response.responseShape})`);
    }
    return { raw: response.content, responseShape: response.responseShape, provider: config.generationProvider, model: config.generationModel || "legacy" };
  }
  const raw = await generateAnswer(prompt, config, abortSignal);
  return { raw, responseShape: raw.trim() ? "message_content_string_nonempty" : "message_content_absent_empty_or_unsupported", provider: config.generationProvider, model: config.generationModel || "legacy" };
}
