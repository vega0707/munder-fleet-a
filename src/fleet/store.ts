import type {
  CliInfo,
  PendingDecision,
  PendingDecisionKind,
  Project,
  Runtime,
  Task,
} from '../types.ts';

function now(): string {
  return new Date().toISOString();
}

function id(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}

export class FleetStore {
  private runtimes = new Map<string, Runtime>();
  private projects = new Map<string, Project>();
  private tasks = new Map<string, Task>();
  private decisions = new Map<string, PendingDecision>();

  ensureLocalRuntime(opts: {
    ownerId: string;
    host: string;
    clis?: CliInfo[];
  }): Runtime {
    const existing = this.runtimes.get('runtime:local');
    if (existing) {
      existing.lastSeenAt = now();
      existing.status = 'online';
      return existing;
    }
    const rt: Runtime = {
      id: 'runtime:local',
      host: opts.host,
      clis: opts.clis ?? [],
      ownerId: opts.ownerId,
      status: 'online',
      lastSeenAt: now(),
    };
    this.runtimes.set(rt.id, rt);
    return rt;
  }

  heartbeat(runtimeId: string): { status: 'ok' } | { status: 'runtime_gone' } {
    const rt = this.runtimes.get(runtimeId);
    if (!rt) return { status: 'runtime_gone' };
    rt.lastSeenAt = now();
    rt.status = 'online';
    return { status: 'ok' };
  }

  listRuntimes(): Runtime[] {
    return [...this.runtimes.values()];
  }

  getRuntime(id: string): Runtime | undefined {
    return this.runtimes.get(id);
  }

  createProject(input: { name: string }): Project {
    const project: Project = {
      id: id('proj'),
      name: input.name,
      createdAt: now(),
    };
    this.projects.set(project.id, project);
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
  }): Task {
    if (!this.projects.has(input.projectId)) {
      throw new Error(`unknown project: ${input.projectId}`);
    }
    const task: Task = {
      id: id('task'),
      projectId: input.projectId,
      title: input.title,
      description: input.description,
      assignee: input.assignee,
      status: 'todo',
      prompt: input.prompt,
      priority: input.priority ?? 0,
      createdAt: now(),
    };
    this.tasks.set(task.id, task);
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

    let candidates = [...this.tasks.values()]
      .filter((t) => t.status === 'todo')
      .sort((a, b) => b.priority - a.priority || a.createdAt.localeCompare(b.createdAt));

    if (input.taskId) {
      candidates = candidates.filter((t) => t.id === input.taskId);
    }

    const claimed: Task[] = [];
    for (const task of candidates) {
      if (claimed.length >= input.maxTasks) break;
      task.status = 'claimed';
      task.claimedByRuntimeId = input.runtimeId;
      claimed.push(task);
    }
    return claimed;
  }

  startTask(taskId: string): Task {
    const task = this.getTask(taskId);
    if (task.status !== 'claimed' && task.status !== 'todo') {
      throw new Error(`cannot start task in status ${task.status}`);
    }
    task.status = 'doing';
    return task;
  }

  completeTask(
    taskId: string,
    input: { output: string; reportTo?: string },
  ): Task {
    const task = this.getTask(taskId);
    task.status = 'done';
    task.result = input.output;
    task.reportedTo = input.reportTo ?? 'michael';
    return task;
  }

  failTask(taskId: string, input: { error: string }): Task {
    const task = this.getTask(taskId);
    task.status = 'failed';
    task.result = input.error;
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
    const task = this.getTask(input.taskId);
    task.status = 'blocked';
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
    const task = this.tasks.get(decision.taskId);
    if (task && task.status === 'blocked') {
      task.status = 'todo';
    }
    return decision;
  }
}
