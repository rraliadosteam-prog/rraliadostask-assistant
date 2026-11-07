import type { HelperProposal, Note, Task, Workspace } from "./domain";
import { DomainError } from "./core";

export type HelperId =
  | "resumir"
  | "desglosar"
  | "detectar_faltantes"
  | "proponer_prioridad"
  | "preparar_handoff"
  | "convertir_nota";

export const HELPER_LABELS: Record<HelperId, string> = {
  resumir: "Resumir",
  desglosar: "Desglosar",
  detectar_faltantes: "Detectar faltantes",
  proponer_prioridad: "Proponer prioridad",
  preparar_handoff: "Preparar handoff",
  convertir_nota: "Convertir nota",
};

function textOf(entity: Task | Note): string {
  return "description" in entity ? `${entity.title}\n${entity.description}` : `${entity.title}\n${entity.body}`;
}

export function createHelperProposal(
  workspace: Workspace,
  helperId: HelperId,
  entityId: string,
): HelperProposal {
  const task = workspace.tasks.find((item) => item.id === entityId);
  const note = workspace.notes.find((item) => item.id === entityId);
  const entity = task ?? note;
  if (!entity) throw new DomainError("not_found", "La entidad no existe.");
  const text = textOf(entity).trim();
  const words = text.split(/\s+/).filter(Boolean);
  const sentences = text.split(/[.!?\n]+/).map((part) => part.trim()).filter(Boolean);

  switch (helperId) {
    case "resumir": {
      const summary = sentences[0] ?? entity.title;
      return proposal(helperId, entity, ["description"], { description: summary }, `Resumen sugerido:\n${summary}`);
    }
    case "desglosar": {
      const steps = words.slice(0, 5).map((word, index) => `${index + 1}. ${word}`);
      return proposal(helperId, entity, ["checklist"], { checklist: steps }, steps.join("\n"));
    }
    case "detectar_faltantes": {
      const missing: string[] = [];
      if (task) {
        if (!task.dueAt) missing.push("Falta una fecha límite.");
        if (!task.tags.length) missing.push("Faltan etiquetas.");
        if (!task.description.trim()) missing.push("Falta contexto o descripción.");
      } else if (note) {
        if (!note.body.trim()) missing.push("La nota no tiene contexto.");
        if (!note.tags.length) missing.push("Faltan etiquetas.");
      }
      const preview = missing.length ? missing.join("\n") : "No detecté faltantes obvios.";
      return proposal(helperId, entity, [], { missing }, preview);
    }
    case "proponer_prioridad": {
      const urgent = /urgente|bloque|producción|venci|ahora/i.test(text);
      const priority = urgent ? "urgent" : /importante|cliente|comité/i.test(text) ? "high" : "normal";
      const reason = urgent
        ? "El texto contiene una señal de urgencia o bloqueo."
        : priority === "high"
          ? "El texto sugiere una tarea relevante o con cliente/comité."
          : "No hay señales que eleven la prioridad.";
      return proposal(helperId, entity, ["priority"], { priority, reason }, `Prioridad propuesta: ${priority}.\n${reason}`);
    }
    case "preparar_handoff": {
      return proposal(
        helperId,
        entity,
        [],
        { action: "prepare_manual_handoff" },
        "Abrí Preparar entrega manual para revisar y copiar el texto. Esta sugerencia no envía nada.",
      );
    }
    case "convertir_nota": {
      if (!note) throw new DomainError("validation_error", "Este helper solo convierte notas.");
      const title = note.title.trim();
      return proposal(helperId, note, ["note"], { title, body: note.body }, `Tarea propuesta:\n${title}`);
    }
  }
}

function proposal(
  helperId: HelperId,
  entity: Task | Note,
  targetFields: HelperProposal["targetFields"],
  changes: Record<string, unknown>,
  preview: string,
): HelperProposal {
  return {
    helperId,
    entityId: entity.id,
    baseRevision: entity.revision,
    targetFields,
    changes,
    preview,
  };
}

export function applyHelperProposal(
  workspace: Workspace,
  proposal: HelperProposal,
): Workspace {
  const task = workspace.tasks.find((item) => item.id === proposal.entityId);
  const note = workspace.notes.find((item) => item.id === proposal.entityId);
  const entity = task ?? note;
  if (!entity) throw new DomainError("not_found", "La entidad no existe.");
  if (entity.revision !== proposal.baseRevision) {
    throw new DomainError("revision_conflict", "La entidad cambió; regenerá la propuesta.");
  }
  const allowed = new Set(proposal.targetFields);
  for (const field of Object.keys(proposal.changes)) {
    if (!allowed.has(field as HelperProposal["targetFields"][number])) {
      throw new DomainError("helper_invalid_output", `El helper intentó modificar un campo no permitido: ${field}.`);
    }
  }
  if (!task) return workspace;
  const timestamp = new Date().toISOString();
  const updated: Task = {
    ...task,
    title: typeof proposal.changes.title === "string" ? proposal.changes.title : task.title,
    description:
      typeof proposal.changes.description === "string" ? proposal.changes.description : task.description,
    priority:
      proposal.changes.priority === "low" ||
      proposal.changes.priority === "normal" ||
      proposal.changes.priority === "high" ||
      proposal.changes.priority === "urgent"
        ? proposal.changes.priority
        : task.priority,
    updatedAt: timestamp,
    revision: task.revision + 1,
  };
  return {
    ...workspace,
    tasks: workspace.tasks.map((item) => (item.id === task.id ? updated : item)),
    updatedAt: timestamp,
  };
}
