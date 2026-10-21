import type { BugCase, BugReportDetails, CaseStatus, PatchStatus, Reproduction, Patch } from "@bug-to-proof/shared-types";

export interface ValidationResult<T = unknown> {
  valid: boolean;
  error?: string;
  details?: string;
  data?: T;
}

export const VALID_ID_REGEX = /^[a-zA-Z0-9-]{1,64}$/;
export const VALID_TEST_PATH_REGEX = /^tests\/playwright\/cases\/[a-zA-Z0-9_.-]+\.spec\.ts$/;

export function validateCaseId(id: unknown): id is string {
  return typeof id === "string" && VALID_ID_REGEX.test(id);
}

export function generateCollisionResistantCaseId(): string {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).slice(2, 10);
  return `case-${timestamp}-${randomSuffix}`;
}

const ALLOWED_CREATE_KEYS = new Set(["title", "description", "steps", "expected", "actual", "startPath", "context"]);
const ALLOWED_PATCH_KEYS = new Set(["title", "description", "report", "status", "reproduction", "patch"]);
const ALLOWED_REPRODUCTION_KEYS = new Set(["steps", "preconditions", "expected", "actual", "testFile"]);
const ALLOWED_PATCH_KEYS_OBJ = new Set([
  "summary",
  "reasoning",
  "filesChanged",
  "diff",
  "status",
  "proposedAt",
  "appliedAt",
]);

const VALID_STATUS_VALUES = new Set<CaseStatus>([
  "REPORTED",
  "READY_TO_REPRODUCE",
  "REPRODUCING",
  "REPRODUCED",
  "REPRODUCTION_FAILED",
  "PATCH_PROPOSED",
  "PATCH_APPLIED",
  "VERIFYING",
  "VERIFIED",
  "VERIFICATION_FAILED",
]);

const VALID_PATCH_STATUS_VALUES = new Set<PatchStatus>(["PROPOSED", "APPLIED", "REJECTED"]);

export interface CreateCaseInput {
  title: string;
  description: string;
  steps: string[];
  expected: string;
  actual: string;
  startPath: string;
  context: string;
}

function validateReportFields(record: Record<string, unknown>, prefix = ""): ValidationResult<Omit<BugReportDetails, "schemaVersion">> {
  const label = (field: string) => prefix ? `${prefix}.${field}` : field;
  const rawSteps = record.steps ?? [];
  if (!Array.isArray(rawSteps) || rawSteps.length > 20) return { valid: false, error: `${label("steps")} must be an array with at most 20 entries` };
  const steps: string[] = [];
  for (let i = 0; i < rawSteps.length; i++) {
    if (typeof rawSteps[i] !== "string" || !(rawSteps[i] as string).trim()) return { valid: false, error: `${label("steps")}[${i}] must be a non-empty string` };
    if ((rawSteps[i] as string).length > 1000) return { valid: false, error: `${label("steps")}[${i}] exceeds maximum length of 1000 characters` };
    steps.push((rawSteps[i] as string).trim());
  }
  const values: Record<"expected" | "actual" | "startPath" | "context", string> = { expected: "", actual: "", startPath: "", context: "" };
  const limits = { expected: 2000, actual: 2000, startPath: 500, context: 2000 };
  for (const field of Object.keys(values) as Array<keyof typeof values>) {
    const raw = record[field] ?? "";
    if (typeof raw !== "string") return { valid: false, error: `${label(field)} must be a string` };
    if (raw.length > limits[field]) return { valid: false, error: `${label(field)} exceeds maximum length of ${limits[field]} characters` };
    values[field] = raw.trim();
  }
  if (values.startPath && (!values.startPath.startsWith("/") || values.startPath.startsWith("//") || /^[a-z]+:\/\//i.test(values.startPath))) {
    return { valid: false, error: `${label("startPath")} must be an application-relative path beginning with /` };
  }
  return { valid: true, data: { steps, ...values } };
}

export function validateCreateCase(body: unknown): ValidationResult<CreateCaseInput> {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { valid: false, error: "Request body must be a JSON object" };
  }

  const keys = Object.keys(body);
  for (const k of keys) {
    if (!ALLOWED_CREATE_KEYS.has(k)) {
      return {
        valid: false,
        error: `Unknown or runner-owned field on case creation: ${k}`,
        details: `Allowed fields: ${Array.from(ALLOWED_CREATE_KEYS).join(", ")}`,
      };
    }
  }

  const { title, description } = body as { title?: unknown; description?: unknown };

  if (typeof title !== "string" || title.trim() === "") {
    return { valid: false, error: "title is required and must be a non-empty string" };
  }
  if (title.trim().length > 200) {
    return { valid: false, error: "title exceeds maximum length of 200 characters" };
  }

  if (typeof description !== "string" || description.trim() === "") {
    return { valid: false, error: "description is required and must be a non-empty string" };
  }
  if (description.trim().length > 5000) {
    return { valid: false, error: "description exceeds maximum length of 5000 characters" };
  }

  const reportValidation = validateReportFields(body as Record<string, unknown>);
  if (!reportValidation.valid || !reportValidation.data) return reportValidation as ValidationResult<CreateCaseInput>;
  if (reportValidation.data.steps.length === 0) return { valid: false, error: "steps are required" };
  if (!reportValidation.data.expected) return { valid: false, error: "expected behavior is required" };
  if (!reportValidation.data.actual) return { valid: false, error: "actual behavior is required" };

  return {
    valid: true,
    data: {
      title: title.trim(),
      description: description.trim(),
      ...reportValidation.data,
    },
  };
}

