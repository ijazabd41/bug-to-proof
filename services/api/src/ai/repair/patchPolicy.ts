import fs from "fs";
import type { ProposalEdit } from "./contracts";
import { validateSafeRelativePath } from "./tools";

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function normalizeRelativePath(rel: string): string {
  let normalized = rel.replace(/\\/g, "/").trim();
  if (normalized.startsWith("apps/minishop/")) {
    normalized = normalized.slice("apps/minishop/".length);
  }
  return normalized;
}

export function isAllowedEditablePath(relativePath: string): boolean {
  const norm = normalizeRelativePath(relativePath);
  if (!norm.startsWith("src/")) return false;
  if (/\.(test|spec)\.(ts|tsx|js|jsx)$/.test(norm)) return false;
  if (!/\.(ts|tsx|css|html|json)$/.test(norm)) return false;
  return true;
}

export function validateEdits(
  minishopDir: string,
  edits: ProposalEdit[]
): ValidationResult {
  if (!Array.isArray(edits) || edits.length === 0) {
    return { valid: false, error: "Proposal must contain at least one edit" };
  }
  if (edits.length > 5) {
    return { valid: false, error: `Proposal contains ${edits.length} edits, exceeding the maximum limit of 5` };
  }

  for (const edit of edits) {
    const norm = normalizeRelativePath(edit.relativePath);
    if (!isAllowedEditablePath(norm)) {
      return {
        valid: false,
        error: `Editing is not permitted for path: ${edit.relativePath}. Allowed: apps/minishop/src/**/* (excluding tests and configs).`,
      };
    }

    let fullPath: string;
    try {
      fullPath = validateSafeRelativePath(minishopDir, norm);
    } catch (err) {
      return { valid: false, error: `Invalid target path: ${edit.relativePath}` };
    }

    if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
      return { valid: false, error: `Target file does not exist: ${edit.relativePath}` };
    }

    const currentContent = fs.readFileSync(fullPath, "utf-8");
    const normalizedCurrent = currentContent.replace(/\r\n/g, "\n");
    const normalizedOld = edit.oldContent.replace(/\r\n/g, "\n");

    if (!normalizedOld) {
      return { valid: false, error: `oldContent cannot be empty in edit for ${edit.relativePath}` };
    }

    const firstIndex = normalizedCurrent.indexOf(normalizedOld);
    if (firstIndex === -1) {
      return {
        valid: false,
        error: `oldContent not found in ${edit.relativePath}. Proposal may be stale or mismatched.`,
      };
    }

    const lastIndex = normalizedCurrent.lastIndexOf(normalizedOld);
    if (firstIndex !== lastIndex) {
      return {
        valid: false,
        error: `oldContent appears multiple times in ${edit.relativePath}. Edit must be unambiguous.`,
      };
    }
  }

  return { valid: true };
}

export function generateUnifiedDiff(
  minishopDir: string,
  edits: ProposalEdit[]
): string {
  let diff = "";

  for (const edit of edits) {
    const norm = normalizeRelativePath(edit.relativePath);
    const fullPath = validateSafeRelativePath(minishopDir, norm);
    const content = fs.readFileSync(fullPath, "utf-8").replace(/\r\n/g, "\n");
    const oldContent = edit.oldContent.replace(/\r\n/g, "\n");
    const newContent = edit.newContent.replace(/\r\n/g, "\n");

    const index = content.indexOf(oldContent);
    if (index === -1) continue;

    const beforeText = content.slice(0, index);
    const startLine = beforeText.split("\n").length;
    const oldLines = oldContent.split("\n");
    const newLines = newContent.split("\n");

    diff += `--- a/${norm}\n+++ b/${norm}\n`;
    diff += `@@ -${startLine},${oldLines.length} +${startLine},${newLines.length} @@\n`;

    for (const line of oldLines) {
      diff += `-${line}\n`;
    }
    for (const line of newLines) {
      diff += `+${line}\n`;
    }
  }

  return diff;
}

import path from "path";
import { digest } from "../../runner/integrity";

