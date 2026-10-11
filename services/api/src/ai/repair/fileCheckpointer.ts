import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { MemorySaver } from "@langchain/langgraph";
import type { RunnableConfig } from "@langchain/core/runnables";
import type { Checkpoint, CheckpointMetadata, CheckpointTuple, CheckpointListOptions, PendingWrite } from "@langchain/langgraph-checkpoint";
import { ARTIFACTS_DIR } from "../../utils/paths";

function serializeWithBuffers(obj: any): string {
  return JSON.stringify(
    obj,
    (_key, value) => {
      if (value instanceof Uint8Array || Buffer.isBuffer(value)) {
        return { __type: "Buffer", data: Buffer.from(value).toString("base64") };
      }
      return value;
    },
    2
  );
}

function deserializeWithBuffers(raw: string): any {
  return JSON.parse(raw, (_key, value) => {
    if (value && typeof value === "object" && value.__type === "Buffer" && typeof value.data === "string") {
      return Uint8Array.from(Buffer.from(value.data, "base64"));
    }
    return value;
  });
}

function saveAtomicJson(filePath: string, data: any): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const tempPath = `${filePath}.${randomUUID()}.tmp`;
  const content = serializeWithBuffers(data);
  fs.writeFileSync(tempPath, content, "utf-8");

  // Atomic rename with retries for Windows file locks
  let attempts = 0;
  while (attempts < 5) {
    try {
      fs.renameSync(tempPath, filePath);
      return;
    } catch (err: any) {
      attempts++;
      if (attempts >= 5) {
        try {
          fs.copyFileSync(tempPath, filePath);
          fs.unlinkSync(tempPath);
          return;
        } catch {
          throw new Error(`Failed to persist checkpoint to ${filePath}: ${err.message}`);
        }
      }
      const waitTill = Date.now() + 50;
      while (Date.now() < waitTill) {}
    }
  }
}

/**
 * FileCheckpointSaver — LangGraph CheckpointSaver that persists memory checkpoints and pending writes to disk.
 * Allows graph state to survive process and service restarts and be resumed across threads.
 */
export class FileCheckpointSaver extends MemorySaver {
  private baseDir: string;

  constructor(baseDir: string = path.join(ARTIFACTS_DIR, "runs")) {
    super();
    this.baseDir = baseDir;
  }

  private persistThread(threadId: string, latestConfig?: RunnableConfig): void {
    const threadDir = path.join(this.baseDir, threadId);
    const cpPath = path.join(threadDir, "checkpoint.json");

    // Collect all writes matching this threadId
    const threadWrites: Record<string, any> = {};
    for (const [key, val] of Object.entries(this.writes)) {
      try {
        const parsedKey = JSON.parse(key);
        if (Array.isArray(parsedKey) && parsedKey[0] === threadId) {
          threadWrites[key] = val;
        }
      } catch {
        if (key.includes(threadId)) {
          threadWrites[key] = val;
        }
      }
    }

    const payload = {
      storage: this.storage[threadId] ?? {},
      writes: threadWrites,
      latestConfig,
      savedAt: new Date().toISOString(),
    };

    saveAtomicJson(cpPath, payload);
  }

  private loadThreadFromDisk(threadId: string): boolean {
    const cpPath = path.join(this.baseDir, threadId, "checkpoint.json");
    if (!fs.existsSync(cpPath)) return false;

    try {
      const raw = fs.readFileSync(cpPath, "utf-8");
      const data = deserializeWithBuffers(raw);

      if (data && typeof data === "object") {
        if (data.storage && typeof data.storage === "object") {
          this.storage[threadId] = data.storage;
        }
        if (data.writes && typeof data.writes === "object") {
          for (const [key, val] of Object.entries(data.writes)) {
            this.writes[key] = val as any;
          }
        }
        return true;
      }
    } catch (err: any) {
      throw new Error(`Failed to load checkpoint for thread ${threadId} from ${cpPath}: ${err.message}`);
    }

    return false;
  }

  override async put(
    config: RunnableConfig,
    checkpoint: Checkpoint,
    metadata: CheckpointMetadata
  ): Promise<RunnableConfig> {
    const threadId = config.configurable?.thread_id;
    const resultConfig = await super.put(config, checkpoint, metadata);

    if (threadId) {
      this.persistThread(threadId, resultConfig);
    }

    return resultConfig;
  }

  override async putWrites(
    config: RunnableConfig,
    writes: PendingWrite[],
    taskId: string
  ): Promise<void> {
    const threadId = config.configurable?.thread_id;
    await super.putWrites(config, writes, taskId);

    if (threadId) {
      this.persistThread(threadId, config);
    }
  }

  override async getTuple(config: RunnableConfig): Promise<CheckpointTuple | undefined> {
    const threadId = config.configurable?.thread_id;
    if (threadId && (!this.storage[threadId] || Object.keys(this.storage[threadId]).length === 0)) {
      this.loadThreadFromDisk(threadId);
    }

    return super.getTuple(config);
  }

  override async *list(config: RunnableConfig, options?: CheckpointListOptions): AsyncGenerator<CheckpointTuple> {
    const threadId = config.configurable?.thread_id;
    if (threadId && (!this.storage[threadId] || Object.keys(this.storage[threadId]).length === 0)) {
      this.loadThreadFromDisk(threadId);
    }

    yield* super.list(config, options);
  }
}
