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
}

export interface Project {
  id: string;
  name: string;
  createdAt: string;
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
  ownerId: string;
  status: PendingDecisionStatus;
  createdAt: string;
  resolution?: string;
  note?: string;
  resolvedAt?: string;
}
