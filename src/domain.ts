export const FORMAT = "rr-task-workspace" as const;
export const FORMAT_VERSION = 2 as const;

export type TaskStatus = "inbox" | "todo" | "in_progress" | "blocked" | "done" | "canceled";
export type Priority = "low" | "normal" | "high" | "urgent";
export type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

export interface Note {
  id: string;
  title: string;
  body: string;
  tags: string[];
  pinned: boolean;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  revision: number;
  source: "quick_capture" | "manual" | "import" | "helper";
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: Priority;
  tags: string[];
  dueAt: string | null;
  position: number;
  sourceNoteId: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  archivedAt: string | null;
  deletedAt: string | null;
  revision: number;
}

export interface ChecklistItem {
  id: string;
  taskId: string;
  text: string;
  done: boolean;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface HelperRun {
  id: string;
  entityId: string;
  helperId: string;
  kind: "local_template";
  baseRevision: number;
  inputHash: string;
  proposal: Record<string, unknown>;
  state: "previewed" | "applied" | "discarded";
  createdAt: string;
  updatedAt: string;
}

export interface Handoff {
  id: string;
  taskIds: string[];
  taskRevisions: Record<string, number>;
  adapterId: "manual";
  format: "markdown" | "text";
  formatVersion: 1;
  payloadHash: string;
  state: "draft" | "previewed" | "copied" | "exported" | "copy_failed" | "export_failed" | "stale";
  createdAt: string;
  updatedAt: string;
  filePath?: string;
  error?: string;
}

export interface Settings {
  alwaysOnTop: boolean;
  privateMode: boolean;
  timezone: string;
  theme: "light" | "dark" | "system";
}

export interface Workspace {
  format: typeof FORMAT;
  workspaceId: string;
  name: string;
  schemaVersion: 1;
  format_version: 2;
  createdAt: string;
  updatedAt: string;
  timezone: string;
  notes: Note[];
  tasks: Task[];
  checklistItems: ChecklistItem[];
  helperRuns: HelperRun[];
  handoffs: Handoff[];
  settings: Settings;
}

export interface CaptureInput {
  kind: "task" | "note";
  text: string;
}

export interface CaptureDraft {
  title: string;
  body: string;
}

export interface HelperProposal {
  helperId: string;
  entityId: string;
  baseRevision: number;
  targetFields: Array<"title" | "description" | "priority" | "tags" | "checklist" | "note">;
  changes: Record<string, unknown>;
  preview: string;
}

export const PRIORITY_LABELS: Record<Priority, string> = {
  low: "Baja",
  normal: "Normal",
  high: "Alta",
  urgent: "Urgente",
};

export const STATUS_LABELS: Record<TaskStatus, string> = {
  inbox: "Entrada",
  todo: "Por hacer",
  in_progress: "En curso",
  blocked: "Bloqueada",
  done: "Hecha localmente",
  canceled: "Cancelada",
};
