import { runArtifactCleanup } from "../services/api/src/utils/cleanupArtifacts";

if (require.main === module) {
  const force = process.argv.includes("--force") || process.argv.includes("--execute");
  runArtifactCleanup({ force }).catch((err) => {
    console.error("Artifact cleanup failed:", err);
    process.exit(1);
  });
}
