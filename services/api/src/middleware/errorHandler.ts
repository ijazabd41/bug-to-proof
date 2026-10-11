import { Request, Response, NextFunction } from "express";
import type { ApiError } from "@bug-to-proof/shared-types";
import { CaseStorageError, CorruptCaseRecordError } from "../storage/caseStore";
import { RunStorageError, CorruptRunRecordError } from "../ai/repair/runStore";

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error("[api] Unhandled error:", err);

  if (
    err instanceof CaseStorageError ||
    (err as any)?.name === "CaseStorageError" ||
    err instanceof RunStorageError ||
    (err as any)?.name === "RunStorageError"
  ) {
    res.status(503).json({
      error: "Storage unavailable",
      details: err.message,
      retryable: true,
    });
    return;
  }

  if (
    err instanceof CorruptCaseRecordError ||
    (err as any)?.name === "CorruptCaseRecordError" ||
    err instanceof CorruptRunRecordError ||
    (err as any)?.name === "CorruptRunRecordError"
  ) {
    res.status(500).json({
      error: (err instanceof CorruptRunRecordError || (err as any)?.name === "CorruptRunRecordError")
        ? "Corrupt repair run record on disk"
        : "Corrupt case record on disk",
      details: err.message,
      retryable: false,
    });
    return;
  }

  const body: ApiError = {
    error: "Internal server error",
    details: err.message,
  };
  res.status(500).json(body);
}


