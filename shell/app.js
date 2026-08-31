const loginPanel = document.getElementById('login-panel');
const appPanel = document.getElementById('app-panel');
const authStatus = document.getElementById('auth-status');
const taskList = document.getElementById('task-list');
const decisionList = document.getElementById('decision-list');
const inboxList = document.getElementById('inbox-list');
const logList = document.getElementById('log-list');
const coreHealth = document.getElementById('core-health');

let projectId = null;

async function api(path, options = {}) {
  const res = await fetch(path, {
    credentials: 'include',
    headers: { 'content-type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function renderTasks(tasks) {
  taskList.innerHTML = '';
  if (!tasks.length) {
    taskList.innerHTML = '<li class="meta">暂无任务</li>';
    return;
  }
  for (const t of tasks) {
    const li = document.createElement('li');
    li.innerHTML = `
      <div class="title">${escapeHtml(t.title)}</div>
      <div class="meta">
        <span class="status-${t.status}">${t.status}</span>
        · assignee=${escapeHtml(t.assignee || '—')}
        ${t.reportedTo ? `· → ${escapeHtml(t.reportedTo)}` : ''}
        ${t.result ? `· ${escapeHtml(String(t.result).slice(0, 80))}` : ''}
      </div>`;
    taskList.appendChild(li);
  }
}

function renderDecisions(decisions) {
  decisionList.innerHTML = '';
  if (!decisions.length) {
    decisionList.innerHTML = '<li class="meta">无待定项</li>';
    return;
  }
  for (const d of decisions) {
    const li = document.createElement('li');
    li.innerHTML = `
      <div class="title">${escapeHtml(d.message)}</div>
      <div class="meta status-pending">${d.kind} · owner=${escapeHtml(d.ownerId)} · ${d.status}</div>`;
    const btn = document.createElement('button');
    btn.className = 'resolve';
    btn.type = 'button';
    btn.textContent = '解决';
    btn.addEventListener('click', async () => {
      await api(`/api/fleet/decisions/${d.id}/resolve`, {
        method: 'POST',
        body: JSON.stringify({ resolution: 'answered', note: 'resolved in shell' }),
      });
      await refresh();
    });
    li.appendChild(btn);
    decisionList.appendChild(li);
  }
}

function renderInbox(items) {
  inboxList.innerHTML = '';
  if (!items.length) {
    inboxList.innerHTML = '<li class="meta">空</li>';
    return;
  }
  for (const i of items.slice(0, 20)) {
    const li = document.createElement('li');
    li.innerHTML = `<div class="title">${escapeHtml(i.summary)}</div>
      <div class="meta">${escapeHtml(i.kind)} · ${escapeHtml(i.createdAt)}</div>`;
    inboxList.appendChild(li);
  }
}

function renderLogs(logs) {
  logList.innerHTML = '';
  if (!logs.length) {
    logList.innerHTML = '<li class="meta">无日志</li>';
    return;
  }
  for (const l of logs.slice(-20).reverse()) {
    const li = document.createElement('li');
    li.innerHTML = `<div class="title">${escapeHtml(l.event)}</div>
      <div class="meta">${escapeHtml(l.detail.slice(0, 120))}
      ${l.tokensOut != null ? ` · tok≈${l.tokensIn ?? 0}/${l.tokensOut}` : ''}</div>`;
    logList.appendChild(li);
  }
}

async function ensureProject() {
  const { projects } = await api('/api/fleet/projects');
  if (projects.length) {
    projectId = projects[0].id;
    return;
  }
  const p = await api('/api/fleet/projects', {
    method: 'POST',
    body: JSON.stringify({ name: 'Munder P0' }),
  });
  projectId = p.id;
}

async function refresh() {
  await ensureProject();
  const [{ tasks }, { decisions }, { items }, { logs }, core] = await Promise.all([
    api('/api/fleet/tasks'),
    api('/api/fleet/decisions'),
    api('/api/fleet/michael/inbox'),
    api('/api/fleet/logs'),
    api('/api/core/health'),
  ]);
  renderTasks(tasks);
  renderDecisions(decisions);
  renderInbox(items);
  renderLogs(logs);
  coreHealth.textContent = core.available
    ? `Core: ok (${core.body?.version ?? 'up'})`
    : `Core: offline (${core.reason || 'n/a'})`;
}

async function seed() {
  await ensureProject();
  await api('/api/fleet/tasks', {
    method: 'POST',
    body: JSON.stringify({
      projectId,
      title: 'P0 claim demo',
      assignee: 'vega',
      prompt: '演示 claim → 干活 → complete',
    }),
  });
  const blocked = await api('/api/fleet/tasks', {
    method: 'POST',
    body: JSON.stringify({
      projectId,
      title: 'Needs human confirm',
      assignee: 'vega',
      prompt: 'blocked until owner answers',
    }),
  });
  await api('/api/fleet/decisions', {
    method: 'POST',
    body: JSON.stringify({
      taskId: blocked.id,
      kind: 'blocker',
      message: '确认本机 runtime 已注册？',
      ownerId: 'local-user',
    }),
  });
  await refresh();
}

async function claimAndWork() {
  // Resolve blockers first so DecisionGate does not 409 the whole owner.
  const { decisions } = await api('/api/fleet/decisions');
  for (const d of decisions) {
    await api(`/api/fleet/decisions/${d.id}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ resolution: 'answered', note: 'auto-resolve before work' }),
    });
  }
  const result = await api('/api/fleet/tasks/claim-and-work', {
    method: 'POST',
    body: JSON.stringify({ runtimeId: 'runtime:local', maxTasks: 1 }),
  });
  if (!result.tasks.length) {
    authStatus.textContent += ' · 无可 claim 任务';
  }
  await refresh();
}

async function boot() {
  const status = await api('/api/auth/status');
  authStatus.textContent = `${status.authMode} · ${
    status.authenticated ? status.user?.username : '未登录'
  }${status.loopbackFrozen ? ' · loopback冻结' : ''}`;

  if (!status.authenticated) {
    loginPanel.classList.remove('hidden');
    appPanel.classList.add('hidden');
    return;
  }

  loginPanel.classList.add('hidden');
  appPanel.classList.remove('hidden');
  await api('/api/fleet/bootstrap');
  await refresh();
}

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      username: fd.get('username'),
      password: fd.get('password'),
    }),
  });
  await boot();
});

document.getElementById('btn-seed').addEventListener('click', () => seed().catch(showErr));
document.getElementById('btn-claim').addEventListener('click', () => claimAndWork().catch(showErr));
document.getElementById('btn-refresh').addEventListener('click', () => refresh().catch(showErr));

function showErr(err) {
  authStatus.textContent = `错误: ${err.message}`;
}

boot().catch(showErr);
