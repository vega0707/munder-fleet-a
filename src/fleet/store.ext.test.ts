import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FleetStore } from './store.ts';

test('sqlite persistence survives reopen', () => {
  const dir = mkdtempSync(join(tmpdir(), 'fleet-'));
  const dbPath = join(dir, 'fleet.db');
  const a = new FleetStore({ dbPath });
  a.ensureLocalRuntime({ ownerId: 'local-user', host: 'h1' });
  const p = a.createProject({ name: 'Persist' });
  a.createTask({ projectId: p.id, title: 'T', assignee: 'vega', prompt: 'p' });
  assert.equal(a.listTasks().length, 1);

  const b = new FleetStore({ dbPath });
  assert.equal(b.listRuntimes().length, 1);
  assert.equal(b.listProjects().length, 1);
  assert.equal(b.listTasks().length, 1);
  assert.equal(b.listTasks()[0].title, 'T');
});

test('decision gate blocks new claims while owner has pending', () => {
  const store = new FleetStore();
  store.ensureLocalRuntime({ ownerId: 'local-user', host: 'localhost' });
  const project = store.createProject({ name: 'G' });
  const t1 = store.createTask({ projectId: project.id, title: 'A', assignee: 'vega', prompt: 'a' });
  store.createTask({ projectId: project.id, title: 'B', assignee: 'vega', prompt: 'b' });
  store.createPendingDecision({
    taskId: t1.id,
    kind: 'blocker',
    message: 'need key',
    ownerId: 'local-user',
  });
  assert.throws(
    () => store.claimTasks({ runtimeId: 'runtime:local', maxTasks: 1 }),
    /decision.?gate/i,
  );
});

test('multi-runtime register + heartbeat + concurrent cap', () => {
  const store = new FleetStore();
  const rt1 = store.registerRuntime({
    id: 'runtime:a',
    host: 'host-a',
    ownerId: 'owner-a',
    clis: [{ provider: 'claude' }],
    maxConcurrentTasks: 1,
    daemonId: 'daemon-a',
  });
  const rt2 = store.registerRuntime({
    id: 'runtime:b',
    host: 'host-b',
    ownerId: 'owner-b',
    clis: [{ provider: 'codex' }],
    maxConcurrentTasks: 2,
    daemonId: 'daemon-b',
  });
  assert.equal(store.listRuntimes().length, 2);
  assert.equal(store.heartbeat(rt1.id).status, 'ok');

  const project = store.createProject({ name: 'Multi' });
  store.createTask({ projectId: project.id, title: '1', assignee: 'a', prompt: '1' });
  store.createTask({ projectId: project.id, title: '2', assignee: 'a', prompt: '2' });
  const c1 = store.claimTasks({ runtimeId: rt1.id, maxTasks: 5 });
  assert.equal(c1.length, 1, 'cap maxConcurrentTasks=1');
  const c2 = store.claimTasks({ runtimeId: rt2.id, maxTasks: 5 });
  assert.equal(c2.length, 1);
});

test('manual claim by taskId', () => {
  const store = new FleetStore();
  store.ensureLocalRuntime({ ownerId: 'local-user', host: 'localhost' });
  const project = store.createProject({ name: 'M' });
  const a = store.createTask({ projectId: project.id, title: 'A', assignee: 'v', prompt: 'a' });
  const b = store.createTask({ projectId: project.id, title: 'B', assignee: 'v', prompt: 'b' });
  const claimed = store.claimTasks({ runtimeId: 'runtime:local', maxTasks: 1, taskId: b.id });
  assert.equal(claimed.length, 1);
  assert.equal(claimed[0].id, b.id);
  assert.equal(store.getTask(a.id).status, 'todo');
});

test('complete writes michael inbox + execution log', () => {
  const store = new FleetStore();
  store.ensureLocalRuntime({ ownerId: 'local-user', host: 'localhost' });
  const project = store.createProject({ name: 'M' });
  const task = store.createTask({ projectId: project.id, title: 'T', assignee: 'v', prompt: 'hi' });
  store.claimTasks({ runtimeId: 'runtime:local', maxTasks: 1 });
  store.startTask(task.id);
  store.completeTask(task.id, { output: 'done', reportTo: 'michael' });
  const inbox = store.listMichaelInbox();
  assert.ok(inbox.some((i) => i.kind === 'task_completed' && i.taskId === task.id));
  const logs = store.listExecutionLogs({ taskId: task.id });
  assert.ok(logs.some((l) => l.event === 'completed'));
});

test('hive import maps assignee statuses', () => {
  const store = new FleetStore();
  const project = store.createProject({ name: 'Hive' });
  const imported = store.importHiveTasks(project.id, [
    {
      id: 'hive-1',
      title: 'From hive',
      assignee: 'vega',
      status: 'doing',
      priority: 2,
      result: 'partial',
    },
  ]);
  assert.equal(imported.length, 1);
  assert.equal(imported[0].id, 'hive-1');
  assert.equal(imported[0].status, 'doing');
  assert.equal(imported[0].assignee, 'vega');
});

test('board lists others in-progress without changing assignee model', () => {
  const store = new FleetStore();
  store.ensureLocalRuntime({ ownerId: 'local-user', host: 'localhost' });
  const project = store.createProject({ name: 'Board' });
  const mine = store.createTask({ projectId: project.id, title: 'Mine', assignee: 'vega', prompt: 'm' });
  const theirs = store.createTask({
    projectId: project.id,
    title: 'Theirs',
    assignee: 'alice',
    prompt: 't',
  });
  store.claimTasks({ runtimeId: 'runtime:local', maxTasks: 1, taskId: theirs.id });
  store.startTask(theirs.id);
  const visible = store.listTasks(project.id);
  assert.equal(visible.find((t) => t.id === theirs.id)?.status, 'doing');
  assert.equal(visible.find((t) => t.id === mine.id)?.assignee, 'vega');
});
