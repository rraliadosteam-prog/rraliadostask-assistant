import { STATUS_LABELS, type ChecklistItem, type Handoff, type Task, type Workspace } from "./domain";
import { DomainError, newId, nowIso } from "./core";

function escapeMarkdown(value: string): string {
  return value.replace(/([\\`*_[\]<>])/g, "\\$1");
}

function localDate(value: string | null, timezone: string): string {
  if (!value) return "Sin fecha";
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone,
  }).format(new Date(value));
}

export function buildHandoff(
  workspace: Workspace,
  taskIds: string[],
  format: "markdown" | "text" = "markdown",
): { payload: string; hash: string; taskRevisions: Record<string, number> } {
  const selected = workspace.tasks.filter((task) => taskIds.includes(task.id) && !task.deletedAt);
  if (selected.length === 0) throw new DomainError("validation_error", "Elegí al menos una tarea.");
  const taskRevisions: Record<string, number> = {};
  const blocks = selected.map((task) => {
    taskRevisions[task.id] = task.revision;
    const checklist = workspace.checklistItems
      .filter((item: ChecklistItem) => item.taskId === task.id)
      .sort((a, b) => a.position - b.position);
    if (format === "markdown") {
      return [
        `## Tarea: ${escapeMarkdown(task.title)}`,
        "",
        `**Prioridad:** ${task.priority}`,
        `**Estado local:** ${STATUS_LABELS[task.status]}`,
        `**Fecha límite:** ${localDate(task.dueAt, workspace.timezone)}`,
        `**Etiquetas:** ${task.tags.length ? task.tags.map(escapeMarkdown).join(", ") : "Sin etiquetas"}`,
        `**ID local:** ${task.id}`,
        "",
        "### Descripción",
        task.description || "Sin descripción",
        "",
        "### Checklist",
        ...(checklist.length
          ? checklist.map((item) => `- [${item.done ? "x" : " "}] ${escapeMarkdown(item.text)}`)
          : ["Sin checklist"]),
        "",
        "### Entrega manual",
        "Preparada localmente para copiar y pegar. La copia no confirma creación ni sincronización en DashWeb.",
      ].join("\n");
    }
    return [
      `Tarea: ${task.title}`,
      `Prioridad: ${task.priority}`,
      `Estado local: ${STATUS_LABELS[task.status]}`,
      `Fecha límite: ${localDate(task.dueAt, workspace.timezone)}`,
      `Etiquetas: ${task.tags.length ? task.tags.join(", ") : "Sin etiquetas"}`,
      `ID local: ${task.id}`,
      "Descripción:",
      task.description || "Sin descripción",
      "Checklist:",
      ...(checklist.length ? checklist.map((item) => `${item.done ? "[x]" : "[ ]"} ${item.text}`) : ["Sin checklist"]),
      "Entrega manual: preparada localmente; no confirma creación ni sincronización en DashWeb.",
    ].join("\n");
  });
  const payload = blocks.join("\n\n---\n\n");
  return { payload, hash: hashPayload(payload), taskRevisions };
}

export function hashPayload(payload: string): string {
  let hash = 2166136261;
  for (let index = 0; index < payload.length; index += 1) {
    hash ^= payload.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function createHandoff(
  workspace: Workspace,
  taskIds: string[],
  format: "markdown" | "text" = "markdown",
): { handoff: Handoff; payload: string } {
  const built = buildHandoff(workspace, taskIds, format);
  const timestamp = nowIso();
  const handoff: Handoff = {
    id: newId("handoff"),
    taskIds: [...taskIds],
    taskRevisions: built.taskRevisions,
    adapterId: "manual",
    format,
    formatVersion: 1,
    payloadHash: built.hash,
    state: "previewed",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  return { handoff, payload: built.payload };
}

export function isHandoffStale(workspace: Workspace, handoff: Handoff): boolean {
  return handoff.taskIds.some((taskId) => {
    const task = workspace.tasks.find((item) => item.id === taskId);
    return !task || task.revision !== handoff.taskRevisions[taskId];
  });
}

export function exportSelection(workspace: Workspace, taskIds: string[]): string {
  const tasks = workspace.tasks.filter((task) => taskIds.includes(task.id) && !task.deletedAt);
  const notes = workspace.notes.filter((note) => noteIdsReferencedByTasks(workspace, note.id, taskIds));
  return JSON.stringify(
    {
      format: "rr-task-selection",
      format_version: 1,
      exported_at: nowIso(),
      workspace_id: workspace.workspaceId,
      data: {
        tasks: tasks.map(({ title, description, status, priority, tags, dueAt, position, createdAt, updatedAt }) => ({
          title,
          description,
          status,
          priority,
          tags,
          due_at: dueAt,
          position,
          created_at: createdAt,
          updated_at: updatedAt,
        })),
        notes: notes.map(({ title, body, tags, createdAt, updatedAt }) => ({
          title,
          body,
          tags,
          created_at: createdAt,
          updated_at: updatedAt,
        })),
      },
    },
    null,
    2,
  );
}

function noteIdsReferencedByTasks(workspace: Workspace, noteId: string, taskIds: string[]): boolean {
  return workspace.tasks.some((task) => taskIds.includes(task.id) && task.sourceNoteId === noteId);
}

export function exportBackup(workspace: Workspace): string {
  return JSON.stringify(
    {
      format: "rr-task-workspace",
      format_version: 2,
      exported_at: nowIso(),
      workspace_id: workspace.workspaceId,
      app_version: "0.1.0",
      data: workspace,
      warning: "Backup privado. Revisalo antes de compartirlo.",
    },
    null,
    2,
  );
}
