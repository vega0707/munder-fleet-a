import test from 'node:test';
import assert from 'node:assert/strict';
import { FleetStore } from './store.ts';

test('auto-registers local runtime when empty', () => {
  const store = new FleetStore();
  const rt = store.ensureLocalRuntime({ ownerId: 'local-user', host: 'localhost' });
  assert.equal(rt.id, 'runtime:local');
  assert.equal(rt.ownerId, 'local-user');
  assert.deepEqual(rt.clis, []);
  assert.equal(store.listRuntimes().length, 1);
});

test('ensureLocalRuntime is idempotent', () => {
  const store = new FleetStore();
  const a = store.ensureLocalRuntime({ ownerId: 'local-user', host: 'localhost' });
  const b = store.ensureLocalRuntime({ ownerId: 'other', host: 'elsewhere' });
  assert.equal(a.id, b.id);
  assert.equal(store.listRuntimes().length, 1);
  assert.equal(b.ownerId, 'local-user');
});

test('create project + task with assignee', () => {
  const store = new FleetStore();
  const project = store.createProject({ name: 'P0 Demo' });
  const task = store.createTask({
    projectId: project.id,
    title: 'Ship claim spike',
    assignee: 'vega',
    prompt: 'Implement claim then complete',
  });
  assert.equal(task.status, 'todo');
  assert.equal(task.assignee, 'vega');
  assert.equal(store.listTasks(project.id).length, 1);
});

test('claim → start → complete reports back to michael', () => {
  const store = new FleetStore();
  store.ensureLocalRuntime({ ownerId: 'local-user', host: 'localhost' });
  const project = store.createProject({ name: 'P0' });
  const task = store.createTask({
    projectId: project.id,
    title: 'Do work',
    assignee: 'vega',
    prompt: 'say hi',
  });

  const claimed = store.claimTasks({
    runtimeId: 'runtime:local',
    maxTasks: 1,
  });
  assert.equal(claimed.length, 1);
  assert.equal(claimed[0].id, task.id);
  assert.equal(claimed[0].status, 'claimed');

  store.startTask(task.id);
  assert.equal(store.getTask(task.id).status, 'doing');

  const done = store.completeTask(task.id, { output: 'done: hi', reportTo: 'michael' });
  assert.equal(done.status, 'done');
  assert.equal(done.result, 'done: hi');
  assert.equal(done.reportedTo, 'michael');
});

test('pending decision routes to owner and can resolve', () => {
  const store = new FleetStore();
  const project = store.createProject({ name: 'P0' });
  const task = store.createTask({
    projectId: project.id,
    title: 'Needs human',
    assignee: 'vega',
    prompt: 'blocked',
  });
  const decision = store.createPendingDecision({
    taskId: task.id,
    kind: 'blocker',
    message: 'Need API key',
    ownerId: 'local-user',
  });
  assert.equal(decision.status, 'pending');
  assert.equal(store.listPendingDecisions({ ownerId: 'local-user' }).length, 1);
  assert.equal(store.listPendingDecisions({ ownerId: 'other' }).length, 0);

  const resolved = store.resolveDecision(decision.id, {
    resolution: 'answered',
    note: 'key is in vault',
  });
  assert.equal(resolved.status, 'resolved');
  assert.equal(store.listPendingDecisions({ ownerId: 'local-user' }).length, 0);
});

test('claim respects max_tasks and skips already claimed', () => {
  const store = new FleetStore();
  store.ensureLocalRuntime({ ownerId: 'local-user', host: 'localhost' });
  const project = store.createProject({ name: 'P0' });
  store.createTask({ projectId: project.id, title: 'A', assignee: 'vega', prompt: 'a' });
  store.createTask({ projectId: project.id, title: 'B', assignee: 'vega', prompt: 'b' });

  const first = store.claimTasks({ runtimeId: 'runtime:local', maxTasks: 1 });
  assert.equal(first.length, 1);
  const second = store.claimTasks({ runtimeId: 'runtime:local', maxTasks: 1 });
  assert.equal(second.length, 1);
  assert.notEqual(first[0].id, second[0].id);
  const third = store.claimTasks({ runtimeId: 'runtime:local', maxTasks: 1 });
  assert.equal(third.length, 0);
});
