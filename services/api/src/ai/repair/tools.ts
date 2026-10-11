import fs from "fs";
import path from "path";

export interface SearchMatch {
  relativePath: string;
  lineNumber: number;
  lineContent: string;
}

export function validateSafeRelativePath(baseDir: string, relativePath: string): string {
  // Normalize and prevent directory traversal
  const normalized = path.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, "");
  if (path.isAbsolute(normalized) || normalized.startsWith("\\") || normalized.startsWith("/")) {
    throw new Error(`Path must be relative: ${relativePath}`);
  }
  const resolved = path.resolve(baseDir, normalized);
  const realBase = fs.realpathSync(baseDir);
  if (!resolved.startsWith(realBase + path.sep) && resolved !== realBase) {
    throw new Error(`Path escapes base directory: ${relativePath}`);
  }
  return resolved;
}

export function listSourceFiles(minishopDir: string): string[] {
  const srcDir = path.join(minishopDir, "src");
  if (!fs.existsSync(srcDir)) return [];

  const files: string[] = [];
  function scan(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scan(fullPath);
      } else if (entry.isFile() && /\.(ts|tsx|css|html|json)$/.test(entry.name)) {
        // Exclude test files from model exploration
        if (/\.(test|spec)\.(ts|tsx|js|jsx)$/.test(entry.name)) continue;
        const rel = path.relative(minishopDir, fullPath).replace(/\\/g, "/");
        files.push(rel);
      }
    }
  }

  scan(srcDir);
  return files.sort();
}

export function readSourceFile(
  minishopDir: string,
  relativePath: string,
  maxBytes = 50_000
): { relativePath: string; content: string; lines: number; truncated: boolean } {
  const fullPath = validateSafeRelativePath(minishopDir, relativePath);
  if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
    throw new Error(`File not found: ${relativePath}`);
  }

  // Prevent reading tests or non-src files
  const normalizedRel = path.relative(minishopDir, fullPath).replace(/\\/g, "/");
  if (!normalizedRel.startsWith("src/")) {
    throw new Error(`Reading outside of src/ is prohibited: ${relativePath}`);
  }

  const raw = fs.readFileSync(fullPath, "utf-8");
  const truncated = raw.length > maxBytes;
  const content = truncated ? raw.slice(0, maxBytes) : raw;
  const lines = content.split("\n").length;

  return {
    relativePath: normalizedRel,
    content,
    lines,
    truncated,
  };
}

export function searchSourceFiles(
  minishopDir: string,
  query: string,
  maxMatches = 30
): SearchMatch[] {
  if (!query || typeof query !== "string") return [];
  const files = listSourceFiles(minishopDir);
  const matches: SearchMatch[] = [];

  const lowerQuery = query.toLowerCase();

  for (const rel of files) {
    const fullPath = path.join(minishopDir, rel);
    try {
      const content = fs.readFileSync(fullPath, "utf-8");
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].toLowerCase().includes(lowerQuery)) {
          matches.push({
            relativePath: rel,
            lineNumber: i + 1,
            lineContent: lines[i].trimEnd(),
          });
          if (matches.length >= maxMatches) {
            return matches;
          }
        }
      }
    } catch {
      // ignore
    }
  }

  return matches;
}