export function validatePatchCase(body: unknown): ValidationResult<Partial<BugCase>> {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { valid: false, error: "Request body must be a JSON object" };
  }

  const keys = Object.keys(body);
  if (keys.length === 0) {
    return { valid: false, error: "PATCH body cannot be empty" };
  }

  for (const k of keys) {
    if (!ALLOWED_PATCH_KEYS.has(k)) {
      return {
        valid: false,
        error: `Unknown or runner-owned field: ${k}`,
        details: `Allowed fields: ${Array.from(ALLOWED_PATCH_KEYS).join(", ")}`,
      };
    }
  }

  const record = body as Record<string, unknown>;
  const sanitized: Partial<BugCase> = {};

  if ("title" in record) {
    if (typeof record.title !== "string" || record.title.trim() === "") {
      return { valid: false, error: "title must be a non-empty string" };
    }
    if (record.title.trim().length > 200) {
      return { valid: false, error: "title exceeds maximum length of 200 characters" };
    }
    sanitized.title = record.title.trim();
  }

  if ("description" in record) {
    if (typeof record.description !== "string" || record.description.trim() === "") {
      return { valid: false, error: "description must be a non-empty string" };
    }
    if (record.description.trim().length > 5000) {
      return { valid: false, error: "description exceeds maximum length of 5000 characters" };
    }
    sanitized.description = record.description.trim();
  }

  if ("report" in record) {
    if (!record.report || typeof record.report !== "object" || Array.isArray(record.report)) return { valid: false, error: "report must be an object" };
    const reportRecord = record.report as Record<string, unknown>;
    const allowed = new Set(["schemaVersion", "steps", "expected", "actual", "startPath", "context"]);
    for (const key of Object.keys(reportRecord)) if (!allowed.has(key)) return { valid: false, error: `Unknown field in report: ${key}` };
    if ("schemaVersion" in reportRecord && reportRecord.schemaVersion !== "1.0") return { valid: false, error: "report.schemaVersion must be 1.0" };
    const validated = validateReportFields(reportRecord, "report");
    if (!validated.valid || !validated.data) return validated as ValidationResult<Partial<BugCase>>;
    sanitized.report = { schemaVersion: "1.0", ...validated.data };
  }

  if ("status" in record) {
    if (typeof record.status !== "string" || !VALID_STATUS_VALUES.has(record.status as CaseStatus)) {
      return { valid: false, error: `Invalid status: ${String(record.status)}` };
    }
    if (record.status === "REPRODUCING" || record.status === "VERIFYING") {
      return { valid: false, error: `Cannot manually set runner-owned state: ${record.status}` };
    }
    sanitized.status = record.status as CaseStatus;
  }

  if ("reproduction" in record) {
    const repro = record.reproduction;
    if (!repro || typeof repro !== "object" || Array.isArray(repro)) {
      return { valid: false, error: "reproduction must be an object" };
    }

    const reproObj = repro as Record<string, unknown>;
    if ("lastRun" in reproObj) {
      return { valid: false, error: "Test results are runner-owned" };
    }

    for (const rk of Object.keys(reproObj)) {
      if (!ALLOWED_REPRODUCTION_KEYS.has(rk)) {
        return { valid: false, error: `Unknown field in reproduction: ${rk}` };
      }
    }

    const sanitizedRepro: Partial<Reproduction> = {};

    if ("steps" in reproObj) {
      if (!Array.isArray(reproObj.steps) || reproObj.steps.length === 0) {
        return { valid: false, error: "reproduction.steps must be a non-empty array of strings" };
      }
      for (let i = 0; i < reproObj.steps.length; i++) {
        const step = reproObj.steps[i];
        if (typeof step !== "string" || step.trim() === "") {
          return { valid: false, error: `reproduction.steps[${i}] must be a non-empty string` };
        }
        if (step.length > 1000) {
          return { valid: false, error: `reproduction.steps[${i}] exceeds maximum length of 1000 characters` };
        }
      }
      sanitizedRepro.steps = reproObj.steps.map((s) => (s as string).trim());
    }

    if ("preconditions" in reproObj) {
      if (!Array.isArray(reproObj.preconditions)) {
        return { valid: false, error: "reproduction.preconditions must be an array of strings" };
      }
      for (let i = 0; i < reproObj.preconditions.length; i++) {
        const pre = reproObj.preconditions[i];
        if (typeof pre !== "string") {
          return { valid: false, error: `reproduction.preconditions[${i}] must be a string` };
        }
        if (pre.length > 1000) {
          return { valid: false, error: `reproduction.preconditions[${i}] exceeds maximum length of 1000 characters` };
        }
      }
      sanitizedRepro.preconditions = reproObj.preconditions.map((s) => (s as string).trim());
    }

    if ("expected" in reproObj) {
      if (typeof reproObj.expected !== "string") {
        return { valid: false, error: "reproduction.expected must be a string" };
      }
      if (reproObj.expected.length > 2000) {
        return { valid: false, error: "reproduction.expected exceeds maximum length of 2000 characters" };
      }
      sanitizedRepro.expected = reproObj.expected.trim();
    }

    if ("actual" in reproObj) {
      if (typeof reproObj.actual !== "string") {
        return { valid: false, error: "reproduction.actual must be a string" };
      }
      if (reproObj.actual.length > 2000) {
        return { valid: false, error: "reproduction.actual exceeds maximum length of 2000 characters" };
      }
      sanitizedRepro.actual = reproObj.actual.trim();
    }

    if ("testFile" in reproObj) {
      if (typeof reproObj.testFile !== "string") {
        return { valid: false, error: "reproduction.testFile must be a string" };
      }
      const trimmedPath = reproObj.testFile.trim().replace(/\\/g, "/");
      if (trimmedPath.includes("..") || trimmedPath.startsWith("/") || (!VALID_TEST_PATH_REGEX.test(trimmedPath) && trimmedPath !== "")) {
        return {
          valid: false,
          error: "reproduction.testFile must be a valid relative test spec path (e.g. tests/playwright/cases/case-001-cart-total.spec.ts)",
        };
      }
      sanitizedRepro.testFile = trimmedPath;
    }

    sanitized.reproduction = sanitizedRepro as Reproduction;
  }

  if ("patch" in record) {
    const patch = record.patch;
    if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
      return { valid: false, error: "patch must be an object" };
    }

    const patchObj = patch as Record<string, unknown>;
    for (const pk of Object.keys(patchObj)) {
      if (!ALLOWED_PATCH_KEYS_OBJ.has(pk)) {
        return { valid: false, error: `Unknown field in patch: ${pk}` };
      }
    }

    const sanitizedPatch: Partial<Patch> = {};

    if ("summary" in patchObj) {
      if (typeof patchObj.summary !== "string") {
        return { valid: false, error: "patch.summary must be a string" };
      }
      if (patchObj.summary.length > 500) {
        return { valid: false, error: "patch.summary exceeds maximum length of 500 characters" };
      }
      sanitizedPatch.summary = patchObj.summary.trim();
    }

    if ("reasoning" in patchObj) {
      if (typeof patchObj.reasoning !== "string") {
        return { valid: false, error: "patch.reasoning must be a string" };
      }
      if (patchObj.reasoning.length > 2000) {
        return { valid: false, error: "patch.reasoning exceeds maximum length of 2000 characters" };
      }
      sanitizedPatch.reasoning = patchObj.reasoning.trim();
    }

    if ("diff" in patchObj) {
      if (typeof patchObj.diff !== "string") {
        return { valid: false, error: "patch.diff must be a string" };
      }
      if (patchObj.diff.length > 100_000) {
        return { valid: false, error: "patch.diff exceeds maximum allowed length" };
      }
      sanitizedPatch.diff = patchObj.diff;
    }

    if ("filesChanged" in patchObj) {
      if (!Array.isArray(patchObj.filesChanged)) {
        return { valid: false, error: "patch.filesChanged must be an array of strings" };
      }
      for (const fc of patchObj.filesChanged) {
        if (typeof fc !== "string" || fc.length > 500) {
          return { valid: false, error: "patch.filesChanged elements must be valid strings" };
        }
      }
      sanitizedPatch.filesChanged = patchObj.filesChanged.map((f) => (f as string).trim());
    }

    if ("status" in patchObj) {
      if (typeof patchObj.status !== "string" || !VALID_PATCH_STATUS_VALUES.has(patchObj.status as PatchStatus)) {
        return { valid: false, error: `Invalid patch.status: ${String(patchObj.status)}` };
      }
      sanitizedPatch.status = patchObj.status as PatchStatus;
    }

    if ("proposedAt" in patchObj) {
      if (typeof patchObj.proposedAt !== "string") {
        return { valid: false, error: "patch.proposedAt must be an ISO string" };
      }
      sanitizedPatch.proposedAt = patchObj.proposedAt;
    }

    if ("appliedAt" in patchObj) {
      if (patchObj.appliedAt !== null && typeof patchObj.appliedAt !== "string") {
        return { valid: false, error: "patch.appliedAt must be an ISO string or null" };
      }
      sanitizedPatch.appliedAt = patchObj.appliedAt;
    }

    sanitized.patch = sanitizedPatch as Patch;
  }

  return { valid: true, data: sanitized };
}

/** Sanitize LLM-extracted reproduction fields to prevent corruption */
export function sanitizeLLMReproduction(
  parsed: unknown,
  existing: Reproduction
): Partial<Reproduction> {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {};
  }
  const obj = parsed as Record<string, unknown>;
  const result: Partial<Reproduction> = {};

  if (Array.isArray(obj.preconditions)) {
    const validPre = obj.preconditions
      .filter((p): p is string => typeof p === "string" && p.trim() !== "")
      .map((p) => p.trim().slice(0, 1000));
    result.preconditions = validPre.length > 0 ? validPre : existing.preconditions;
  }

  if (Array.isArray(obj.steps)) {
    const validSteps = obj.steps
      .filter((s): s is string => typeof s === "string" && s.trim() !== "")
      .map((s) => s.trim().slice(0, 1000));
    result.steps = validSteps.length > 0 ? validSteps : existing.steps;
  }

  if (typeof obj.expected === "string" && obj.expected.trim() !== "") {
    result.expected = obj.expected.trim().slice(0, 2000);
  }

  if (typeof obj.actual === "string" && obj.actual.trim() !== "") {
    result.actual = obj.actual.trim().slice(0, 2000);
  }

  return result;
}
