import fs from "fs";
import { debugCase } from "../services/api/src/ai/debugAgent";
async function main() {
  const result = await debugCase("case-001", true);
  fs.writeFileSync("artifacts/portfolio-agent.json", JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ outcome: result.outcome, events: result.events, artifactPath: result.artifactPath }, null, 2));
  process.exitCode = result.outcome === "VERIFIED" ? 0 : 1;
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
