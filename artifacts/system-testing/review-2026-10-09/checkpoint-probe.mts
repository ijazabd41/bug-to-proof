import fs from 'node:fs';
import path from 'node:path';
import { Annotation, StateGraph, START, END, interrupt, Command } from '@langchain/langgraph';
import { FileCheckpointSaver } from '../../../services/api/src/ai/repair/fileCheckpointer.ts';

const root = path.resolve('artifacts/system-testing/review-2026-10-09');
fs.mkdirSync(root, { recursive: true });
const base = path.join(root, 'checkpoint-probe-data');
const thread = `probe-${Date.now()}`;
const schema = Annotation.Root({ value: Annotation<string>() });
function make(saver: FileCheckpointSaver) {
  return new StateGraph(schema)
    .addNode('review', () => ({ value: interrupt('approve') as string }))
    .addEdge(START, 'review').addEdge('review', END)
    .compile({ checkpointer: saver });
}
const config = { configurable: { thread_id: thread } };
const firstSaver = new FileCheckpointSaver(base);
const first = make(firstSaver);
const paused = await first.invoke({ value: 'pending' }, config);
const firstTuple = await firstSaver.getTuple(config);
const restartedSaver = new FileCheckpointSaver(base);
const restartedTuple = await restartedSaver.getTuple(config);
let resumed: unknown;
let error: string | undefined;
try { resumed = await make(restartedSaver).invoke(new Command({ resume: 'approved' }), config); }
catch (e) { error = String(e); }
const result = {
  scope: 'Minimal LangGraph interrupt with a fresh FileCheckpointSaver; no application/browser/model execution',
  thread, paused,
  memoryPendingWrites: firstTuple?.pendingWrites?.length ?? 0,
  reloadedPendingWrites: restartedTuple?.pendingWrites?.length ?? 0,
  resumed, error,
};
fs.writeFileSync(path.join(root, 'checkpoint-probe-result.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
