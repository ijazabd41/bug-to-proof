import fs from "fs";
import path from "path";
import { REPRODUCTION_RUN_STATES, type ReproductionRunRecord } from "./contracts";

export class CorruptReproductionRunError extends Error {
  constructor(public readonly filePath: string, cause: unknown) { super(`Corrupt reproduction run record at ${filePath}: ${String(cause)}`); this.name = "CorruptReproductionRunError"; }
}
const validId = (value: string) => /^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/.test(value);

export class ReproductionRunStore {
  constructor(private readonly directory: string) {}
  private pathFor(runId: string): string { if (!validId(runId)) throw new Error("Invalid reproduction run id"); return path.join(this.directory, `${runId}.json`); }
  write(record: ReproductionRunRecord): void {
    fs.mkdirSync(this.directory, { recursive: true });
    if (fs.lstatSync(this.directory).isSymbolicLink()) throw new Error("Symlinked reproduction run stores are unsupported");
    const filePath = this.pathFor(record.reproductionRunId); const temporary = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(record, null, 2), "utf8"); fs.renameSync(temporary, filePath);
  }
  read(runId: string): ReproductionRunRecord | null {
    const filePath = this.pathFor(runId); if (!fs.existsSync(filePath)) return null;
    try {
      const value: unknown = JSON.parse(fs.readFileSync(filePath, "utf8"));
      if (!isRunRecord(value) || value.reproductionRunId !== runId) throw new Error("Record failed runtime schema validation");
      return value;
    } catch (error) { throw new CorruptReproductionRunError(filePath, error); }
  }
  listForCase(caseId: string): ReproductionRunRecord[] {
    if (!fs.existsSync(this.directory)) return [];
    const records: ReproductionRunRecord[] = [];
    for (const name of fs.readdirSync(this.directory)) {
      if (!name.endsWith(".json")) continue;
      const run = this.read(name.slice(0, -5)); if (run?.caseId === caseId) records.push(run);
    }
    return records.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  recoverInterrupted(now = () => new Date().toISOString()): number {
    if (!fs.existsSync(this.directory)) return 0;
    let recovered = 0;
    for (const name of fs.readdirSync(this.directory)) {
      if (!name.endsWith(".json")) continue;
      let run: ReproductionRunRecord | null = null;
      try {
        run = this.read(name.slice(0, -5));
      } catch (err) {
        if (err instanceof CorruptReproductionRunError) {
          console.warn(`[reproductionRunStore] Corrupt run record at ${err.filePath}; skipping startup recovery and preserving file intact`);
          continue;
        }
        throw err;
      }
      if (!run || run.completedAt || !(["DISCOVERING_TARGET", "GENERATING_CANDIDATE", "CONFIRMING_BASELINE"] as string[]).includes(run.state)) continue;
      const timestamp = now(); run.state = "BLOCKED"; run.stopReason = "Process was interrupted before completion"; run.updatedAt = timestamp; run.completedAt = timestamp;
      run.events = [...run.events, { sequence: run.events.length + 1, state: "BLOCKED", message: "Recovered interrupted reproduction run after process restart", createdAt: timestamp }];
      this.write(run); recovered++;
    }
    return recovered;
  }
}

function isRunRecord(value: unknown): value is ReproductionRunRecord {
  if (!value || typeof value !== "object") return false;
  const run = value as Record<string, unknown>;
  const limits = run.limits as Record<string, unknown> | undefined;
  return run.schemaVersion === "1.0" && typeof run.reproductionRunId === "string" && validId(run.reproductionRunId) &&
    typeof run.caseId === "string" && typeof run.state === "string" && REPRODUCTION_RUN_STATES.includes(run.state as any) &&
    !!run.reportSnapshot && typeof run.reportSnapshot === "object" && Array.isArray(run.attempts) && Array.isArray(run.events) &&
    !!limits && ["maxAttempts", "maxSteps", "maxRuntimeMs", "maxDefinitionBytes", "maxDiagnosticBytes"].every(key => typeof limits[key] === "number") &&
    typeof run.createdAt === "string" && typeof run.updatedAt === "string";
}
