/**
 * LLM Client — OpenAI-compatible chat completions
 *
 * All calls are:
 * - Gated by LLM_ENABLED env var
 * - Wrapped in a 10-second timeout
 * - Non-throwing: always returns a string (empty on failure)
 */

const LLM_ENABLED = process.env.LLM_ENABLED === "true";
const LLM_API_URL = process.env.LLM_API_URL ?? "https://api.openai.com/v1";
const LLM_API_KEY = process.env.LLM_API_KEY ?? "";
const LLM_MODEL = process.env.LLM_MODEL ?? "gpt-4o-mini";

/**
 * Call the configured LLM with a prompt string.
 * Returns empty string if LLM is disabled, key is missing, or call fails.
 */
export async function callLLM(
  prompt: string,
  timeoutMs = 10_000
): Promise<string> {
  if (!LLM_ENABLED || !LLM_API_KEY) {
    console.warn("[llm] LLM disabled or API key not set — skipping call.");
    return "";
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${LLM_API_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LLM_API_KEY}`,
      },
      body: JSON.stringify({
        model: LLM_MODEL,
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
      console.warn("[llm] Request timed out.");
    } else {
      console.warn("[llm] Request failed:", err);
    }
    return "";
  } finally {
    clearTimeout(timer);
  }
}
