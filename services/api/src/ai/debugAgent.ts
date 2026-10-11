import { Annotation, StateGraph, START, END } from "@langchain/langgraph";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type { BugCase } from "@bug-to-proof/shared-types";
import { runTest, RunResult } from "../runner/playwrightRunner";
import { validBaseline, sameTests, digest } from "../runner/integrity";
import { attachRun } from "../runner/record";
import { readCase, writeCase } from "../storage/caseStore";
import { answerQuestion, RagAnswer } from "./rag";
import { WORKSPACE_ROOT, ARTIFACTS_DIR } from "../utils/paths";

const TARGET = "apps/minishop/src/store/cartStore.ts";
const BUGGY = "total: () => get().items[0]?.price ?? 0,";
const FIXED = "total: () => get().items.reduce((sum, item) => sum + item.price * item.quantity, 0),";
const DebugState = Annotation.Root({
  bugCase: Annotation<BugCase>(),
  applyPatch: Annotation<boolean>(),
  context: Annotation<RagAnswer>(),
  before: Annotation<RunResult>(),
  after: Annotation<RunResult>(),
  source: Annotation<string>(),
  proposedSource: Annotation<string>(),
  patchDiff: Annotation<string>(),
  report: Annotation<string>(),
  outcome: Annotation<"BLOCKED" | "NEEDS_PATCH_REVIEW" | "VERIFIED" | "VERIFICATION_FAILED">(),
  events: Annotation<string[]>({ reducer: (a, b) => a.concat(b), default: () => [] }),
});
export interface DebugDependencies {
  run: typeof runTest;
  retrieve: typeof answerQuestion;
  baseline: typeof validBaseline;
  persist: (bugCase: BugCase) => void;
  readSource: () => string;
  writeSource: (source: string) => void;
}
const defaults: DebugDependencies = {
  run: runTest, retrieve: answerQuestion, baseline: validBaseline, persist: writeCase,
  readSource: () => fs.readFileSync(path.join(WORKSPACE_ROOT, TARGET), "utf8"),
  writeSource: (source) => fs.writeFileSync(path.join(WORKSPACE_ROOT, TARGET), source),
};
/** Model output is advisory data. Only the fixed, allowlisted demo repair can write code. */
export function buildDebugGraph(dependencies: Partial<DebugDependencies> = {}) {
  const deps = { ...defaults, ...dependencies };
  return new StateGraph(DebugState)
    .addNode("retrieve", async (state) => ({
      context: await deps.retrieve(`${state.bugCase.title}\n${state.bugCase.description}`),
      source: deps.readSource(), events: ["Retrieved local source context"],
    }))
    .addNode("reproduce", async (state) => {
      const bugCase = structuredClone(state.bugCase);
      bugCase.status = "REPRODUCING"; deps.persist(bugCase);
      const before = await deps.run(bugCase.id, bugCase.reproduction!.testFile, "before");
      attachRun(bugCase, before, "before"); deps.persist(bugCase);
      const blocked = before.outcome !== "ASSERTION_FAILED" || !deps.baseline(bugCase);
      return { bugCase, before, events: [`Baseline: ${before.outcome}`],
        ...(blocked ? { outcome: "BLOCKED" as const,
          report: before.outcome === "PASSED" ? "The reported failure was not reproduced." : `No valid baseline: ${before.actual}` } : {}) };
    })
    .addNode("propose", async (state) => {
      if (state.bugCase.id !== "case-001" ||
        state.bugCase.reproduction?.testFile !== "tests/playwright/cases/case-001-cart-total.spec.ts" ||
        !state.source.split("\n").some((line) => line.trim() === BUGGY)) {
        return { outcome: "BLOCKED" as const, report: "Baseline recorded. This agent has no supported repair for this source; manual diagnosis is required.",
          events: ["No supported demo patch"] };
      }
      const proposedSource = state.source.replace(BUGGY, FIXED);
      const lineNumber = state.source.split("\n").findIndex((line) => line.trim() === BUGGY) + 1;
      const oldLine = state.source.split("\n")[lineNumber - 1].replace(/\r$/, "");
      const patchDiff = `--- a/${TARGET}\n+++ b/${TARGET}\n@@ -${lineNumber},1 +${lineNumber},1 @@\n-${oldLine}\n+${oldLine.replace(BUGGY, FIXED)}\n`;
      const bugCase = structuredClone(state.bugCase);
      bugCase.patch = { summary: "Sum every item price multiplied by quantity",
        reasoning: "The recorded cart assertion failed. Source reads only items[0].price; the proposed reduction includes every item and its quantity.",
        filesChanged: [TARGET], diff: patchDiff, status: "PROPOSED", proposedAt: new Date().toISOString(), appliedAt: null };
      bugCase.status = "PATCH_PROPOSED"; deps.persist(bugCase);
      return { bugCase, proposedSource, patchDiff, outcome: "NEEDS_PATCH_REVIEW" as const,
        report: "Valid baseline recorded; review the proposed cart patch before applying it.",
        events: ["Proposed the allowlisted cart repair"] };
    })
    .addNode("apply", async (state) => {
      if (!deps.baseline(state.bugCase) || digest(deps.readSource()) !== digest(state.source)) {
        return { outcome: "BLOCKED" as const, report: "Inputs changed after baseline. Reproduce again.", events: ["Patch blocked by changed inputs"] };
      }
      deps.writeSource(state.proposedSource);
      const bugCase = structuredClone(state.bugCase);
      bugCase.patch!.status = "APPLIED"; bugCase.patch!.appliedAt = new Date().toISOString();
      bugCase.status = "PATCH_APPLIED"; deps.persist(bugCase);
      return { bugCase, events: ["Applied the reviewed demo patch"] };
    })
    .addNode("verify", async (state) => {
      const bugCase = structuredClone(state.bugCase);
      bugCase.status = "VERIFYING"; deps.persist(bugCase);
      const after = await deps.run(bugCase.id, bugCase.reproduction!.testFile, "after");
      const run = attachRun(bugCase, after, "after");
      const verified = after.outcome === "PASSED" && deps.baseline(bugCase) &&
        sameTests(bugCase.verification!.beforeRun!, run);
      bugCase.status = verified ? "VERIFIED" : "VERIFICATION_FAILED";
      bugCase.verification!.status = bugCase.status;
      bugCase.verification!.comparison = {
        statusChanged: verified, beforeStatus: "FAILED", afterStatus: after.passed ? "PASSED" : "FAILED",
      };
      deps.persist(bugCase);
      return { bugCase, after, outcome: verified ? "VERIFIED" as const : "VERIFICATION_FAILED" as const,
        report: verified ? "Recorded assertion failure became a pass with identical test inputs and test identities." : `Verification failed: ${after.actual}`,
        events: [`Verification: ${after.outcome}`] };
    })
    .addEdge(START, "retrieve").addEdge("retrieve", "reproduce")
    .addConditionalEdges("reproduce", (state) => state.outcome === "BLOCKED" ? END : "propose")
    .addConditionalEdges("propose", (state) => state.outcome === "BLOCKED" || !state.applyPatch ? END : "apply")
    .addConditionalEdges("apply", (state) => state.outcome === "BLOCKED" ? END : "verify")
    .addEdge("verify", END).compile();
}
const active = new Set<string>();
export async function debugCase(caseId: string, applyPatch = false) {
  const bugCase = readCase(caseId);
  if (!bugCase?.reproduction?.testFile) throw new Error("Case needs a reproduction test");
  if (active.size || ["REPRODUCING", "VERIFYING"].includes(bugCase.status)) throw new Error("A debugging run is already in progress");
  active.add(caseId);
  const runId = randomUUID();
  const dir = path.join(ARTIFACTS_DIR, "agent", runId);
  fs.mkdirSync(dir, { recursive: true });
  try {
    const result = await buildDebugGraph().invoke({ bugCase, applyPatch }, { recursionLimit: 12 });
    fs.writeFileSync(path.join(dir, "report.json"), JSON.stringify({ ...result, source: undefined, proposedSource: undefined }, null, 2));
    if (result.patchDiff) {
      fs.writeFileSync(path.join(dir, "patch.diff"), result.patchDiff);
      fs.writeFileSync(path.join(dir, "original-cartStore.ts"), result.source);
    }
    return { runId, outcome: result.outcome, report: result.report, events: result.events,
      context: result.context, patchDiff: result.patchDiff ?? null,
      artifactPath: `artifacts/agent/${runId}/report.json` };
  } catch (error) {
    const current = readCase(caseId);
    if (current && ["REPRODUCING", "VERIFYING"].includes(current.status)) {
      current.status = current.status === "REPRODUCING" ? "REPRODUCTION_FAILED" : "VERIFICATION_FAILED";
      writeCase(current);
    }
    fs.writeFileSync(path.join(dir, "error.json"), JSON.stringify({ error: String(error), outcome: "BLOCKED" }));
    throw error;
  } finally { active.delete(caseId); }
}

