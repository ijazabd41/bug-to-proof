import fs from "fs";
import path from "path";
import { Document } from "@langchain/core/documents";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { digest } from "../runner/integrity";
import { WORKSPACE_ROOT } from "../utils/paths";

export type CorpusScope = "source" | "documentation" | "all";
export type CorpusSourceType = "source" | "test" | "documentation";
export const SOURCES: ReadonlyArray<{ path: string; sourceType: CorpusSourceType }> = [
  { path: "README.md", sourceType: "documentation" },
  { path: "AGENTS.md", sourceType: "documentation" },
  { path: "docs/ai-workflow.md", sourceType: "documentation" },
  { path: "docs/rag-interview-guide.md", sourceType: "documentation" },
  { path: "services/api/src/ai/providers.ts", sourceType: "source" },
  { path: "services/api/src/ai/vectorIndex.ts", sourceType: "source" },
  { path: "services/api/src/ai/retrieval.ts", sourceType: "source" },
  { path: "services/api/src/ai/rag.ts", sourceType: "source" },
  { path: "services/api/src/ai/debugAgent.ts", sourceType: "source" },
  { path: "apps/minishop/src/store/cartStore.ts", sourceType: "source" },
  { path: "apps/minishop/src/components/Cart.tsx", sourceType: "source" },
  { path: "apps/minishop/src/data/products.ts", sourceType: "source" },
  { path: "tests/playwright/cases/case-001-cart-total.spec.ts", sourceType: "test" },
  { path: "services/api/src/runner/playwrightRunner.ts", sourceType: "source" },
  { path: "services/api/src/runner/integrity.ts", sourceType: "source" },
  { path: "services/api/src/runner/classification.ts", sourceType: "source" },
  { path: "services/api/src/runner/record.ts", sourceType: "source" },
];
export interface CorpusChunk {
  source: string; sourceType: CorpusSourceType; chunkId: string; content: string;
  startLine: number; endLine: number; sourceHash: string;
}
export async function loadCorpus(chunkSize: number, chunkOverlap: number, scope: CorpusScope = "source") {
  const root = fs.realpathSync(WORKSPACE_ROOT);
  const splitter = new RecursiveCharacterTextSplitter({ chunkSize, chunkOverlap });
  const chunks: CorpusChunk[] = [];
  const sourceHashes: [string, string][] = [];
  const selected = SOURCES.filter(({ sourceType }) => scope === "all" || (scope === "documentation" ? sourceType === "documentation" : sourceType !== "documentation"));
  for (const entry of selected) {
    const source = entry.path;
    const target = path.join(root, source);
    if (!fs.existsSync(target)) continue;
    const file = fs.realpathSync(target);
    if (!file.startsWith(root + path.sep)) throw new Error("Corpus source escapes workspace");
    const text = fs.readFileSync(file, "utf8");
    const sourceHash = digest(text);
    sourceHashes.push([source, sourceHash]);
    const parts = await splitter.splitText(text);
    let previousStart = 0;
    for (const content of parts) {
      let position = text.indexOf(content, previousStart);
      if (position < 0) position = text.indexOf(content);
      if (position < 0) throw new Error("Cannot locate source chunk");
      previousStart = position + 1;
      const startLine = text.slice(0, position).split("\n").length;
      const endLine = startLine + content.split("\n").length - 1;
      chunks.push({
        source, sourceType: entry.sourceType, sourceHash, content, startLine, endLine,
        chunkId: digest(JSON.stringify([source, sourceHash, startLine, content])).slice(0, 12),
      });
    }
  }
  if (!chunks.length) throw new Error("No allowed corpus sources");
  return {
    chunks,
    fingerprint: digest(JSON.stringify({ version: 2, scope, sourceHashes, chunkSize, chunkOverlap })),
    documents: chunks.map((chunk) => new Document({ pageContent: chunk.content, metadata: chunk })),
  };
}
