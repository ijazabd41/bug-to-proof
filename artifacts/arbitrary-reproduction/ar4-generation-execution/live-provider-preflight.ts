import path from "node:path";
import { config as loadEnv } from "dotenv";

loadEnv({ path: path.resolve(".env") });

async function main() {
  const { ragConfig, generateAnswer } = await import(
    "../../../services/api/src/ai/providers"
  );
  const provider = ragConfig();
  const prompt =
    'Return only this exact strict JSON object with no markdown or extra keys: {"ok":true,"purpose":"ar4-preflight"}';
  const started = Date.now();
  const raw = await generateAnswer(prompt, provider);
  let strictJsonValid = false;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    strictJsonValid =
      parsed.ok === true &&
      parsed.purpose === "ar4-preflight" &&
      Object.keys(parsed).length === 2;
  } catch {
    strictJsonValid = false;
  }

  const cancelled = new AbortController();
  cancelled.abort();
  const cancelledRaw = await generateAnswer(prompt, provider, cancelled.signal);

  const timeoutStarted = Date.now();
  const timeoutRaw = await generateAnswer(
    prompt,
    provider,
    AbortSignal.timeout(1),
  );
  const timeoutSignalObserved =
    timeoutRaw === "" && Date.now() - timeoutStarted < provider.timeoutMs;

  const result = {
    provider: provider.generationProvider,
    model: provider.generationModel,
    strictJsonValid,
    cancellationReturnedEmpty: cancelledRaw === "",
    timeoutSignalObserved,
    durationMs: Date.now() - started,
  };
  console.log(JSON.stringify(result));
  if (!strictJsonValid || cancelledRaw !== "" || !timeoutSignalObserved) {
    process.exitCode = 1;
  }
}

void main().catch((error: unknown) => {
  console.error(
    JSON.stringify({
      preflightError:
        error instanceof Error ? error.message.slice(0, 500) : "Unknown provider error",
    }),
  );
  process.exitCode = 1;
});
