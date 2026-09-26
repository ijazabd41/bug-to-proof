import { Request, Response, NextFunction } from "express";
import type { ApiError } from "@bug-to-proof/shared-types";

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error("[api] Unhandled error:", err);
  const body: ApiError = {
    error: "Internal server error",
    details: err.message,
  };
  res.status(500).json(body);
}
