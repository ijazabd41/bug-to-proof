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
export async function callLLM(
  prompt: string,
  timeoutMs = 10_000,
  abortSignal?: AbortSignal
): Promise<string> {
  const enabled = process.env.LLM_ENABLED === "true";
  const apiUrl = process.env.LLM_API_URL ?? "https://api.openai.com/v1";
  const apiKey = process.env.LLM_API_KEY ?? "";
  const model = process.env.LLM_MODEL ?? "gpt-4o-mini";

  if (!enabled || !apiKey) {
    console.warn("[llm] LLM disabled or API key not set — skipping call.");
    return "";
  }

  if (abortSignal?.aborted) {
    return "";
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
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      console.warn(`[llm] Non-2xx response: ${response.status}`);
      return "";
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return data.choices?.[0]?.message?.content?.trim() ?? "";
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      console.warn("[llm] Request timed out or cancelled.");
    } else {
      console.warn("[llm] Request failed:", err);
    }
    return "";
  } finally {
    clearTimeout(timer);
    if (abortSignal && abortListener) {
      abortSignal.removeEventListener("abort", abortListener);
    }
  }
}
