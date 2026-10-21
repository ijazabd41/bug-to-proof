/**
 * LLM client for OpenAI-compatible and local Ollama chat completions.
 *
 * All calls are:
 * - Legacy calls gated by LLM_ENABLED; explicit reproduction endpoints use their own configuration.
 * - Wrapped in one overall timeout (default 10s) across bounded transport retries.
 * - Cancellable via AbortSignal
 * - Non-throwing: returns bounded diagnostic shape metadata without provider bodies.
 */

/**
 * Call the configured LLM with a prompt string.
 * Returns empty string if LLM is disabled, key is missing, call fails, or is aborted.
 */
export interface LLMCallResult { content: string; responseShape: string; requestAttempts?: number; httpStatus?: number }
export interface ChatEndpointConfig { apiUrl: string; apiKey?: string; model: string; protocol: "openai" | "ollama" }

export const MAX_REQUEST_ATTEMPTS = 3;
const isRetryableStatus = (status: number) => status === 429 || (status >= 500 && status <= 599);
function retryDelayMs(response: Response | undefined, attempt: number): number {
  const header = response?.headers?.get("retry-after");
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1_000, 2_147_483_647);
    const date = Date.parse(header);
    if (Number.isFinite(date)) return Math.min(Math.max(date - Date.now(), 0), 2_147_483_647);
  }
  return Math.min(200 * 2 ** (attempt - 1) + Math.floor(Math.random() * 100), 1_000);
}
async function abortableDelay(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) throw new DOMException("Request cancelled", "AbortError");
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => { signal.removeEventListener("abort", onAbort); resolve(); }, ms);
    const onAbort = () => { clearTimeout(timer); reject(new DOMException("Request cancelled", "AbortError")); };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

function classifySuccessfulResponse(data: unknown): LLMCallResult {
  if (!data || typeof data !== "object" || Array.isArray(data)) return { content: "", responseShape: "response_not_object" };
  const choices = (data as { choices?: unknown }).choices;
  if (!Array.isArray(choices)) return { content: "", responseShape: "choices_missing_or_not_array" };
  if (choices.length === 0) return { content: "", responseShape: "choices_array:empty" };
  const first = choices[0];
  if (!first || typeof first !== "object" || Array.isArray(first)) return { content: "", responseShape: "choices_array:first_choice_not_object" };
  const message = (first as { message?: unknown }).message;
  if (!message || typeof message !== "object" || Array.isArray(message)) return { content: "", responseShape: "choices_array:first_choice_object:message_missing_or_not_object" };
  const content = (message as { content?: unknown }).content;
  if (content === undefined || content === null) return { content: "", responseShape: "choices_array:first_choice_object:message_object:content_missing" };
  if (typeof content !== "string") return { content: "", responseShape: "choices_array:first_choice_object:message_object:content_not_string" };
  const trimmed = content.trim();
  return { content: trimmed, responseShape: trimmed ? "choices_array:first_choice_object:message_object:content_string_nonempty" : "choices_array:first_choice_object:message_object:content_string_empty" };
}

function classifyOllamaResponse(data: unknown): LLMCallResult {
  if (!data || typeof data !== "object" || Array.isArray(data)) return { content: "", responseShape: "response_not_object" };
  const message = (data as { message?: unknown }).message;
  if (!message || typeof message !== "object" || Array.isArray(message)) return { content: "", responseShape: "message_missing_or_not_object" };
  const content = (message as { content?: unknown }).content;
  if (typeof content !== "string") return { content: "", responseShape: "message_content_missing_or_not_string" };
  const trimmed = content.trim();
  return { content: trimmed, responseShape: trimmed ? "message_content_string_nonempty" : "message_content_string_empty" };
}

