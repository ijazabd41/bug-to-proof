import { defineConfig, devices } from "@playwright/test";
import path from "path";

const PHASE = process.env.PHASE ?? "before";
const CASE_ID = process.env.CASE_ID ?? "case-001";

export default defineConfig({
  testDir: "./cases",
  timeout: parseInt(process.env.PLAYWRIGHT_TIMEOUT ?? "30000", 10),
  retries: 0,
  workers: 1,

  use: {
    baseURL: "http://localhost:5174",
    screenshot: "on",
    trace: "on",
  },

  outputDir: path.resolve(
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
