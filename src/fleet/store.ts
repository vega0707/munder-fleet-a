import { DatabaseSync } from 'node:sqlite';
import type {
  CliInfo,
  ExecutionLog,
  HiveTaskImport,
  MichaelInboxItem,
  PendingDecision,
  PendingDecisionKind,
  Project,
  Runtime,
  Task,
  TaskStatus,
} from '../types.ts';

function now(): string {
  return new Date().toISOString();
}

function id(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}

export interface FleetStoreOptions {
  /** When set, persist to SQLite and hydrate on construct. */
  dbPath?: string;
  /** Default concurrent slots for new runtimes. */
  defaultMaxConcurrentTasks?: number;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS runtimes (
  id TEXT PRIMARY KEY,
  host TEXT NOT NULL,
  clis_json TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  status TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  max_concurrent_tasks INTEGER NOT NULL,
  daemon_id TEXT
);
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  assignee TEXT,
  status TEXT NOT NULL,
  prompt TEXT NOT NULL,
  priority INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  claimed_by_runtime_id TEXT,
  result TEXT,
  reported_to TEXT,
  human_qa_json TEXT
);
CREATE TABLE IF NOT EXISTS decisions (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  message TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  resolution TEXT,
  note TEXT,
  resolved_at TEXT
);
CREATE TABLE IF NOT EXISTS execution_logs (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  runtime_id TEXT NOT NULL,
  event TEXT NOT NULL,
  detail TEXT NOT NULL,
  tokens_in INTEGER,
  tokens_out INTEGER,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS michael_inbox (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  task_id TEXT,
  runtime_id TEXT,
  summary TEXT NOT NULL,
  created_at TEXT NOT NULL,
  read INTEGER NOT NULL DEFAULT 0
);
`;

export class FleetStore {
  private runtimes = new Map<string, Runtime>();
  private projects = new Map<string, Project>();
  private tasks = new Map<string, Task>();
  private decisions = new Map<string, PendingDecision>();
  private logs: ExecutionLog[] = [];
  private inbox: MichaelInboxItem[] = [];
  private db: DatabaseSync | null = null;
  private defaultMaxConcurrentTasks: number;

  constructor(opts: FleetStoreOptions = {}) {
    this.defaultMaxConcurrentTasks = opts.defaultMaxConcurrentTasks ?? 2;
    if (opts.dbPath) {
      this.db = new DatabaseSync(opts.dbPath);
      this.db.exec(SCHEMA);
      this.hydrate();
    }
  }

  private hydrate(): void {
    if (!this.db) return;
    for (const row of this.db.prepare('SELECT * FROM runtimes').all() as Record<string, unknown>[]) {
      this.runtimes.set(String(row.id), {
        id: String(row.id),
        host: String(row.host),
        clis: JSON.parse(String(row.clis_json)) as CliInfo[],
        ownerId: String(row.owner_id),
        status: row.status as Runtime['status'],
        lastSeenAt: String(row.last_seen_at),
        maxConcurrentTasks: Number(row.max_concurrent_tasks),
        daemonId: row.daemon_id ? String(row.daemon_id) : undefined,
      });
    }
    for (const row of this.db.prepare('SELECT * FROM projects').all() as Record<string, unknown>[]) {
      this.projects.set(String(row.id), {
        id: String(row.id),
        name: String(row.name),
        createdAt: String(row.created_at),
      });
    }
    for (const row of this.db.prepare('SELECT * FROM tasks').all() as Record<string, unknown>[]) {
      this.tasks.set(String(row.id), {
        id: String(row.id),
        projectId: String(row.project_id),
        title: String(row.title),
        description: row.description ? String(row.description) : undefined,
        assignee: row.assignee ? String(row.assignee) : undefined,
        status: row.status as TaskStatus,
        prompt: String(row.prompt),
        priority: Number(row.priority),
        createdAt: String(row.created_at),
        claimedByRuntimeId: row.claimed_by_runtime_id
          ? String(row.claimed_by_runtime_id)
          : undefined,
        result: row.result ? String(row.result) : undefined,
        reportedTo: row.reported_to ? String(row.reported_to) : undefined,
        humanQA: row.human_qa_json
          ? (JSON.parse(String(row.human_qa_json)) as Task['humanQA'])
          : undefined,
      });
    }
    for (const row of this.db.prepare('SELECT * FROM decisions').all() as Record<string, unknown>[]) {
      this.decisions.set(String(row.id), {
        id: String(row.id),
        taskId: String(row.task_id),
        kind: row.kind as PendingDecisionKind,
        message: String(row.message),
        ownerId: String(row.owner_id),
        status: row.status as PendingDecision['status'],
        createdAt: String(row.created_at),
        resolution: row.resolution ? String(row.resolution) : undefined,
        note: row.note ? String(row.note) : undefined,
        resolvedAt: row.resolved_at ? String(row.resolved_at) : undefined,
      });
    }
    for (const row of this.db.prepare('SELECT * FROM execution_logs ORDER BY created_at').all() as Record<
      string,
      unknown
    >[]) {
      this.logs.push({
        id: String(row.id),
        taskId: String(row.task_id),
        runtimeId: String(row.runtime_id),
        event: row.event as ExecutionLog['event'],
        detail: String(row.detail),
        tokensIn: row.tokens_in == null ? undefined : Number(row.tokens_in),
        tokensOut: row.tokens_out == null ? undefined : Number(row.tokens_out),
        createdAt: String(row.created_at),
      });
    }
    for (const row of this.db.prepare('SELECT * FROM michael_inbox ORDER BY created_at').all() as Record<
      string,
      unknown
    >[]) {
      this.inbox.push({
        id: String(row.id),
        kind: row.kind as MichaelInboxItem['kind'],
        taskId: row.task_id ? String(row.task_id) : undefined,
        runtimeId: row.runtime_id ? String(row.runtime_id) : undefined,
        summary: String(row.summary),
        createdAt: String(row.created_at),
        read: Boolean(row.read),
      });
    }
  }

  private persistRuntime(rt: Runtime): void {
    this.db
      ?.prepare(
        `INSERT INTO runtimes(id,host,clis_json,owner_id,status,last_seen_at,max_concurrent_tasks,daemon_id)
         VALUES (?,?,?,?,?,?,?,?)
         ON CONFLICT(id) DO UPDATE SET
           host=excluded.host, clis_json=excluded.clis_json, owner_id=excluded.owner_id,
           status=excluded.status, last_seen_at=excluded.last_seen_at,
           max_concurrent_tasks=excluded.max_concurrent_tasks, daemon_id=excluded.daemon_id`,
      )
      .run(
        rt.id,
        rt.host,
        JSON.stringify(rt.clis),
        rt.ownerId,
        rt.status,
        rt.lastSeenAt,
        rt.maxConcurrentTasks,
        rt.daemonId ?? null,
      );
  }

  private persistProject(p: Project): void {
    this.db
      ?.prepare(
        `INSERT INTO projects(id,name,created_at) VALUES (?,?,?)
         ON CONFLICT(id) DO UPDATE SET name=excluded.name`,
      )
      .run(p.id, p.name, p.createdAt);
  }

  private persistTask(t: Task): void {
    this.db
      ?.prepare(
        `INSERT INTO tasks(id,project_id,title,description,assignee,status,prompt,priority,created_at,claimed_by_runtime_id,result,reported_to,human_qa_json)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
         ON CONFLICT(id) DO UPDATE SET
           title=excluded.title, description=excluded.description, assignee=excluded.assignee,
           status=excluded.status, prompt=excluded.prompt, priority=excluded.priority,
           claimed_by_runtime_id=excluded.claimed_by_runtime_id, result=excluded.result,
           reported_to=excluded.reported_to, human_qa_json=excluded.human_qa_json`,
      )
      .run(
        t.id,
        t.projectId,
        t.title,
        t.description ?? null,
        t.assignee ?? null,
        t.status,
        t.prompt,
        t.priority,
        t.createdAt,
        t.claimedByRuntimeId ?? null,
        t.result ?? null,
        t.reportedTo ?? null,
        t.humanQA ? JSON.stringify(t.humanQA) : null,
      );
  }

  private persistDecision(d: PendingDecision): void {
    this.db
      ?.prepare(
        `INSERT INTO decisions(id,task_id,kind,message,owner_id,status,created_at,resolution,note,resolved_at)
         VALUES (?,?,?,?,?,?,?,?,?,?)
         ON CONFLICT(id) DO UPDATE SET
           status=excluded.status, resolution=excluded.resolution, note=excluded.note,
           resolved_at=excluded.resolved_at`,
      )
      .run(
        d.id,
        d.taskId,
        d.kind,
        d.message,
        d.ownerId,
        d.status,
        d.createdAt,
        d.resolution ?? null,
        d.note ?? null,
        d.resolvedAt ?? null,
      );
  }

  private persistLog(log: ExecutionLog): void {
    this.db
      ?.prepare(
        `INSERT INTO execution_logs(id,task_id,runtime_id,event,detail,tokens_in,tokens_out,created_at)
         VALUES (?,?,?,?,?,?,?,?)`,
      )
      .run(
        log.id,
        log.taskId,
        log.runtimeId,
        log.event,
        log.detail,
        log.tokensIn ?? null,
        log.tokensOut ?? null,
        log.createdAt,
      );
  }

  private persistInbox(item: MichaelInboxItem): void {
    this.db
      ?.prepare(
        `INSERT INTO michael_inbox(id,kind,task_id,runtime_id,summary,created_at,read)
         VALUES (?,?,?,?,?,?,?)
         ON CONFLICT(id) DO UPDATE SET read=excluded.read`,
      )
      .run(
        item.id,
        item.kind,
        item.taskId ?? null,
        item.runtimeId ?? null,
        item.summary,
        item.createdAt,
        item.read ? 1 : 0,
      );
  }

  private appendLog(
    partial: Omit<ExecutionLog, 'id' | 'createdAt'> & { createdAt?: string },
  ): ExecutionLog {
    const log: ExecutionLog = {
      id: id('log'),
      createdAt: partial.createdAt ?? now(),
      ...partial,
    };
    this.logs.push(log);
    this.persistLog(log);
    return log;
  }

  private pushMichael(item: Omit<MichaelInboxItem, 'id' | 'createdAt' | 'read'>): MichaelInboxItem {
    const full: MichaelInboxItem = {
      id: id('mike'),
      createdAt: now(),
      read: false,
      ...item,
    };
    this.inbox.push(full);
    this.persistInbox(full);
    return full;
  }

  /** P1 DecisionGate: pending decisions for runtime owner block new tool/claim work. */
  assertDecisionGateClear(runtimeId: string): void {
    const rt = this.runtimes.get(runtimeId);
    if (!rt) throw new Error(`unknown runtime: ${runtimeId}`);
    const pending = this.listPendingDecisions({ ownerId: rt.ownerId });
    if (pending.length > 0) {
      this.appendLog({
        taskId: pending[0].taskId,
        runtimeId,
        event: 'gate_blocked',
        detail: `DecisionGate: ${pending.length} pending for owner ${rt.ownerId}`,
      });
      throw new Error(
        `DecisionGate: ${pending.length} pending decision(s) for owner ${rt.ownerId}`,
      );
    }
  }

  registerRuntime(input: {
    id: string;
    host: string;
    ownerId: string;
    clis?: CliInfo[];
    maxConcurrentTasks?: number;
    daemonId?: string;
  }): Runtime {
    const existing = this.runtimes.get(input.id);
    if (existing) {
      // Idempotent re-register: keep original owner (local topology / daemon token semantics).
      existing.host = input.host;
      if (input.clis) existing.clis = input.clis;
      if (input.maxConcurrentTasks != null) existing.maxConcurrentTasks = input.maxConcurrentTasks;
      if (input.daemonId) existing.daemonId = input.daemonId;
      existing.status = 'online';
      existing.lastSeenAt = now();
      this.persistRuntime(existing);
      return existing;
    }
    const rt: Runtime = {
      id: input.id,
      host: input.host,
      clis: input.clis ?? [],
      ownerId: input.ownerId,
      status: 'online',
      lastSeenAt: now(),
      maxConcurrentTasks: input.maxConcurrentTasks ?? this.defaultMaxConcurrentTasks,
      daemonId: input.daemonId,
    };
    this.runtimes.set(rt.id, rt);
    this.persistRuntime(rt);
    return rt;
  }

  ensureLocalRuntime(opts: {
    ownerId: string;
    host: string;
    clis?: CliInfo[];
    maxConcurrentTasks?: number;
  }): Runtime {
    return this.registerRuntime({
      id: 'runtime:local',
      host: opts.host,
      ownerId: opts.ownerId,
      clis: opts.clis,
      maxConcurrentTasks: opts.maxConcurrentTasks,
      daemonId: 'local',
    });
  }

  heartbeat(runtimeId: string): { status: 'ok' } | { status: 'runtime_gone' } {
    const rt = this.runtimes.get(runtimeId);
    if (!rt) return { status: 'runtime_gone' };
    rt.lastSeenAt = now();
    rt.status = 'online';
    this.persistRuntime(rt);
    return { status: 'ok' };
  }

  markRuntimeOffline(runtimeId: string): Runtime | undefined {
    const rt = this.runtimes.get(runtimeId);
    if (!rt) return undefined;
    rt.status = 'offline';
    this.persistRuntime(rt);
    return rt;
  }

  listRuntimes(): Runtime[] {
    return [...this.runtimes.values()];
  }

  getRuntime(runtimeId: string): Runtime | undefined {
    return this.runtimes.get(runtimeId);
  }

  activeTaskCount(runtimeId: string): number {
    return [...this.tasks.values()].filter(
      (t) =>
        t.claimedByRuntimeId === runtimeId &&
        (t.status === 'claimed' || t.status === 'doing'),
    ).length;
  }

  createProject(input: { name: string }): Project {
    const project: Project = {
      id: id('proj'),
      name: input.name,
      createdAt: now(),
    };
    this.projects.set(project.id, project);
    this.persistProject(project);
    return project;
  }

  listProjects(): Project[] {
    return [...this.projects.values()];
  }

  createTask(input: {
    projectId: string;
    title: string;
    assignee?: string;
    prompt: string;
    description?: string;
    priority?: number;
    id?: string;
    status?: TaskStatus;
    result?: string;
    humanQA?: Task['humanQA'];
  }): Task {
    if (!this.projects.has(input.projectId)) {
      throw new Error(`unknown project: ${input.projectId}`);
    }
    const task: Task = {
      id: input.id ?? id('task'),
      projectId: input.projectId,
      title: input.title,
      description: input.description,
      assignee: input.assignee,
      status: input.status ?? 'todo',
      prompt: input.prompt,
      priority: input.priority ?? 0,
      createdAt: now(),
      result: input.result,
      humanQA: input.humanQA,
    };
    this.tasks.set(task.id, task);
    this.persistTask(task);
    return task;
  }

  listTasks(projectId?: string): Task[] {
    const all = [...this.tasks.values()];
    return projectId ? all.filter((t) => t.projectId === projectId) : all;
  }

  getTask(taskId: string): Task {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`unknown task: ${taskId}`);
    return task;
  }

  claimTasks(input: { runtimeId: string; maxTasks: number; taskId?: string }): Task[] {
    if (input.maxTasks <= 0) return [];
    const rt = this.runtimes.get(input.runtimeId);
    if (!rt || rt.status !== 'online') {
      throw new Error(`runtime not claimable: ${input.runtimeId}`);
    }
    this.assertDecisionGateClear(input.runtimeId);

    const freeSlots = Math.max(0, rt.maxConcurrentTasks - this.activeTaskCount(input.runtimeId));
    const limit = Math.min(input.maxTasks, freeSlots);
    if (limit <= 0) return [];

    let candidates = [...this.tasks.values()]
      .filter((t) => t.status === 'todo')
      .sort((a, b) => b.priority - a.priority || a.createdAt.localeCompare(b.createdAt));

    if (input.taskId) {
      candidates = candidates.filter((t) => t.id === input.taskId);
    }

    const claimed: Task[] = [];
    for (const task of candidates) {
      if (claimed.length >= limit) break;
      task.status = 'claimed';
      task.claimedByRuntimeId = input.runtimeId;
      this.persistTask(task);
      this.appendLog({
        taskId: task.id,
        runtimeId: input.runtimeId,
        event: 'claimed',
        detail: `claimed by ${input.runtimeId}`,
      });
      claimed.push(task);
    }
    return claimed;
  }

  startTask(taskId: string): Task {
    const task = this.getTask(taskId);
    if (task.status !== 'claimed' && task.status !== 'todo') {
      throw new Error(`cannot start task in status ${task.status}`);
    }
    if (task.claimedByRuntimeId) {
      this.assertDecisionGateClear(task.claimedByRuntimeId);
    }
    task.status = 'doing';
    this.persistTask(task);
    this.appendLog({
      taskId: task.id,
      runtimeId: task.claimedByRuntimeId ?? 'runtime:local',
      event: 'started',
      detail: 'started',
    });
    return task;
  }

  completeTask(
    taskId: string,
    input: { output: string; reportTo?: string; tokensIn?: number; tokensOut?: number },
  ): Task {
    const task = this.getTask(taskId);
    task.status = 'done';
    task.result = input.output;
    task.reportedTo = input.reportTo ?? 'michael';
    this.persistTask(task);
    this.appendLog({
      taskId: task.id,
      runtimeId: task.claimedByRuntimeId ?? 'runtime:local',
      event: 'completed',
      detail: input.output.slice(0, 500),
      tokensIn: input.tokensIn,
      tokensOut: input.tokensOut,
    });
    this.pushMichael({
      kind: 'task_completed',
      taskId: task.id,
      runtimeId: task.claimedByRuntimeId,
      summary: `Task ${task.title} completed → ${task.reportedTo}`,
    });
    return task;
  }

  failTask(taskId: string, input: { error: string }): Task {
    const task = this.getTask(taskId);
    task.status = 'failed';
    task.result = input.error;
    this.persistTask(task);
    this.appendLog({
      taskId: task.id,
      runtimeId: task.claimedByRuntimeId ?? 'runtime:local',
      event: 'failed',
      detail: input.error,
    });
    this.pushMichael({
      kind: 'task_failed',
      taskId: task.id,
      runtimeId: task.claimedByRuntimeId,
      summary: `Task ${task.title} failed: ${input.error}`,
    });
    return task;
  }

  createPendingDecision(input: {
    taskId: string;
    kind: PendingDecisionKind;
    message: string;
    ownerId: string;
  }): PendingDecision {
    this.getTask(input.taskId);
    const decision: PendingDecision = {
      id: id('dec'),
      taskId: input.taskId,
      kind: input.kind,
      message: input.message,
      ownerId: input.ownerId,
      status: 'pending',
      createdAt: now(),
    };
    this.decisions.set(decision.id, decision);
    this.persistDecision(decision);
    const task = this.getTask(input.taskId);
    task.status = 'blocked';
    this.persistTask(task);
    return decision;
  }

  listPendingDecisions(filter?: { ownerId?: string }): PendingDecision[] {
    let all = [...this.decisions.values()].filter((d) => d.status === 'pending');
    if (filter?.ownerId) {
      all = all.filter((d) => d.ownerId === filter.ownerId);
    }
    return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  resolveDecision(
    decisionId: string,
    input: { resolution: string; note?: string },
  ): PendingDecision {
    const decision = this.decisions.get(decisionId);
    if (!decision) throw new Error(`unknown decision: ${decisionId}`);
    decision.status = 'resolved';
    decision.resolution = input.resolution;
    decision.note = input.note;
    decision.resolvedAt = now();
    this.persistDecision(decision);
    const task = this.tasks.get(decision.taskId);
    if (task && task.status === 'blocked') {
      task.status = 'todo';
      this.persistTask(task);
    }
    return decision;
  }

  listExecutionLogs(filter?: { taskId?: string }): ExecutionLog[] {
    let all = [...this.logs];
    if (filter?.taskId) all = all.filter((l) => l.taskId === filter.taskId);
    return all;
  }

  listMichaelInbox(): MichaelInboxItem[] {
    return [...this.inbox].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  importHiveTasks(projectId: string, hiveTasks: HiveTaskImport[]): Task[] {
    const statusMap: Record<string, TaskStatus> = {
      todo: 'todo',
      doing: 'doing',
      blocked: 'blocked',
      done: 'done',
    };
    return hiveTasks.map((h) =>
      this.createTask({
        id: h.id,
        projectId,
        title: h.title,
        description: h.description,
        assignee: h.assignee,
        prompt: h.description ?? h.title,
        priority: h.priority ?? 0,
        status: h.status ? statusMap[h.status] ?? 'todo' : 'todo',
        result: h.result,
        humanQA: h.humanQA,
      }),
    );
  }
}
