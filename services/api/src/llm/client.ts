/**
 * LLM Client — OpenAI-compatible chat completions
 *
 * All calls are:
 * - Gated by LLM_ENABLED env var
 * - Wrapped in a timeout (default 10s)
 * - Cancellable via AbortSignal
 * - Non-throwing: always returns a string (empty on failure)
 */

/**
 * Call the configured LLM with a prompt string.
 * Returns empty string if LLM is disabled, key is missing, call fails, or is aborted.
 */
export interface LLMCallResult { content: string; responseShape: string }

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

export async function callLLMWithDiagnostics(
  prompt: string,
  timeoutMs = 10_000,
  abortSignal?: AbortSignal,
  maxOutputTokens?: number,
): Promise<LLMCallResult> {
  const enabled = process.env.LLM_ENABLED === "true";
  const apiUrl = process.env.LLM_API_URL ?? "https://api.openai.com/v1";
  const apiKey = process.env.LLM_API_KEY ?? "";
  const model = process.env.LLM_MODEL ?? "gpt-4o-mini";

  if (!enabled || !apiKey) {
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

  try {
    const response = await fetch(`${apiUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        ...(maxOutputTokens === undefined ? {} : { max_tokens: maxOutputTokens }),
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      console.warn(`[llm] Non-2xx response: ${response.status}`);
      return { content: "", responseShape: `http_error:${response.status}` };
    }

    return classifySuccessfulResponse(await response.json());
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      console.warn("[llm] Request timed out or cancelled.");
    } else {
      console.warn("[llm] Request failed:", err);
    }
    return { content: "", responseShape: err instanceof Error && err.name === "AbortError" ? "request_aborted_or_timed_out" : "request_failed" };
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
