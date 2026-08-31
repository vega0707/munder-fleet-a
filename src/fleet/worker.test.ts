import test from 'node:test';
import assert from 'node:assert/strict';
import { FleetStore } from './store.ts';
import { claimAndWork, runLocalWork } from './worker.ts';

test('runLocalWork spawns subprocess and returns output', async () => {
  const result = await runLocalWork({
    id: 'task_x',
    projectId: 'p',
    title: 'Hello',
    status: 'doing',
    prompt: 'say hi',
    priority: 0,
    createdAt: new Date().toISOString(),
  });
  assert.equal(result.ok, true);
  assert.match(result.output, /munder-worker: done/);
  assert.ok(result.tokensOut > 0);
});

test('claimAndWork completes and notifies michael', async () => {
  const store = new FleetStore();
  store.ensureLocalRuntime({ ownerId: 'local-user', host: 'localhost' });
  const project = store.createProject({ name: 'W' });
  store.createTask({ projectId: project.id, title: 'Work', assignee: 'vega', prompt: 'do it' });
  const done = await claimAndWork(store, { runtimeId: 'runtime:local' });
  assert.equal(done.length, 1);
  assert.equal(done[0].status, 'done');
  assert.equal(done[0].reportedTo, 'michael');
  assert.match(done[0].result ?? '', /munder-worker/);
  assert.ok(store.listMichaelInbox().some((i) => i.kind === 'task_completed'));
});
