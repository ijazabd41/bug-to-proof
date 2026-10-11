process.env.VITE_CONFIG_NATIVE_IGNORE_WARNING = "true";

import { defineConfig } from "vitest/config";
import projects from "./vitest.workspace";
export default defineConfig({
  test: {
    projects,
    exclude: ["**/node_modules/**", "**/dist/**", "**/tests/playwright/**"],
    fileParallelism: false,
  },
});