export async function callLLMWithDiagnostics(
  prompt: string,
  timeoutMs = 10_000,
  abortSignal?: AbortSignal,
  maxOutputTokens?: number,
  endpoint?: ChatEndpointConfig,
): Promise<LLMCallResult> {
  const enabled = endpoint ? true : process.env.LLM_ENABLED === "true";
  const apiUrl = endpoint?.apiUrl ?? process.env.LLM_API_URL ?? "https://api.openai.com/v1";
  const apiKey = endpoint?.apiKey ?? process.env.LLM_API_KEY ?? "";
  const model = endpoint?.model ?? process.env.LLM_MODEL ?? "gpt-4o-mini";
  const protocol = endpoint?.protocol ?? "openai";

  if (!enabled || (protocol === "openai" && !apiKey) || !model) {
    console.warn("[llm] LLM disabled or API key not set — skipping call.");
    return { content: "", responseShape: "request_not_sent:disabled_or_missing_key" };
  }

  if (abortSignal?.aborted) {
    return { content: "", responseShape: "request_not_sent:already_aborted" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let abortListener: (() => void) | undefined;
  if (abortSignal) {
    abortListener = () => controller.abort();
    abortSignal.addEventListener("abort", abortListener, { once: true });
  }

  let requestAttempts = 0;
  try {
    for (let attempt = 1; attempt <= MAX_REQUEST_ATTEMPTS; attempt++) {
      if (controller.signal.aborted) return { content: "", responseShape: abortSignal?.aborted ? "request_cancelled" : "request_timed_out", requestAttempts };
      requestAttempts = attempt;
      let response: Response;
      try {
        response = await fetch(`${apiUrl.replace(/\/$/, "")}${protocol === "ollama" ? "/api/chat" : "/chat/completions"}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(protocol === "openai" ? { Authorization: `Bearer ${apiKey}` } : {}) },
          body: JSON.stringify(protocol === "ollama"
            ? { model, messages: [{ role: "user", content: prompt }], stream: false, options: { temperature: 0, ...(maxOutputTokens === undefined ? {} : { num_predict: maxOutputTokens }) } }
            : { model, messages: [{ role: "user", content: prompt }], temperature: endpoint ? 0 : 0.3, ...(maxOutputTokens === undefined ? {} : { max_tokens: maxOutputTokens }) }),
          signal: controller.signal,
        });
      } catch (error) {
        if (controller.signal.aborted || (error instanceof Error && error.name === "AbortError")) throw error;
        if (attempt < MAX_REQUEST_ATTEMPTS) { await abortableDelay(retryDelayMs(undefined, attempt), controller.signal); continue; }
        return { content: "", responseShape: "request_failed", requestAttempts };
      }

      if (!response.ok) {
        if (isRetryableStatus(response.status) && attempt < MAX_REQUEST_ATTEMPTS) {
          await abortableDelay(retryDelayMs(response, attempt), controller.signal);
          continue;
        }
        return { content: "", responseShape: `http_error:${response.status}`, httpStatus: response.status, requestAttempts };
      }

      let body: unknown;
      try { body = await response.json(); }
      catch { return { content: "", responseShape: "response_json_invalid", requestAttempts }; }
      const result = protocol === "ollama" ? classifyOllamaResponse(body) : classifySuccessfulResponse(body);
      return attempt === 1 ? result : { ...result, requestAttempts };
    }
    return { content: "", responseShape: "request_failed", requestAttempts };
  } catch (err: unknown) {
    return { content: "", responseShape: controller.signal.aborted ? abortSignal?.aborted ? "request_cancelled" : "request_timed_out" : err instanceof Error && err.name === "AbortError" ? "request_aborted_or_timed_out" : "request_failed", requestAttempts };
  } finally {
    clearTimeout(timer);
    if (abortSignal && abortListener) {
      abortSignal.removeEventListener("abort", abortListener);
    }
  }
}

export async function callLLM(prompt: string, timeoutMs = 10_000, abortSignal?: AbortSignal): Promise<string> {
  return (await callLLMWithDiagnostics(prompt, timeoutMs, abortSignal)).content;
}