export function computeExpectedPatchedFingerprint(
  minishopDir: string,
  edits: ProposalEdit[]
): string {
  const manifest: { relativePath: string; hash: string }[] = [];
  const srcDir = path.join(minishopDir, "src");

  const editsByPath = new Map<string, ProposalEdit>();
  for (const edit of edits) {
    editsByPath.set(normalizeRelativePath(edit.relativePath), edit);
  }

  function scan(dir: string) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scan(fullPath);
      } else if (entry.isFile() && /\.(ts|tsx|css|html|json)$/.test(entry.name)) {
        const rel = path.relative(minishopDir, fullPath).replace(/\\/g, "/");
        const normRel = normalizeRelativePath(rel);
        const currentContent = fs.readFileSync(fullPath, "utf-8");

        if (editsByPath.has(normRel)) {
          const edit = editsByPath.get(normRel)!;
          const isCRLF = currentContent.includes("\r\n");
          const normalizedCurrent = currentContent.replace(/\r\n/g, "\n");
          const normalizedOld = edit.oldContent.replace(/\r\n/g, "\n");
          const normalizedNew = edit.newContent.replace(/\r\n/g, "\n");
          const updatedNormalized = normalizedCurrent.replace(normalizedOld, normalizedNew);
          const finalContent = isCRLF ? updatedNormalized.replace(/\n/g, "\r\n") : updatedNormalized;
          manifest.push({
            relativePath: rel,
            hash: digest(Buffer.from(finalContent, "utf-8")),
          });
        } else {
          manifest.push({
            relativePath: rel,
            hash: digest(fs.readFileSync(fullPath)),
          });
        }
      }
    }
  }

  scan(srcDir);
  manifest.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  return digest(JSON.stringify(manifest));
}

export function areEditsAlreadyApplied(
  minishopDir: string,
  edits: ProposalEdit[]
): boolean {
  for (const edit of edits) {
    try {
      const norm = normalizeRelativePath(edit.relativePath);
      const fullPath = validateSafeRelativePath(minishopDir, norm);
      if (!fs.existsSync(fullPath)) return false;
      const content = fs.readFileSync(fullPath, "utf-8").replace(/\r\n/g, "\n");
      const normalizedOld = edit.oldContent.replace(/\r\n/g, "\n");
      const normalizedNew = edit.newContent.replace(/\r\n/g, "\n");
      if (content.includes(normalizedOld) || !content.includes(normalizedNew)) {
        return false;
      }
    } catch {
      return false;
    }
  }
  return true;
}

export function applyEditsTransactionally(
  minishopDir: string,
  edits: ProposalEdit[]
): { success: boolean; modifiedFiles: string[]; error?: string } {
  // If edits are already cleanly applied (e.g. from a prior resumed step), succeed idempotently
  if (areEditsAlreadyApplied(minishopDir, edits)) {
    return {
      success: true,
      modifiedFiles: edits.map((e) => normalizeRelativePath(e.relativePath)),
    };
  }

  const validation = validateEdits(minishopDir, edits);
  if (!validation.valid) {
    return { success: false, modifiedFiles: [], error: validation.error };
  }

  const originalFiles: Map<string, string> = new Map();
  const modifiedFiles: string[] = [];

  try {
    for (const edit of edits) {
      const norm = normalizeRelativePath(edit.relativePath);
      const fullPath = validateSafeRelativePath(minishopDir, norm);
      const currentContent = fs.readFileSync(fullPath, "utf-8");
      originalFiles.set(fullPath, currentContent);

      const normalizedCurrent = currentContent.replace(/\r\n/g, "\n");
      const normalizedOld = edit.oldContent.replace(/\r\n/g, "\n");
      const normalizedNew = edit.newContent.replace(/\r\n/g, "\n");

      // Preserve original line endings style (CRLF if original had \r\n)
      const isCRLF = currentContent.includes("\r\n");
      const updatedNormalized = normalizedCurrent.replace(normalizedOld, normalizedNew);
      const finalContent = isCRLF ? updatedNormalized.replace(/\n/g, "\r\n") : updatedNormalized;

      fs.writeFileSync(fullPath, finalContent, "utf-8");
      modifiedFiles.push(norm);
    }

    return { success: true, modifiedFiles };
  } catch (err) {
    // Rollback
    for (const [filePath, content] of originalFiles.entries()) {
      try {
        fs.writeFileSync(filePath, content, "utf-8");
      } catch {
        // ignore rollback errors
      }
    }
    return {
      success: false,
      modifiedFiles: [],
      error: `Failed to apply edits transactionally: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
