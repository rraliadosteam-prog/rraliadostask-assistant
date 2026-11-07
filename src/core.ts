import {
  FORMAT,
  FORMAT_VERSION,
  PRIORITY_LABELS,
  STATUS_LABELS,
  type CaptureDraft,
  type ChecklistItem,
  type Note,
  type Priority,
  type Task,
  type TaskStatus,
  type Workspace,
} from "./domain";

export class DomainError extends Error {
  constructor(
    public readonly code:
      | "validation_error"
      | "revision_conflict"
      | "not_found"
      | "format_invalid"
      | "format_future"
      | "helper_invalid_output",
    message: string,
  ) {
    super(message);
  }
}

export function newId(prefix: string): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return `${prefix}_${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function parseCapture(text: string): CaptureDraft {
  const normalized = text.replace(/\r\n?/g, "\n");
  const trimmed = normalized.trim();
  if (!trimmed) throw new DomainError("validation_error", "La captura está vacía.");
  const [first = "", ...rest] = trimmed.split("\n");
  const title = first.trim().slice(0, 200);
  const body = rest.join("\n").trim();
  return { title, body };
}

export function createWorkspace(name: string, timezone = "America/Bogota"): Workspace {
  const timestamp = nowIso();
  return {
    format: FORMAT,
    workspaceId: newId("ws"),
    name: name.trim() || "Mi workspace",
    schemaVersion: 1,
    format_version: FORMAT_VERSION,
    createdAt: timestamp,
    updatedAt: timestamp,
    timezone,
    notes: [],
    tasks: [],
    checklistItems: [],
    helperRuns: [],
    handoffs: [],
    settings: {
      alwaysOnTop: false,
      privateMode: true,
      timezone,
      theme: "system",
    },
  };
}

export function addCapture(workspace: Workspace, kind: "task" | "note", text: string): Workspace {
  const draft = parseCapture(text);
  const timestamp = nowIso();
  if (kind === "task") {
    const task: Task = {
      id: newId("task"),
      title: draft.title,
      description: draft.body,
      status: "inbox",
      priority: "normal",
      tags: [],
      dueAt: null,
      position: workspace.tasks.length,
      sourceNoteId: null,
      createdAt: timestamp,
      updatedAt: timestamp,
      completedAt: null,
      archivedAt: null,
      deletedAt: null,
      revision: 1,
    };
    return { ...workspace, tasks: [...workspace.tasks, task], updatedAt: timestamp };
  }
  const note: Note = {
    id: newId("note"),
    title: draft.title,
    body: draft.body,
    tags: [],
    pinned: false,
    archivedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    revision: 1,
    source: "quick_capture",
  };
  return { ...workspace, notes: [...workspace.notes, note], updatedAt: timestamp };
}

export function updateTask(
  workspace: Workspace,
  taskId: string,
  patch: Partial<Pick<Task, "title" | "description" | "priority" | "tags" | "dueAt">>,
  expectedRevision?: number,
): Workspace {
  const task = workspace.tasks.find((item) => item.id === taskId);
  if (!task) throw new DomainError("not_found", "La tarea no existe.");
  if (expectedRevision !== undefined && expectedRevision !== task.revision) {
    throw new DomainError("revision_conflict", "La tarea cambió; regenerá la propuesta.");
  }
  const timestamp = nowIso();
  const updated: Task = {
    ...task,
    ...patch,
    title: patch.title === undefined ? task.title : patch.title.trim(),
    updatedAt: timestamp,
    revision: task.revision + 1,
  };
  if (!updated.title) throw new DomainError("validation_error", "El título no puede estar vacío.");
  return {
    ...workspace,
    tasks: workspace.tasks.map((item) => (item.id === taskId ? updated : item)),
    updatedAt: timestamp,
  };
}

export function moveTask(
  workspace: Workspace,
  taskId: string,
  status: TaskStatus,
  expectedRevision?: number,
): Workspace {
  const task = workspace.tasks.find((item) => item.id === taskId);
  if (!task) throw new DomainError("not_found", "La tarea no existe.");
  if (expectedRevision !== undefined && expectedRevision !== task.revision) {
    throw new DomainError("revision_conflict", "La tarea cambió; regenerá la propuesta.");
  }
  const timestamp = nowIso();
  const updated: Task = {
    ...task,
    status,
    completedAt: status === "done" ? (task.completedAt ?? timestamp) : null,
    updatedAt: timestamp,
    revision: task.revision + 1,
  };
  return {
    ...workspace,
    tasks: workspace.tasks.map((item) => (item.id === taskId ? updated : item)),
    updatedAt: timestamp,
  };
}

export function deleteTask(workspace: Workspace, taskId: string): Workspace {
  const timestamp = nowIso();
  return {
    ...workspace,
    tasks: workspace.tasks.map((task) =>
      task.id === taskId
        ? { ...task, deletedAt: task.deletedAt ?? timestamp, updatedAt: timestamp, revision: task.revision + 1 }
        : task,
    ),
    updatedAt: timestamp,
  };
}

export function addChecklistItem(
  workspace: Workspace,
  taskId: string,
  text: string,
): Workspace {
  if (!workspace.tasks.some((task) => task.id === taskId)) {
    throw new DomainError("not_found", "La tarea no existe.");
  }
  const clean = text.trim();
  if (!clean) throw new DomainError("validation_error", "El paso no puede estar vacío.");
  const timestamp = nowIso();
  const item: ChecklistItem = {
    id: newId("check"),
    taskId,
    text: clean,
    done: false,
    position: workspace.checklistItems.filter((candidate) => candidate.taskId === taskId).length,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  return { ...workspace, checklistItems: [...workspace.checklistItems, item], updatedAt: timestamp };
}

export function updateNote(
  workspace: Workspace,
  noteId: string,
  patch: Partial<Pick<Note, "title" | "body" | "tags" | "pinned">>,
): Workspace {
  const note = workspace.notes.find((item) => item.id === noteId);
  if (!note) throw new DomainError("not_found", "La nota no existe.");
  const timestamp = nowIso();
  const updated: Note = { ...note, ...patch, updatedAt: timestamp, revision: note.revision + 1 };
  if (!updated.title.trim()) throw new DomainError("validation_error", "El título no puede estar vacío.");
  return {
    ...workspace,
    notes: workspace.notes.map((item) => (item.id === noteId ? updated : item)),
    updatedAt: timestamp,
  };
}

export function deleteNote(workspace: Workspace, noteId: string): Workspace {
  return {
    ...workspace,
    notes: workspace.notes.map((note) =>
      note.id === noteId ? { ...note, archivedAt: note.archivedAt ?? nowIso(), revision: note.revision + 1 } : note,
    ),
    updatedAt: nowIso(),
  };
}

export function activeTasks(workspace: Workspace): Task[] {
  return workspace.tasks
    .filter((task) => !task.deletedAt && !task.archivedAt)
    .sort((a, b) => a.position - b.position || a.updatedAt.localeCompare(b.updatedAt) || a.id.localeCompare(b.id));
}

export function searchWorkspace(workspace: Workspace, query: string): { tasks: Task[]; notes: Note[] } {
  const normalize = (value: string) => value.toLocaleLowerCase("es").trim().replace(/\s+/g, " ");
  const needle = normalize(query);
  const matches = (values: string[]) => !needle || values.some((value) => normalize(value).includes(needle));
  const tasks = activeTasks(workspace).filter((task) => {
    const checklist = workspace.checklistItems.filter((item) => item.taskId === task.id).map((item) => item.text);
    const note = workspace.notes.find((item) => item.id === task.sourceNoteId);
    return matches([task.title, task.description, ...task.tags, ...checklist, note?.title ?? "", note?.body ?? ""]);
  });
  const notes = workspace.notes
    .filter((note) => !note.archivedAt)
    .filter((note) => matches([note.title, note.body, ...note.tags]));
  return { tasks, notes };
}

export function validateWorkspace(value: unknown): Workspace {
  if (!value || typeof value !== "object") {
    throw new DomainError("format_invalid", "El workspace no es un objeto válido.");
  }
  const candidate = value as Partial<Workspace> & { format?: string };
  if (candidate.format !== FORMAT) {
    throw new DomainError("format_invalid", "El archivo no es un workspace de RR Tareas.");
  }
  if (candidate.format_version !== FORMAT_VERSION) {
    throw new DomainError("format_future", "El workspace usa una versión futura no compatible.");
  }
  if (
    typeof candidate.workspaceId !== "string" ||
    typeof candidate.name !== "string" ||
    !Array.isArray(candidate.tasks) ||
    !Array.isArray(candidate.notes) ||
    !Array.isArray(candidate.checklistItems)
  ) {
    throw new DomainError("format_invalid", "El workspace no contiene los campos requeridos.");
  }
  const taskIds = new Set(candidate.tasks.map((task) => task.id));
  for (const item of candidate.checklistItems) {
    if (!taskIds.has(item.taskId)) {
      throw new DomainError("format_invalid", "Hay un checklist sin tarea válida.");
    }
  }
  for (const task of candidate.tasks) {
    if (!task.title.trim()) throw new DomainError("format_invalid", "Una tarea tiene un título vacío.");
    if (task.status === "done" && !task.completedAt) {
      throw new DomainError("format_invalid", "Una tarea hecha no tiene fecha de completitud.");
    }
  }
  return candidate as Workspace;
}

export function taskPriorityLabel(priority: Priority): string {
  return PRIORITY_LABELS[priority];
}

export function taskStatusLabel(status: TaskStatus): string {
  return STATUS_LABELS[status];
}
