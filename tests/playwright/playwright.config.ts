import { defineConfig, devices } from "@playwright/test";
import path from "path";

const PHASE = process.env.PHASE ?? "before";
const CASE_ID = process.env.CASE_ID ?? "case-001";

export default defineConfig({
  testDir: "./cases",
  timeout: parseInt(process.env.PLAYWRIGHT_TIMEOUT ?? "30000", 10),
  retries: 0,
  workers: 1,
  webServer: process.env.MINISHOP_BASE_URL ? undefined : {
    command: "npm run dev:minishop",
    cwd: path.resolve(__dirname, "../.."),
    url: "http://localhost:5174/",
    reuseExistingServer: false,
    timeout: 30_000,
  },

  use: {
    baseURL: process.env.MINISHOP_BASE_URL ?? "http://localhost:5174",
    screenshot: "on",
    trace: "on",
  },

  outputDir: process.env.BTP_ARTIFACT_DIR
    ? path.resolve(process.env.BTP_ARTIFACT_DIR)
    : path.resolve(
        __dirname,
        "../../artifacts",
        CASE_ID,
        PHASE
      ),

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
