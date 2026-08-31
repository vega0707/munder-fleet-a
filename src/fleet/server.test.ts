import test from 'node:test';
import assert from 'node:assert/strict';
import { createFleetServer, LOOPBACK_AUTH_CONTRACT } from './server.ts';
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
    coreBaseUrl: null,
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

test('loopback contract is frozen and claim-and-work runs subprocess', async () => {
  await withServer('loopback', async (base) => {
    const health = await fetch(`${base}/health`).then((r) => r.json());
    assert.equal(health.loopbackContract.frozen, true);
    assert.equal(LOOPBACK_AUTH_CONTRACT.requiresCredentials, false);

    const boot = await fetch(`${base}/api/fleet/bootstrap`).then((r) => r.json());
    assert.equal(boot.runtime.id, 'runtime:local');

    const project = await fetch(`${base}/api/fleet/projects`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Demo' }),
    }).then((r) => r.json());

    await fetch(`${base}/api/fleet/tasks`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        projectId: project.id,
        title: 'Claim me',
        assignee: 'vega',
        prompt: 'work',
      }),
    });

    const worked = await fetch(`${base}/api/fleet/tasks/claim-and-work`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ runtimeId: 'runtime:local', maxTasks: 1 }),
    }).then((r) => r.json());
    assert.equal(worked.tasks[0].status, 'done');
    assert.equal(worked.tasks[0].reportedTo, 'michael');
    assert.match(worked.tasks[0].result, /munder-worker/);
    assert.ok(worked.michaelInbox.length >= 1);
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
    const cookie =
      setCookie.map((c) => c.split(';')[0]).join('; ') ||
      (login.headers.get('set-cookie') ?? '')
        .split(',')
        .map((c) => c.split(';')[0].trim())
        .join('; ');
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

test('decision gate returns 409 on claim', async () => {
  await withServer('loopback', async (base) => {
    const project = await fetch(`${base}/api/fleet/projects`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Gate' }),
    }).then((r) => r.json());
    const task = await fetch(`${base}/api/fleet/tasks`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        projectId: project.id,
        title: 'Blocked',
        assignee: 'vega',
        prompt: 'x',
      }),
    }).then((r) => r.json());
    await fetch(`${base}/api/fleet/decisions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        taskId: task.id,
        kind: 'blocker',
        message: 'need human',
        ownerId: 'local-user',
      }),
    });
    const res = await fetch(`${base}/api/fleet/tasks/claim`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ runtimeId: 'runtime:local', maxTasks: 1 }),
    });
    assert.equal(res.status, 409);
  });
});
