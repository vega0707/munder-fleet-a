import test from 'node:test';
import assert from 'node:assert/strict';
import { createFleetServer } from './server.ts';
import { FleetStore } from './store.ts';

async function withServer(
  mode: 'loopback' | 'web',
  fn: (base: string) => Promise<void>,
): Promise<void> {
  const store = new FleetStore();
  const server = await createFleetServer({
    store,
    host: '127.0.0.1',
    port: 0,
    authMode: mode,
    coreHealthUrl: null,
  });
  const addr = server.address();
  assert.ok(addr && typeof addr === 'object');
  const base = `http://127.0.0.1:${addr.port}`;
  try {
    await fn(base);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
}

test('loopback: auto runtime + claim complete without login', async () => {
  await withServer('loopback', async (base) => {
    const boot = await fetch(`${base}/api/fleet/bootstrap`).then((r) => r.json());
    assert.equal(boot.runtime.id, 'runtime:local');
    assert.equal(boot.authMode, 'loopback');
    assert.equal(boot.user.id, 'local-user');

    const project = await fetch(`${base}/api/fleet/projects`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Demo' }),
    }).then((r) => r.json());

    const task = await fetch(`${base}/api/fleet/tasks`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        projectId: project.id,
        title: 'Claim me',
        assignee: 'vega',
        prompt: 'work',
      }),
    }).then((r) => r.json());

    const claimed = await fetch(`${base}/api/fleet/tasks/claim`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ runtimeId: 'runtime:local', maxTasks: 1 }),
    }).then((r) => r.json());
    assert.equal(claimed.tasks[0].id, task.id);

    await fetch(`${base}/api/fleet/tasks/${task.id}/start`, { method: 'POST' });
    const done = await fetch(`${base}/api/fleet/tasks/${task.id}/complete`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ output: 'ok' }),
    }).then((r) => r.json());
    assert.equal(done.status, 'done');
    assert.equal(done.reportedTo, 'michael');
  });
});

test('web mode rejects mutating calls without session', async () => {
  await withServer('web', async (base) => {
    const res = await fetch(`${base}/api/fleet/projects`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'X' }),
    });
    assert.equal(res.status, 401);
  });
});

test('web mode accepts session cookie after login', async () => {
  await withServer('web', async (base) => {
    const login = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'owner', password: 'owner' }),
    });
    assert.equal(login.status, 200);
    const setCookie = login.headers.getSetCookie?.() ?? [];
    const cookie = setCookie.map((c) => c.split(';')[0]).join('; ') ||
      (login.headers.get('set-cookie') ?? '').split(',').map((c) => c.split(';')[0].trim()).join('; ');
    assert.ok(cookie.includes('munder-session='));

    const project = await fetch(`${base}/api/fleet/projects`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ name: 'Authed' }),
    }).then(async (r) => {
      assert.equal(r.status, 200);
      return r.json();
    });
    assert.equal(project.name, 'Authed');
  });
});
