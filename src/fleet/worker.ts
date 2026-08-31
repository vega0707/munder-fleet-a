import { spawn } from 'node:child_process';
import type { Task } from '../types.ts';
import type { FleetStore } from './store.ts';

export interface WorkResult {
  ok: boolean;
  output: string;
  tokensIn: number;
  tokensOut: number;
}

/**
 * Local "干活" runner — Multica-semantic execution without vendoring Multica.
 * Spawns a real subprocess that processes the task prompt (stub CLI).
 * Replace command with real agent CLIs later; do not guess CLI wire protocols.
 */
export async function runLocalWork(task: Task): Promise<WorkResult> {
  const script = `
const prompt = process.argv[1] || '';
const title = process.argv[2] || '';
const started = Date.now();
process.stdout.write('munder-worker: start ' + title + '\\n');
process.stdout.write('munder-worker: prompt ' + prompt.slice(0, 200) + '\\n');
setTimeout(() => {
  process.stdout.write('munder-worker: done in ' + (Date.now() - started) + 'ms\\n');
}, 30);
`;
  const output = await new Promise<string>((resolve, reject) => {
    const child = spawn(process.execPath, ['-e', script, task.prompt, task.title], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (c) => {
      stdout += String(c);
    });
    child.stderr.on('data', (c) => {
      stderr += String(c);
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(stderr || `worker exit ${code}`));
    });
  });
  return {
    ok: true,
    output,
    tokensIn: Math.ceil(task.prompt.length / 4),
    tokensOut: Math.ceil(output.length / 4),
  };
}

/** Claim → start → subprocess → complete (or fail), reporting to Michael. */
export async function claimAndWork(
  store: FleetStore,
  opts: { runtimeId: string; maxTasks?: number; taskId?: string },
): Promise<Task[]> {
  const claimed = store.claimTasks({
    runtimeId: opts.runtimeId,
    maxTasks: opts.maxTasks ?? 1,
    taskId: opts.taskId,
  });
  const done: Task[] = [];
  for (const task of claimed) {
    store.startTask(task.id);
    try {
      const result = await runLocalWork(task);
      done.push(
        store.completeTask(task.id, {
          output: result.output,
          reportTo: 'michael',
          tokensIn: result.tokensIn,
          tokensOut: result.tokensOut,
        }),
      );
    } catch (err) {
      done.push(
        store.failTask(task.id, {
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }
  return done;
}
