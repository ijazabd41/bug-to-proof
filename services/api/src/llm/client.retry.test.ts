import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { callLLMWithDiagnostics } from "./client";

describe("generation transport recovery", () => {
  const previousEnv = process.env;
  beforeEach(() => {
    process.env = { ...previousEnv, LLM_ENABLED: "true", LLM_API_KEY: "test-key", LLM_API_URL: "https://example.invalid/v1" };
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => { process.env = previousEnv; vi.unstubAllGlobals(); });

  it("retries a transient HTTP 429 within the request budget and returns the eventual response", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 429, headers: { "retry-after": "0" } }));
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ choices: [{ message: { content: "recovered" } }] }) } as Response);

    const result = await callLLMWithDiagnostics("report", 5_000);

    expect(result.content).toBe("recovered");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry authentication failures", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }));

    const result = await callLLMWithDiagnostics("report", 5_000);

    expect(result.responseShape).toBe("http_error:401");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reads a local Ollama chat response without an API key", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ message: { content: "  local candidate  " } }), { status: 200 }));

    const result = await callLLMWithDiagnostics("report", 5_000, undefined, 100,
      { apiUrl: "http://localhost:11434", model: "fixture", protocol: "ollama" });

    expect(result).toEqual({ content: "local candidate", responseShape: "message_content_string_nonempty" });
    expect(fetchMock.mock.calls[0][0]).toBe("http://localhost:11434/api/chat");
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({ model: "fixture", stream: false, options: { num_predict: 100 } });
    expect((fetchMock.mock.calls[0][1]?.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it("stops waiting after user cancellation between retries", async () => {
    const fetchMock = vi.mocked(fetch);
    const controller = new AbortController();
    fetchMock.mockImplementationOnce(async () => { controller.abort(); throw new DOMException("Cancelled", "AbortError"); });

    const result = await callLLMWithDiagnostics("report", 5_000, controller.signal);

    expect(result.responseShape).toBe("request_cancelled");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("classifies malformed HTTP 200 JSON as unusable provider output, not a connection outage", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response("not-json", { status: 200 }));

    const result = await callLLMWithDiagnostics("report", 5_000);

    expect(result.responseShape).toBe("response_json_invalid");
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
  });

  it("honors Retry-After longer than the usual backoff", async () => {
    vi.useFakeTimers();
    try {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValueOnce(new Response(null, { status: 429, headers: { "retry-after": "3" } }));
      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: "ready" } }] }), { status: 200 }));
      const pending = callLLMWithDiagnostics("report", 5_000);
      await vi.advanceTimersByTimeAsync(2_000);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1_000);
      expect((await pending).content).toBe("ready");
    } finally { vi.useRealTimers(); }
  });

  it("retries transient 5xx and a 429 without Retry-After", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 503 }));
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 429 }));
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: "ready" } }] }), { status: 200 }));

    const result = await callLLMWithDiagnostics("report", 5_000);

    expect(result.content).toBe("ready");
    expect(result.requestAttempts).toBe(3);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("bounds refused connections and excludes credentials and raw prompt from diagnostics", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockRejectedValue(new TypeError("fetch failed: ECONNREFUSED, test-key, private report"));

    const result = await callLLMWithDiagnostics("private report", 5_000);

    expect(result).toMatchObject({ content: "", responseShape: "request_failed", requestAttempts: 3 });
    expect(JSON.stringify(result)).not.toMatch(/test-key|private report/);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("stops a hung request at the overall deadline", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation((_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
    }));

    const result = await callLLMWithDiagnostics("report", 30);

    expect(result).toMatchObject({ content: "", responseShape: "request_timed_out", requestAttempts: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
