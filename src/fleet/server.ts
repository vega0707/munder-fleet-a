import http from 'node:http';
import { hostname } from 'node:os';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { FleetStore } from './store.ts';
import { claimAndWork } from './worker.ts';
import type { PendingDecisionKind } from '../types.ts';

export type AuthMode = 'loopback' | 'web';

export interface FleetServerOptions {
  store: FleetStore;
  host?: string;
  port?: number;
  authMode: AuthMode;
  /** AionCore base URL, e.g. http://127.0.0.1:25808 */
  coreBaseUrl?: string | null;
  localOwnerId?: string;
}

interface SessionUser {
  id: string;
  username: string;
  source: 'loopback' | 'core' | 'local';
  coreToken?: string;
}

/** Frozen Electron/loopback contract — never requires credentials. */
export const LOOPBACK_AUTH_CONTRACT = {
  mode: 'loopback' as const,
  requiresCredentials: false,
  defaultUserId: 'local-user',
  frozen: true,
};

const WEB_USERS: Record<string, { password: string; id: string }> = {
  owner: { password: 'owner', id: 'local-user' },
};

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function readJson<T>(req: IncomingMessage): Promise<T> {
  const raw = await readBody(req);
  if (!raw) return {} as T;
  return JSON.parse(raw) as T;
}

function send(res: ServerResponse, status: number, body: unknown, extraHeaders?: Record<string, string>): void {
  const payload = status === 204 ? '' : JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'access-control-allow-headers':
      'content-type, authorization, cookie, x-munder-loopback, x-csrf-token',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-credentials': 'true',
    ...extraHeaders,
  });
  res.end(payload);
}

function parseCookies(req: IncomingMessage): Record<string, string> {
  const header = req.headers.cookie ?? '';
  const out: Record<string, string> = {};
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (!k) continue;
    out[k] = decodeURIComponent(rest.join('=') || '');
  }
  return out;
}

function encodeSession(user: SessionUser): string {
  return Buffer.from(JSON.stringify(user)).toString('base64url');
}

function decodeSession(token: string): SessionUser | null {
  try {
    const parsed = JSON.parse(Buffer.from(token, 'base64url').toString('utf8')) as SessionUser;
    if (parsed?.id && parsed?.username) return parsed;
  } catch {
    /* ignore */
  }
  return null;
}

function sessionUser(req: IncomingMessage, authMode: AuthMode, localOwnerId: string): SessionUser | null {
  if (authMode === 'loopback') {
    return {
      id: localOwnerId,
      username: 'local-owner',
      source: 'loopback',
    };
  }
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) {
    const bearer = auth.slice('Bearer '.length);
    const fromCookieShape = decodeSession(bearer);
    if (fromCookieShape) return fromCookieShape;
    // Opaque Core JWT carried as session later
  }
  const cookies = parseCookies(req);
  const token = cookies['munder-session'];
  if (!token) return null;
  return decodeSession(token);
}

function requireUser(
  req: IncomingMessage,
  res: ServerResponse,
  authMode: AuthMode,
  localOwnerId: string,
): SessionUser | null {
  const user = sessionUser(req, authMode, localOwnerId);
  if (!user) {
    send(res, 401, { error: 'unauthorized' });
    return null;
  }
  return user;
}

async function coreFetch(
  coreBaseUrl: string,
  path: string,
  init?: RequestInit & { cookieJar?: string },
): Promise<{ status: number; body: unknown; setCookie: string[] }> {
  const headers = new Headers(init?.headers);
  if (init?.cookieJar) headers.set('cookie', init.cookieJar);
  const r = await fetch(`${coreBaseUrl}${path}`, {
    ...init,
    headers,
    signal: AbortSignal.timeout(5000),
  });
  const setCookie = typeof r.headers.getSetCookie === 'function' ? r.headers.getSetCookie() : [];
  const text = await r.text();
  let body: unknown = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  return { status: r.status, body, setCookie };
}

