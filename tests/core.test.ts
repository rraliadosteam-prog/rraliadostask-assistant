import { describe, expect, it } from "vitest";
import {
  addCapture,
  createWorkspace,
  moveTask,
  parseCapture,
  searchWorkspace,
  updateTask,
  validateWorkspace,
} from "../src/core";
import { buildHandoff, createHandoff, isHandoffStale } from "../src/handoff";
import { applyHelperProposal, createHelperProposal } from "../src/helpers";
import type { Workspace } from "../src/domain";

function seeded(): Workspace {
  let workspace = createWorkspace("Test RR");
  workspace = addCapture(workspace, "task", "Revisar propuesta BOGA\nAntes del comité");
  workspace = addCapture(workspace, "note", "Contexto de la propuesta");
  return workspace;
}

describe("capture and domain", () => {
  it("parses one and multiline captures and rejects empty text", () => {
    expect(parseCapture("  Hola  ")).toEqual({ title: "Hola", body: "" });
    expect(parseCapture("Título\nCuerpo\nMás")).toEqual({ title: "Título", body: "Cuerpo\nMás" });
    expect(() => parseCapture("  \n ")).toThrow(/vacía/);
  });

  it("creates local task and note records", () => {
    const workspace = seeded();
    expect(workspace.tasks).toHaveLength(1);
    expect(workspace.notes).toHaveLength(1);
    expect(workspace.tasks[0].status).toBe("inbox");
    expect(workspace.tasks[0].description).toBe("Antes del comité");
  });

  it("moves tasks and maintains completedAt", () => {
    const workspace = seeded();
    const task = workspace.tasks[0];
    const done = moveTask(workspace, task.id, "done");
    expect(done.tasks[0].completedAt).toBeTruthy();
    const reopened = moveTask(done, task.id, "todo");
    expect(reopened.tasks[0].completedAt).toBeNull();
    expect(reopened.tasks[0].revision).toBe(task.revision + 2);
  });

  it("rejects stale updates", () => {
    const workspace = seeded();
    const task = workspace.tasks[0];
    expect(() => updateTask(workspace, task.id, { title: "Nuevo" }, task.revision + 1)).toThrow(/cambió/);
  });

  it("searches titles, descriptions, tags and notes", () => {
    let workspace = seeded();
    const task = workspace.tasks[0];
    workspace = updateTask(workspace, task.id, { tags: ["comité"] });
    expect(searchWorkspace(workspace, "COMITÉ").tasks).toHaveLength(1);
    expect(searchWorkspace(workspace, "contexto").notes).toHaveLength(1);
    expect(searchWorkspace(workspace, "no-existe").tasks).toHaveLength(0);
  });

  it("validates format version and broken checklist references", () => {
    const workspace = seeded();
    expect(validateWorkspace(JSON.parse(JSON.stringify(workspace)))).toEqual(workspace);
    expect(() => validateWorkspace({ ...workspace, format_version: 3 })).toThrow(/futura/);
    const broken = { ...workspace, checklistItems: [{ taskId: "missing" }] };
    expect(() => validateWorkspace(broken)).toThrow(/checklist/);
  });
});

describe("manual handoff", () => {
  it("builds deterministic markdown and detects stale revisions", () => {
    let workspace = seeded();
    const task = workspace.tasks[0];
    const first = buildHandoff(workspace, [task.id]);
    const second = buildHandoff(workspace, [task.id]);
    expect(first.payload).toBe(second.payload);
    expect(first.hash).toBe(second.hash);
    expect(first.payload).toContain("no confirma creación ni sincronización en DashWeb");
    const handoff = createHandoff(workspace, [task.id]).handoff;
    expect(isHandoffStale(workspace, handoff)).toBe(false);
    workspace = updateTask(workspace, task.id, { title: "Cambió" });
    expect(isHandoffStale(workspace, handoff)).toBe(true);
  });
});

describe("local helpers", () => {
  it("previews without changing the workspace", () => {
    const workspace = seeded();
    const task = workspace.tasks[0];
    const proposal = createHelperProposal(workspace, "desglosar", task.id);
    expect(workspace.tasks[0]).toEqual(task);
    expect(proposal.baseRevision).toBe(task.revision);
    expect(proposal.preview).toContain("1.");
  });

  it("rejects forbidden patches and stale proposals", () => {
    let workspace = seeded();
    const task = workspace.tasks[0];
    const proposal = createHelperProposal(workspace, "proponer_prioridad", task.id);
    const forbidden = { ...proposal, targetFields: ["description" as const], changes: { title: "hack" } };
    expect(() => applyHelperProposal(workspace, forbidden)).toThrow(/no permitido/);
    workspace = updateTask(workspace, task.id, { title: "Cambió" });
    expect(() => applyHelperProposal(workspace, proposal)).toThrow(/cambió/);
  });
});
