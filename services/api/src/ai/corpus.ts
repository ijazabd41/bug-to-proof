import fs from "fs";
import path from "path";
import { Document } from "@langchain/core/documents";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { digest } from "../runner/integrity";
import { WORKSPACE_ROOT } from "../utils/paths";

export const SOURCES = [
  "README.md", "AGENTS.md", "docs/ai-workflow.md", "docs/rag-interview-guide.md",
  "services/api/src/ai/providers.ts", "services/api/src/ai/vectorIndex.ts",
  "services/api/src/ai/retrieval.ts", "services/api/src/ai/rag.ts",
  "services/api/src/ai/debugAgent.ts",
  "apps/minishop/src/store/cartStore.ts", "apps/minishop/src/components/Cart.tsx",
  "apps/minishop/src/data/products.ts", "tests/playwright/cases/case-001-cart-total.spec.ts",
  "services/api/src/runner/playwrightRunner.ts", "services/api/src/runner/integrity.ts",
  "services/api/src/runner/classification.ts", "services/api/src/runner/record.ts",
];
export interface CorpusChunk {
  source: string; chunkId: string; content: string;
  startLine: number; endLine: number; sourceHash: string;
}
export async function loadCorpus(chunkSize: number, chunkOverlap: number) {
  const root = fs.realpathSync(WORKSPACE_ROOT);
  const splitter = new RecursiveCharacterTextSplitter({ chunkSize, chunkOverlap });
  const chunks: CorpusChunk[] = [];
  const sourceHashes: [string, string][] = [];
  for (const source of SOURCES) {
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
        source, sourceHash, content, startLine, endLine,
        chunkId: digest(JSON.stringify([source, sourceHash, startLine, content])).slice(0, 12),
      });
    }
  }
  if (!chunks.length) throw new Error("No allowed corpus sources");
  return {
    chunks,
    fingerprint: digest(JSON.stringify({ version: 1, sourceHashes, chunkSize, chunkOverlap })),
    documents: chunks.map((chunk) => new Document({ pageContent: chunk.content, metadata: chunk })),
  };
}
