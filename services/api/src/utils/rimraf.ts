import fs from "fs";
import path from "path";

/** Recursively remove a directory if it exists. Safe no-op if missing. */
export function rimrafDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) return;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      rimrafDir(fullPath);
    } else {
      fs.unlinkSync(fullPath);
    }
  }
  fs.rmdirSync(dirPath);
}
