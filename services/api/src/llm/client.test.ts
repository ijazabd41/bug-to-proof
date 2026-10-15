import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { callLLM, callLLMWithDiagnostics } from './client';

describe('LLM Client', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    global.fetch = vi.fn();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('should return empty string if LLM_ENABLED is not true', async () => {
    process.env.LLM_ENABLED = 'false';
    process.env.LLM_API_KEY = 'test-key';
    const result = await callLLM('hello');
    expect(result).toBe('');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('should return empty string if LLM_API_KEY is not set', async () => {
    process.env.LLM_ENABLED = 'true';
    process.env.LLM_API_KEY = '';
    const result = await callLLM('hello');
    expect(result).toBe('');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('should call fetch and return the response text when enabled', async () => {
    process.env.LLM_ENABLED = 'true';
    process.env.LLM_API_KEY = 'test-key';
    process.env.LLM_API_URL = 'https://api.test.com/v1';
    process.env.LLM_MODEL = 'test-model';

    // Reload module to pick up env var changes (since they are read at module top-level)
    const { callLLM: reloadedCallLLM } = await import('./client?update=' + Date.now());

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'LLM response text' } }]
      })
    });

    const result = await reloadedCallLLM('hello prompt');
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(result).toBe('LLM response text');
  });

  it('should handle API errors gracefully', async () => {
    process.env.LLM_ENABLED = 'true';
    process.env.LLM_API_KEY = 'test-key';

    const { callLLM: reloadedCallLLM } = await import('./client?update=' + Date.now() + 1);

    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error'
    });

    const result = await reloadedCallLLM('hello prompt');
    expect(result).toBe('');
  });

  it('classifies a successful response with missing message content without retaining raw output', async () => {
    process.env.LLM_ENABLED = 'true';
    process.env.LLM_API_KEY = 'test-key';
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'secret-provider-id', choices: [{ finish_reason: 'stop', message: {} }] }),
    });

    const result = await callLLMWithDiagnostics('hello prompt');

    expect(result).toEqual({
      content: '',
      responseShape: 'choices_array:first_choice_object:message_object:content_missing',
    });
    expect(JSON.stringify(result)).not.toContain('secret-provider-id');
  });

  it.each([
    [{ choices: [{ message: { content: "   " } }] }, 'choices_array:first_choice_object:message_object:content_string_empty'],
    [{ choices: [{ message: { content: [{ type: "text", text: "secret" }] } }] }, 'choices_array:first_choice_object:message_object:content_not_string'],
  ])('classifies other unusable successful response shapes without retaining content', async (body, responseShape) => {
    process.env.LLM_ENABLED = 'true';
    process.env.LLM_API_KEY = 'test-key';
    (global.fetch as any).mockResolvedValueOnce({ ok: true, json: async () => body });
    expect(await callLLMWithDiagnostics('hello prompt')).toEqual({ content: '', responseShape });
  });
});