export async function createFleetServer(opts: FleetServerOptions): Promise<http.Server> {
  const store = opts.store;
  const authMode = opts.authMode;
  const localOwnerId = opts.localOwnerId ?? LOOPBACK_AUTH_CONTRACT.defaultUserId;
  const coreBaseUrl = opts.coreBaseUrl ?? null;
  const coreHealthUrl = coreBaseUrl ? `${coreBaseUrl}/health` : null;

  store.ensureLocalRuntime({
    ownerId: localOwnerId,
    host: hostname(),
    clis: [{ provider: 'claude' }, { provider: 'codex' }, { provider: 'cursor' }],
  });

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', `http://${req.headers.host ?? '127.0.0.1'}`);
      const method = req.method ?? 'GET';

      if (method === 'OPTIONS') {
        send(res, 204, {});
        return;
      }

      if (method === 'GET' && url.pathname === '/health') {
        send(res, 200, {
          status: 'ok',
          service: 'munder-fleet',
          authMode,
          loopbackContract: authMode === 'loopback' ? LOOPBACK_AUTH_CONTRACT : undefined,
        });
        return;
      }

      if (method === 'GET' && url.pathname === '/api/auth/status') {
        const user = sessionUser(req, authMode, localOwnerId);
        send(res, 200, {
          authMode,
          authenticated: authMode === 'loopback' || !!user,
          requiresCredentials: authMode === 'web',
          loopbackFrozen: LOOPBACK_AUTH_CONTRACT.frozen,
          coreConfigured: !!coreBaseUrl,
          user: user ?? (authMode === 'loopback' ? { id: localOwnerId, username: 'local-owner' } : null),
        });
        return;
      }

      if (method === 'POST' && url.pathname === '/api/auth/login') {
        if (authMode === 'loopback') {
          send(res, 200, {
            user: { id: localOwnerId, username: 'local-owner', source: 'loopback' },
            authMode,
            loopbackContract: LOOPBACK_AUTH_CONTRACT,
          });
          return;
        }
        const body = await readJson<{ username?: string; password?: string }>(req);

        // Prefer AionCore JWT when Core is configured and reachable.
        if (coreBaseUrl) {
          try {
            const status = await coreFetch(coreBaseUrl, '/api/auth/status');
            const cookieJar = status.setCookie.map((c) => c.split(';')[0]).join('; ');
            const login = await coreFetch(coreBaseUrl, '/login', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              cookieJar,
              body: JSON.stringify({
                username: body.username,
                password: body.password,
              }),
            });
            if (login.status === 200) {
              const loginBody = login.body as {
                token?: string;
                user?: { id?: string; username?: string };
              };
              const user: SessionUser = {
                id: loginBody.user?.id ?? localOwnerId,
                username: loginBody.user?.username ?? body.username ?? 'admin',
                source: 'core',
                coreToken: loginBody.token,
              };
              send(res, 200, { user, authMode, source: 'core', token: loginBody.token }, {
                'set-cookie': `munder-session=${encodeSession(user)}; Path=/; HttpOnly; SameSite=Lax`,
              });
              return;
            }
          } catch {
            // fall through to local stub
          }
        }

        const record = body.username ? WEB_USERS[body.username] : undefined;
        if (!record || record.password !== body.password) {
          send(res, 401, { error: 'invalid credentials' });
          return;
        }
        const user: SessionUser = { id: record.id, username: body.username!, source: 'local' };
        send(res, 200, { user, authMode, source: 'local' }, {
          'set-cookie': `munder-session=${encodeSession(user)}; Path=/; HttpOnly; SameSite=Lax`,
        });
        return;
      }

      if (method === 'GET' && url.pathname === '/api/auth/user') {
        const user = requireUser(req, res, authMode, localOwnerId);
        if (!user) return;
        if (user.source === 'core' && user.coreToken && coreBaseUrl) {
          try {
            const r = await coreFetch(coreBaseUrl, '/api/auth/user', {
              headers: { Authorization: `Bearer ${user.coreToken}` },
            });
            if (r.status === 200) {
              send(res, 200, r.body);
              return;
            }
          } catch {
            /* fallthrough */
          }
        }
        send(res, 200, { success: true, user });
        return;
      }

      if (method === 'GET' && url.pathname === '/api/core/health') {
        if (!coreHealthUrl) {
          send(res, 200, { available: false, reason: 'coreBaseUrl not configured' });
          return;
        }
        try {
          const r = await fetch(coreHealthUrl, { signal: AbortSignal.timeout(2000) });
          const body = await r.json();
          send(res, 200, { available: r.ok, status: r.status, body });
        } catch (err) {
          send(res, 200, {
            available: false,
            reason: err instanceof Error ? err.message : String(err),
          });
        }
        return;
      }

      if (method === 'GET' && url.pathname === '/api/fleet/bootstrap') {
        const user = requireUser(req, res, authMode, localOwnerId);
        if (!user) return;
        const runtime = store.ensureLocalRuntime({
          ownerId: user.id,
          host: hostname(),
        });
        send(res, 200, { runtime, authMode, user, loopbackContract: LOOPBACK_AUTH_CONTRACT });
        return;
      }

      if (method === 'GET' && url.pathname === '/api/fleet/runtimes') {
        if (!requireUser(req, res, authMode, localOwnerId)) return;
        send(res, 200, { runtimes: store.listRuntimes() });
        return;
      }

      if (method === 'POST' && url.pathname === '/api/fleet/runtimes/register') {
        if (!requireUser(req, res, authMode, localOwnerId)) return;
        const body = await readJson<{
          id?: string;
          ownerId?: string;
          host?: string;
          daemonId?: string;
          maxConcurrentTasks?: number;
          clis?: { provider: string; version?: string }[];
        }>(req);
        const runtime = store.registerRuntime({
          id: body.id ?? 'runtime:local',
          ownerId: body.ownerId ?? localOwnerId,
          host: body.host ?? hostname(),
          daemonId: body.daemonId,
          maxConcurrentTasks: body.maxConcurrentTasks,
          clis: body.clis,
        });
        send(res, 200, { runtimes: [runtime] });
        return;
      }

      if (
        method === 'POST' &&
        url.pathname.startsWith('/api/fleet/runtimes/') &&
        url.pathname.endsWith('/heartbeat')
      ) {
        if (!requireUser(req, res, authMode, localOwnerId)) return;
        const runtimeId = decodeURIComponent(url.pathname.split('/')[4]);
        send(res, 200, store.heartbeat(runtimeId));
        return;
      }

      if (method === 'GET' && url.pathname === '/api/fleet/projects') {
        if (!requireUser(req, res, authMode, localOwnerId)) return;
        send(res, 200, { projects: store.listProjects() });
        return;
      }

      if (method === 'POST' && url.pathname === '/api/fleet/projects') {
        if (!requireUser(req, res, authMode, localOwnerId)) return;
        const body = await readJson<{ name?: string }>(req);
        if (!body.name) {
          send(res, 400, { error: 'name required' });
          return;
        }
        send(res, 200, store.createProject({ name: body.name }));
        return;
      }

      if (method === 'GET' && url.pathname === '/api/fleet/tasks') {
        if (!requireUser(req, res, authMode, localOwnerId)) return;
        const projectId = url.searchParams.get('projectId') ?? undefined;
        send(res, 200, { tasks: store.listTasks(projectId) });
        return;
      }

      if (method === 'POST' && url.pathname === '/api/fleet/tasks') {
        if (!requireUser(req, res, authMode, localOwnerId)) return;
        const body = await readJson<{
          projectId?: string;
          title?: string;
          assignee?: string;
          prompt?: string;
          description?: string;
        }>(req);
        if (!body.projectId || !body.title || !body.prompt) {
          send(res, 400, { error: 'projectId, title, prompt required' });
          return;
        }
        send(
          res,
          200,
          store.createTask({
            projectId: body.projectId,
            title: body.title,
            assignee: body.assignee,
            prompt: body.prompt,
            description: body.description,
          }),
        );
        return;
      }

      if (method === 'POST' && url.pathname === '/api/fleet/tasks/claim') {
        if (!requireUser(req, res, authMode, localOwnerId)) return;
        const body = await readJson<{
          runtimeId?: string;
          maxTasks?: number;
          taskId?: string;
        }>(req);
        try {
          const tasks = store.claimTasks({
            runtimeId: body.runtimeId ?? 'runtime:local',
            maxTasks: body.maxTasks ?? 1,
            taskId: body.taskId,
          });
          send(res, 200, { tasks });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          send(res, msg.includes('DecisionGate') ? 409 : 400, { error: msg });
        }
        return;
      }

      if (method === 'POST' && url.pathname === '/api/fleet/tasks/claim-and-work') {
        if (!requireUser(req, res, authMode, localOwnerId)) return;
        const body = await readJson<{
          runtimeId?: string;
          maxTasks?: number;
          taskId?: string;
        }>(req);
        try {
          const tasks = await claimAndWork(store, {
            runtimeId: body.runtimeId ?? 'runtime:local',
            maxTasks: body.maxTasks ?? 1,
            taskId: body.taskId,
          });
          send(res, 200, {
            tasks,
            michaelInbox: store.listMichaelInbox().slice(0, 5),
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          send(res, msg.includes('DecisionGate') ? 409 : 400, { error: msg });
        }
        return;
      }

      const startMatch = url.pathname.match(/^\/api\/fleet\/tasks\/([^/]+)\/start$/);
      if (method === 'POST' && startMatch) {
        if (!requireUser(req, res, authMode, localOwnerId)) return;
        try {
          send(res, 200, store.startTask(decodeURIComponent(startMatch[1])));
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          send(res, msg.includes('DecisionGate') ? 409 : 400, { error: msg });
        }
        return;
      }

      const completeMatch = url.pathname.match(/^\/api\/fleet\/tasks\/([^/]+)\/complete$/);
      if (method === 'POST' && completeMatch) {
        if (!requireUser(req, res, authMode, localOwnerId)) return;
        const body = await readJson<{ output?: string; reportTo?: string }>(req);
        send(
          res,
          200,
          store.completeTask(decodeURIComponent(completeMatch[1]), {
            output: body.output ?? '',
            reportTo: body.reportTo,
          }),
        );
        return;
      }

      const failMatch = url.pathname.match(/^\/api\/fleet\/tasks\/([^/]+)\/fail$/);
      if (method === 'POST' && failMatch) {
        if (!requireUser(req, res, authMode, localOwnerId)) return;
        const body = await readJson<{ error?: string }>(req);
        send(
          res,
          200,
          store.failTask(decodeURIComponent(failMatch[1]), { error: body.error ?? 'failed' }),
        );
        return;
      }

      if (method === 'GET' && url.pathname === '/api/fleet/decisions') {
        const user = requireUser(req, res, authMode, localOwnerId);
        if (!user) return;
        const ownerId = url.searchParams.get('ownerId') ?? user.id;
        send(res, 200, { decisions: store.listPendingDecisions({ ownerId }) });
        return;
      }

      if (method === 'POST' && url.pathname === '/api/fleet/decisions') {
        const user = requireUser(req, res, authMode, localOwnerId);
        if (!user) return;
        const body = await readJson<{
          taskId?: string;
          kind?: PendingDecisionKind;
          message?: string;
          ownerId?: string;
        }>(req);
        if (!body.taskId || !body.kind || !body.message) {
          send(res, 400, { error: 'taskId, kind, message required' });
          return;
        }
        send(
          res,
          200,
          store.createPendingDecision({
            taskId: body.taskId,
            kind: body.kind,
            message: body.message,
            ownerId: body.ownerId ?? user.id,
          }),
        );
        return;
      }

      const resolveMatch = url.pathname.match(/^\/api\/fleet\/decisions\/([^/]+)\/resolve$/);
      if (method === 'POST' && resolveMatch) {
        if (!requireUser(req, res, authMode, localOwnerId)) return;
        const body = await readJson<{ resolution?: string; note?: string }>(req);
        send(
          res,
          200,
          store.resolveDecision(decodeURIComponent(resolveMatch[1]), {
            resolution: body.resolution ?? 'answered',
            note: body.note,
          }),
        );
        return;
      }

      if (method === 'GET' && url.pathname === '/api/fleet/michael/inbox') {
        if (!requireUser(req, res, authMode, localOwnerId)) return;
        send(res, 200, { items: store.listMichaelInbox() });
        return;
      }

      if (method === 'GET' && url.pathname === '/api/fleet/logs') {
        if (!requireUser(req, res, authMode, localOwnerId)) return;
        const taskId = url.searchParams.get('taskId') ?? undefined;
        send(res, 200, { logs: store.listExecutionLogs({ taskId }) });
        return;
      }

      if (method === 'POST' && url.pathname === '/api/fleet/import/hive') {
        if (!requireUser(req, res, authMode, localOwnerId)) return;
        const body = await readJson<{ projectId?: string; tasks?: unknown[] }>(req);
        if (!body.projectId || !Array.isArray(body.tasks)) {
          send(res, 400, { error: 'projectId and tasks[] required' });
          return;
        }
        const imported = store.importHiveTasks(
          body.projectId,
          body.tasks as Parameters<FleetStore['importHiveTasks']>[1],
        );
        send(res, 200, { tasks: imported });
        return;
      }

      // Static shell
      if (method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
        const { readFile } = await import('node:fs/promises');
        const { fileURLToPath } = await import('node:url');
        const { dirname, join } = await import('node:path');
        const here = dirname(fileURLToPath(import.meta.url));
        const html = await readFile(join(here, '../../shell/index.html'), 'utf8');
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        res.end(html);
        return;
      }
      if (method === 'GET' && url.pathname === '/app.js') {
        const { readFile } = await import('node:fs/promises');
        const { fileURLToPath } = await import('node:url');
        const { dirname, join } = await import('node:path');
        const here = dirname(fileURLToPath(import.meta.url));
        const js = await readFile(join(here, '../../shell/app.js'), 'utf8');
        res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8' });
        res.end(js);
        return;
      }
      if (method === 'GET' && url.pathname === '/styles.css') {
        const { readFile } = await import('node:fs/promises');
        const { fileURLToPath } = await import('node:url');
        const { dirname, join } = await import('node:path');
        const here = dirname(fileURLToPath(import.meta.url));
        const css = await readFile(join(here, '../../shell/styles.css'), 'utf8');
        res.writeHead(200, { 'content-type': 'text/css; charset=utf-8' });
        res.end(css);
        return;
      }

      send(res, 404, { error: 'not found', path: url.pathname });
    } catch (err) {
      send(res, 500, {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(opts.port ?? 3847, opts.host ?? '127.0.0.1', () => resolve());
  });

  return server;
}
