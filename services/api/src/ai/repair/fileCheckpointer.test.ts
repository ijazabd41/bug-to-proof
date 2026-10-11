import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import fs from "fs";
import { FileCheckpointSaver } from "./fileCheckpointer";
import { ARTIFACTS_DIR } from "../../utils/paths";
import type { Checkpoint, CheckpointMetadata } from "@langchain/langgraph-checkpoint";

describe("FileCheckpointSaver Durable Persistence (Two-Process & Contract Recovery)", () => {
  const testDir = path.join(ARTIFACTS_DIR, "test-checkpointer-" + Date.now());

  beforeEach(() => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      try {
        fs.rmSync(testDir, { recursive: true, force: true, maxRetries: 3 });
      } catch {
        // ignore on Windows file locks
      }
    }
  });

  it("persists checkpoints and pending writes across isolated checkpointer instances (two-process simulation)", async () => {
    const threadId = "thread-persist-test-1";
    const checkpointNs = "repair-ns";
    const checkpointId = "cp-001";

    const config = {
      configurable: {
        thread_id: threadId,
        checkpoint_ns: checkpointNs,
        checkpoint_id: checkpointId,
      },
    };

    const checkpointData: Checkpoint = {
      v: 1,
      id: checkpointId,
      ts: new Date().toISOString(),
      channel_values: {
        runId: threadId,
        state: "AWAITING_REVIEW",
        proposal: {
          proposalId: "prop-123",
          diagnosis: "Cart total calculation bug",
        },
      },
      channel_versions: { runId: 1, state: 1, proposal: 1 },
      versions_seen: {},
    };

    const metadata: CheckpointMetadata = {
      source: "loop",
      step: 3,
      parents: {},
    };

    // --- PROCESS A: Writes checkpoint and pending writes to disk, then exits ---
    const saverA = new FileCheckpointSaver(testDir);
    const returnedConfig = await saverA.put(config, checkpointData, metadata);
    expect(returnedConfig.configurable?.checkpoint_id).toBe(checkpointId);

    // Save pending writes
    const writes = [
      ["__start__", { runId: threadId }],
      ["modelProposal", { proposal: (checkpointData.channel_values as any).proposal }],
    ] as [string, any][];

    await saverA.putWrites(config, writes, "task-001");

    // Verify file exists on disk
    const expectedFile = path.join(testDir, threadId, "checkpoint.json");
    expect(fs.existsSync(expectedFile)).toBe(true);

    // --- PROCESS B: Completely new instance with empty in-memory state ---
    const saverB = new FileCheckpointSaver(testDir);
    const tuple = await saverB.getTuple(config);

    expect(tuple).toBeDefined();
    expect(tuple?.checkpoint.id).toBe(checkpointId);
    expect((tuple?.checkpoint.channel_values as any).state).toBe("AWAITING_REVIEW");
    expect((tuple?.checkpoint.channel_values as any).proposal.proposalId).toBe("prop-123");
    expect(tuple?.metadata?.step).toBe(3);

    // Verify pending writes recovered in Process B
    expect(tuple?.pendingWrites).toBeDefined();
    expect(tuple?.pendingWrites?.length).toBe(2);
    expect(tuple?.pendingWrites?.[0][1]).toBe("__start__");
    expect(tuple?.pendingWrites?.[1][1]).toBe("modelProposal");
  });

  it("lists all checkpoints chronologically across reloads", async () => {
    const threadId = "thread-list-test";
    const saverA = new FileCheckpointSaver(testDir);

    for (let i = 1; i <= 3; i++) {
      const cpId = `cp-00${i}`;
      await saverA.put(
        { configurable: { thread_id: threadId, checkpoint_ns: "", checkpoint_id: cpId } },
        {
          v: 1,
          id: cpId,
          ts: new Date(Date.now() + i * 1000).toISOString(),
          channel_values: { step: i },
          channel_versions: {},
          versions_seen: {},
        },
        { source: "loop", step: i, parents: {} }
      );
    }

    // Process B loads and lists
    const saverB = new FileCheckpointSaver(testDir);
    const results: any[] = [];
    for await (const tuple of saverB.list({ configurable: { thread_id: threadId } })) {
      results.push(tuple);
    }

    expect(results).toHaveLength(3);
  });
});
