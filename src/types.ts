/** Fleet / Munder shared DTOs (Multica-semantic rewrite — not Multica source). */

export type TaskStatus = 'todo' | 'claimed' | 'doing' | 'blocked' | 'done' | 'failed';

export type PendingDecisionKind = 'blocker' | 'review';
export type PendingDecisionStatus = 'pending' | 'resolved';

export interface CliInfo {
  provider: string;
  version?: string;
}

export interface Runtime {
  id: string;
  host: string;
  clis: CliInfo[];
  ownerId: string;
  status: 'online' | 'offline';
  lastSeenAt: string;
  /** Concurrent claim/work slots (Multica-aligned). */
  maxConcurrentTasks: number;
  daemonId?: string;
}

export interface Project {
  id: string;
  name: string;
  createdAt: string;
}

export interface Role {
  id: string;
  projectId: string;
  name: string;
  ownerId: string;
  runtimeId?: string;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  assignee?: string;
  status: TaskStatus;
  prompt: string;
  priority: number;
  createdAt: string;
  claimedByRuntimeId?: string;
  result?: string;
  reportedTo?: string;
  humanQA?: { q: string; a?: string; askedAt: string }[];
}

export interface PendingDecision {
  id: string;
  taskId: string;
  kind: PendingDecisionKind;
  message: string;
  /** Role/runtime owner — blockers route here, not Michael-by-default. */
  ownerId: string;
  status: PendingDecisionStatus;
  createdAt: string;
  resolution?: string;
  note?: string;
  resolvedAt?: string;
}

export interface ExecutionLog {
  id: string;
  taskId: string;
  runtimeId: string;
  event: 'claimed' | 'started' | 'progress' | 'completed' | 'failed' | 'gate_blocked';
  detail: string;
  tokensIn?: number;
  tokensOut?: number;
  createdAt: string;
}

export interface MichaelInboxItem {
  id: string;
  kind: 'task_completed' | 'task_failed' | 'idle';
  taskId?: string;
  runtimeId?: string;
  summary: string;
  createdAt: string;
  read: boolean;
}

/** Munder hive JSON task shape (subset). */
export interface HiveTaskImport {
  id?: string;
  title: string;
  description?: string;
  assignee?: string;
  status?: 'todo' | 'doing' | 'blocked' | 'done';
  dependsOn?: string[];
  priority?: number;
  createdAt?: string;
  humanQA?: { q: string; a?: string; askedAt: string }[];
  result?: string;
}
