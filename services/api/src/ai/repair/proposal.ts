import { randomUUID } from "crypto";
import type { ModelProposal, ProposalEdit, RepairRunConfig } from "./contracts";
import { computeProposalHash } from "./contracts";
import { validateEdits, generateUnifiedDiff, normalizeRelativePath } from "./patchPolicy";
import { listSourceFiles, readSourceFile } from "./tools";
import { generateAnswer, ragConfig } from "../providers";
import { callLLM } from "../../llm/client";

export interface GenerateProposalInput {
  caseTitle: string;
  caseDescription: string;
  reproductionTestFile: string;
  minishopDir: string;
  attempt?: number;
  diagnostics?: string[];
  config?: RepairRunConfig;
  runId?: string;
  abortSignal?: AbortSignal;
}

export function parseModelProposalJson(rawText: string): {
  diagnosis: string;
  assumptions: string[];
  rationale: string;
  edits: ProposalEdit[];
} {
  let cleaned = rawText.trim();
  // Strip markdown code fences if present
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  }

  // Find JSON object boundaries
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error("Model response did not contain a valid JSON object");
  }

  const jsonStr = cleaned.slice(firstBrace, lastBrace + 1);
  let parsed: any;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (err) {
    throw new Error(`Failed to parse model proposal JSON: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (typeof parsed.diagnosis !== "string" || !parsed.diagnosis.trim()) {
    throw new Error("Proposal missing or empty diagnosis");
  }
  if (!Array.isArray(parsed.edits) || parsed.edits.length === 0) {
    throw new Error("Proposal must contain at least one edit in edits array");
  }

  const edits: ProposalEdit[] = parsed.edits.map((e: any) => {
    if (!e || typeof e !== "object") throw new Error("Invalid edit entry in edits array");
    if (typeof e.relativePath !== "string" || !e.relativePath.trim()) {
      throw new Error("Edit missing relativePath");
    }
    if (typeof e.oldContent !== "string") throw new Error("Edit missing oldContent");
    if (typeof e.newContent !== "string") throw new Error("Edit missing newContent");
    return {
      relativePath: normalizeRelativePath(e.relativePath),
      oldContent: e.oldContent,
      newContent: e.newContent,
    };
  });

  return {
    diagnosis: parsed.diagnosis.trim(),
    assumptions: Array.isArray(parsed.assumptions)
      ? parsed.assumptions.map((a: any) => String(a))
      : [],
    rationale: typeof parsed.rationale === "string" ? parsed.rationale.trim() : parsed.diagnosis.trim(),
    edits,
  };
}

export async function generateProposal(input: GenerateProposalInput): Promise<ModelProposal> {
  const { caseTitle, caseDescription, reproductionTestFile, minishopDir, attempt = 1, diagnostics = [], config } = input;

  // Handle simulated mode with per-attempt support
  if (config?.mode === "simulated") {
    const sim = config.simulatedProposalsByAttempt?.[attempt] ?? config.simulatedProposal;
    if (sim) {
      const edits = sim.edits.map((e) => ({
        relativePath: normalizeRelativePath(e.relativePath),
        oldContent: e.oldContent,
        newContent: e.newContent,
      }));

      const validation = validateEdits(minishopDir, edits);
      if (!validation.valid) {
        throw new Error(`Simulated proposal validation failed: ${validation.error}`);
      }

      const diff = generateUnifiedDiff(minishopDir, edits);
      const diagnosis = sim.diagnosis;
      const rationale = sim.rationale;
      const assumptions = sim.assumptions ?? [];
      const hash = computeProposalHash(edits, diagnosis, rationale);

      return {
        schemaVersion: "1.0",
        proposalId: `prop-${randomUUID()}`,
        diagnosis,
        assumptions,
        rationale,
        edits,
        unifiedDiff: diff,
        proposalHash: hash,
        proposedAt: new Date().toISOString(),
      };
    }
  }

  // Gather relevant source context
  const sourceFiles = listSourceFiles(minishopDir);
  const sourceSnippets: string[] = [];

  for (const rel of sourceFiles) {
    try {
      const fileInfo = readSourceFile(minishopDir, rel, 10_000);
      sourceSnippets.push(`--- FILE: ${rel} ---\n${fileInfo.content}\n`);
    } catch {
      // ignore
    }
  }

  const diagnosticsSection =
    diagnostics.length > 0
      ? `\nPrevious Attempt Diagnostics & Verification Failures (Attempt ${attempt - 1}):\n` +
        diagnostics.map((d, i) => `${i + 1}. ${d}`).join("\n") +
        "\n\nPlease address the above failure feedback to ensure the new patch compiles cleanly and passes all verification gates.\n"
      : "";

  const prompt = `You are an expert React and TypeScript engineer.
You are fixing a bug reported in a MiniShop e-commerce application.

Bug Report:
Title: ${caseTitle}
Description: ${caseDescription}
Reproduction Test: ${reproductionTestFile}
${diagnosticsSection}
Available Source Files in apps/minishop/:
${sourceSnippets.join("\n\n")}

Task:
Analyze the bug report and the source code.
Identify the root cause and provide a minimal, correct patch to fix the bug.
Provide your response strictly in the following JSON format without extra commentary:

{
  "diagnosis": "A concise explanation of the root cause.",
  "assumptions": ["List any key assumptions made"],
  "rationale": "Why this minimal patch resolves the bug correctly without breaking other behavior.",
  "edits": [
    {
      "relativePath": "src/store/cartStore.ts",
      "oldContent": "exact snippet from the file to replace (must match exactly once)",
      "newContent": "the corrected replacement snippet"
    }
  ]
}
`;

  let responseText = "";
  if (input.abortSignal?.aborted) {
    throw new Error("Model generation request aborted");
  }
  try {
    const ragConf = ragConfig();
    if (ragConf.generationProvider !== "disabled" && ragConf.generationProvider !== "legacy") {
      responseText = await generateAnswer(prompt, ragConf, input.abortSignal);
    } else {
      responseText = await callLLM(prompt, 30_000, input.abortSignal);
    }
  } catch (err) {
    throw new Error(`Model generation request failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (!responseText || !responseText.trim()) {
    throw new Error("Model returned an empty response. Verify LLM configuration and credentials.");
  }

  const parsed = parseModelProposalJson(responseText);

  const validation = validateEdits(minishopDir, parsed.edits);
  if (!validation.valid) {
    throw new Error(`Model proposed invalid edits: ${validation.error}`);
  }

  const diff = generateUnifiedDiff(minishopDir, parsed.edits);
  const hash = computeProposalHash(parsed.edits, parsed.diagnosis, parsed.rationale);

  return {
    schemaVersion: "1.0",
    proposalId: `prop-${randomUUID()}`,
    diagnosis: parsed.diagnosis,
    assumptions: parsed.assumptions,
    rationale: parsed.rationale,
    edits: parsed.edits,
    unifiedDiff: diff,
    proposalHash: hash,
    proposedAt: new Date().toISOString(),
  };
}
