import path from "path";

/**
 * Workspace root — resolved relative to this file's location.
 * services/api/src/utils/paths.ts → up 4 levels → workspace root
 */
export const WORKSPACE_ROOT = path.resolve(__dirname, "../../../../");

export const DATA_DIR = path.resolve(
  WORKSPACE_ROOT,
  process.env.DATA_DIR ?? "./data",
  "cases"
);

export const ARTIFACTS_DIR = path.resolve(
  WORKSPACE_ROOT,
  process.env.ARTIFACTS_DIR ?? "./artifacts"
);
