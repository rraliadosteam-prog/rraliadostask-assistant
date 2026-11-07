import { useEffect, useMemo, useRef, useState } from "react";
import {
  addCapture,
  addChecklistItem,
  deleteNote,
  deleteTask,
  moveTask,
  searchWorkspace,
  updateNote,
  updateTask,
  type DomainError,
} from "./core";
import type { HelperProposal, SaveState, TaskStatus, Workspace } from "./domain";
import { applyHelperProposal, createHelperProposal, HELPER_LABELS, type HelperId } from "./helpers";
import {
	createWorkspaceAt,
	readLastWorkspacePath,
	rememberWorkspacePath,
	saveWorkspace,
} from "./app-service";
import { createHandoff, exportBackup, exportSelection, isHandoffStale } from "./handoff";
import { createPlatform, loadWorkspace, type PlatformPort } from "./platform";

const STATUS_ORDER: TaskStatus[] = ["inbox", "todo", "in_progress", "blocked", "done"];
const STATUS_NAMES: Record<TaskStatus, string> = {
  inbox: "Entrada",
  todo: "Siguientes",
  in_progress: "En curso",
  blocked: "Bloqueadas",
  done: "Hechas",
  canceled: "Canceladas",
};

export default function App() {
  const [platform, setPlatform] = useState<PlatformPort | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [workspacePath, setWorkspacePath] = useState("");
  /** The path of the active workspace, kept in sync so a save never uses a stale value. */
  const workspacePathRef = useRef("");
  const [capture, setCapture] = useState("");
  const [captureKind, setCaptureKind] = useState<"task" | "note">("task");
  const [view, setView] = useState<"tasks" | "notes">("tasks");
  const [filter, setFilter] = useState<TaskStatus | "all">("all");
  const [query, setQuery] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [message, setMessage] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [helper, setHelper] = useState<HelperProposal | null>(null);
  const [handoffPayload, setHandoffPayload] = useState("");
  const [handoffStale, setHandoffStale] = useState(false);
  const [newChecklist, setNewChecklist] = useState("");

  useEffect(() => {
    void createPlatform().then(async (created) => {
      setPlatform(created);
      // Reopen the last workspace so the data survives closing and reopening the app.
      try {
        const root = await created.defaultDataRoot();
        const lastPath = await readLastWorkspacePath(created, root);
        if (!lastPath) return;
        const loaded = await loadWorkspace(created, lastPath);
        workspacePathRef.current = lastPath;
        setWorkspace(loaded);
        setWorkspacePath(lastPath);
        setSaveState("saved");
        setMessage(`Workspace abierto: ${loaded.name}`);
      } catch {
        // No previous workspace, or it cannot be read: the first-run screen stays.
      }
    });
  }, []);

  const searched = useMemo(
    () => (workspace ? searchWorkspace(workspace, query) : { tasks: [], notes: [] }),
    [workspace, query],
  );
  const selectedTask = workspace?.tasks.find((task) => task.id === selectedTaskId) ?? null;
  const selectedNote = workspace?.notes.find((note) => note.id === selectedNoteId) ?? null;

  async function persist(next: Workspace, path?: string) {
    setWorkspace(next);
    setSaveState("dirty");
    const target = path ?? workspacePathRef.current;
    if (!platform || !target) {
      setSaveState("error");
      setMessage("No se pudo guardar: todavía no hay un workspace abierto.");
      return;
    }
    setSaveState("saving");
    try {
      await saveWorkspace(platform, target, next);
      setSaveState("saved");
    } catch (error) {
      setSaveState("error");
      setMessage(`No se pudo guardar: ${String(error)}`);
    }
  }

  async function createLocalWorkspace() {
    if (!platform) return;
    const root = await platform.defaultDataRoot();
    try {
      const { workspace: next, path } = await createWorkspaceAt(platform, root, "RR Aliados");
      workspacePathRef.current = path;
      setWorkspacePath(path);
      setWorkspace(next);
      setSaveState("saved");
      await rememberWorkspacePath(platform, root, path);
      setMessage("Workspace creado. Todo queda en este equipo.");
    } catch (error) {
      setSaveState("error");
      setMessage(`No se pudo crear el workspace: ${String(error)}`);
    }
  }

  async function openLocalWorkspace() {
    if (!platform) return;
    const path = await platform.pickWorkspaceFile();
    if (!path) return;
    try {
      const loaded = await loadWorkspace(platform, path);
      workspacePathRef.current = path;
      setWorkspace(loaded);
      setWorkspacePath(path);
      setSaveState("saved");
      const root = await platform.defaultDataRoot();
      await rememberWorkspacePath(platform, root, path);
      setMessage(`Workspace abierto: ${loaded.name}`);
    } catch (error) {
      setMessage(`No se pudo abrir: ${errorMessage(error)}`);
    }
  }

  async function saveCapture() {
    if (!workspace) return;
    try {
      const next = addCapture(workspace, captureKind, capture);
      setCapture("");
      await persist(next);
      setMessage(captureKind === "task" ? "Tarea guardada localmente." : "Nota guardada localmente.");
    } catch (error) {
      setMessage(errorMessage(error));
    }
  }

  async function changeTaskStatus(taskId: string, status: TaskStatus) {
    if (!workspace) return;
    try {
      await persist(moveTask(workspace, taskId, status));
    } catch (error) {
      setMessage(errorMessage(error));
    }
  }

  async function removeTask(taskId: string) {
    if (!workspace) return;
    await persist(deleteTask(workspace, taskId));
    setSelectedTaskId(null);
  }

  async function removeNote(noteId: string) {
    if (!workspace) return;
    await persist(deleteNote(workspace, noteId));
    setSelectedNoteId(null);
  }

  async function editTask(field: "title" | "description", value: string) {
    if (!workspace || !selectedTask) return;
    try {
      await persist(updateTask(workspace, selectedTask.id, { [field]: value }));
    } catch (error) {
      setMessage(errorMessage(error));
    }
  }

  async function editNote(field: "title" | "body", value: string) {
    if (!workspace || !selectedNote) return;
    try {
      await persist(updateNote(workspace, selectedNote.id, { [field]: value }));
    } catch (error) {
      setMessage(errorMessage(error));
    }
  }

  async function addStep() {
    if (!workspace || !selectedTask || !newChecklist.trim()) return;
    await persist(addChecklistItem(workspace, selectedTask.id, newChecklist));
    setNewChecklist("");
  }

  async function runHelper(helperId: HelperId) {
    if (!workspace || !selectedTask) return;
    try {
      setHelper(createHelperProposal(workspace, helperId, selectedTask.id));
    } catch (error) {
      setMessage(errorMessage(error));
    }
  }

  async function applyHelper() {
    if (!workspace || !helper) return;
    try {
      const next = applyHelperProposal(workspace, helper);
      await persist(next);
      setHelper(null);
      setMessage("Sugerencia aplicada localmente.");
    } catch (error) {
      setMessage(errorMessage(error));
    }
  }

  async function prepareHandoff() {
    if (!workspace || !selectedTask) return;
    const built = createHandoff(workspace, [selectedTask.id]);
    setHandoffPayload(built.payload);
    setHandoffStale(isHandoffStale(workspace, built.handoff));
    setMessage("Preview manual listo. Copiar no crea nada en DashWeb.");
  }

  async function copyHandoff() {
    if (!platform || !handoffPayload || handoffStale) return;
    try {
      await platform.copyText(handoffPayload);
      setMessage("Copiado al portapapeles. La creación externa no está verificada.");
    } catch (error) {
      setMessage(`No se pudo copiar: ${errorMessage(error)}`);
    }
  }

  async function exportFile(kind: "selection" | "backup") {
    if (!platform || !workspace) return;
    const content = kind === "selection" ? exportSelection(workspace, selectedTaskId ? [selectedTaskId] : []) : exportBackup(workspace);
    const name = kind === "selection" ? "rr-tareas-tarea.json" : "rr-tareas-backup.json";
    const path = await platform.pickExportFile(name);
    if (!path) return;
    try {
      await platform.writeText(path, content);
      setMessage(kind === "selection" ? "Selección exportada." : "Backup privado exportado; revisalo antes de compartirlo.");
    } catch (error) {
      setMessage(`No se pudo exportar: ${errorMessage(error)}`);
    }
  }

  async function toggleAlwaysOnTop() {
    if (!platform || !workspace) return;
    const enabled = !workspace.settings.alwaysOnTop;
    try {
      await platform.setAlwaysOnTop(enabled);
      await persist({
        ...workspace,
        settings: { ...workspace.settings, alwaysOnTop: enabled },
      });
    } catch (error) {
      setMessage(errorMessage(error));
    }
  }

  if (!platform) return <main className="boot">Preparando RR Tareas…</main>;

  if (!workspace) {
    return (
      <main className="setup">
        <section className="setup-card">
          <span className="brand-mark">R</span>
          <p className="eyebrow">RR ALIADOS · LOCAL</p>
          <h1>Tu bloque de tareas, sin perder el foco.</h1>
          <p>Empezá con un workspace local. No pide cuenta, red ni conexión con DashWeb.</p>
          <div className="setup-actions">
            <button className="primary" onClick={() => void createLocalWorkspace()}>Crear workspace</button>
            <button onClick={() => void openLocalWorkspace()}>Abrir workspace</button>
          </div>
          <p className="fine">El MVP guarda datos localmente y ofrece copia manual para DashWeb.</p>
        </section>
      </main>
    );
  }

  const visibleTasks = searched.tasks.filter((task) => filter === "all" || task.status === filter);
  const visibleNotes = searched.notes;

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark small">R</span><strong>RR Tareas</strong></div>
        <div className="top-actions">
          <button className="icon-button" aria-label="Alternar siempre encima" title="Siempre encima" onClick={() => void toggleAlwaysOnTop()}>
            {workspace.settings.alwaysOnTop ? "↑" : "↗"}
          </button>
          <span className={`save-state ${saveState}`} role="status">{saveLabel(saveState)}</span>
        </div>
      </header>

      <section className="capture" aria-labelledby="capture-title">
        <div className="section-heading">
          <h2 id="capture-title">Captura rápida</h2>
          <div className="segmented" aria-label="Tipo de captura">
            <button className={captureKind === "task" ? "active" : ""} onClick={() => setCaptureKind("task")}>Tarea</button>
            <button className={captureKind === "note" ? "active" : ""} onClick={() => setCaptureKind("note")}>Nota</button>
          </div>
        </div>
        <textarea
          aria-label="Texto de captura"
          placeholder="Escribí una tarea, una idea o una nota…"
          value={capture}
          onChange={(event) => setCapture(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
              event.preventDefault();
              void saveCapture();
            }
          }}
        />
        <div className="capture-footer">
          <span>Ctrl/⌘ + Enter para guardar</span>
          <button className="primary" onClick={() => void saveCapture()}>Guardar</button>
        </div>
      </section>

      <nav className="view-tabs" aria-label="Vista principal">
        <button className={view === "tasks" ? "active" : ""} onClick={() => setView("tasks")}>Tareas</button>
        <button className={view === "notes" ? "active" : ""} onClick={() => setView("notes")}>Notas</button>
        <label className="search"><span className="sr-only">Buscar</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar…" /></label>
      </nav>

      {view === "tasks" ? (
        <>
          <nav className="filters" aria-label="Filtros de tareas">
            <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>Todas</button>
            {STATUS_ORDER.map((status) => <button key={status} className={filter === status ? "active" : ""} onClick={() => setFilter(status)}>{STATUS_NAMES[status]}</button>)}
          </nav>
          <section className="list" aria-label="Tareas">
            {visibleTasks.length === 0 ? <EmptyState label="No hay tareas para esta vista." /> : visibleTasks.map((task) => (
              <article key={task.id} className={`task-card ${selectedTaskId === task.id ? "selected" : ""}`} onClick={() => setSelectedTaskId(task.id)}>
                <button className="task-check" aria-label={`Marcar ${task.title}`} onClick={(event) => { event.stopPropagation(); void changeTaskStatus(task.id, task.status === "done" ? "todo" : "done"); }} />
                <div>
                  <h3>{task.title}</h3>
                  {task.description && <p>{task.description}</p>}
                  <div className="chips"><span>{STATUS_NAMES[task.status]}</span>{task.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
                </div>
              </article>
            ))}
          </section>
        </>
      ) : (
        <section className="list" aria-label="Notas">
          {visibleNotes.length === 0 ? <EmptyState label="No hay notas para esta búsqueda." /> : visibleNotes.map((note) => (
            <article key={note.id} className={`task-card ${selectedNoteId === note.id ? "selected" : ""}`} onClick={() => setSelectedNoteId(note.id)}>
              <div><h3>{note.title}</h3>{note.body && <p>{note.body}</p>}<div className="chips"><span>Nota</span>{note.tags.map((tag) => <span key={tag}>{tag}</span>)}</div></div>
            </article>
          ))}
        </section>
      )}

      {selectedTask && (
        <section className="detail" aria-label="Detalle de tarea">
          <div className="detail-head"><h2>Tarea</h2><button className="icon-button" aria-label="Cerrar detalle" onClick={() => setSelectedTaskId(null)}>×</button></div>
          <label>Título<input value={selectedTask.title} onChange={(event) => void editTask("title", event.target.value)} /></label>
          <label>Descripción<textarea value={selectedTask.description} onChange={(event) => void editTask("description", event.target.value)} /></label>
          <div className="form-grid">
            <label>Estado<select value={selectedTask.status} onChange={(event) => void changeTaskStatus(selectedTask.id, event.target.value as TaskStatus)}>{Object.entries(STATUS_NAMES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label>Prioridad<select value={selectedTask.priority} onChange={(event) => { if (workspace) void persist(updateTask(workspace, selectedTask.id, { priority: event.target.value as "low" | "normal" | "high" | "urgent" })); }}>{["low", "normal", "high", "urgent"].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          </div>
          <label>Etiquetas<input value={selectedTask.tags.join(", ")} onChange={(event) => { if (workspace) void persist(updateTask(workspace, selectedTask.id, { tags: event.target.value.split(",").map((tag) => tag.trim()).filter(Boolean) })); }} /></label>
          <label>Fecha límite<input type="date" value={selectedTask.dueAt?.slice(0, 10) ?? ""} onChange={(event) => { if (workspace) void persist(updateTask(workspace, selectedTask.id, { dueAt: event.target.value ? new Date(`${event.target.value}T12:00:00`).toISOString() : null })); }} /></label>
          <section className="checklist"><h3>Checklist</h3>{workspace.checklistItems.filter((item) => item.taskId === selectedTask.id).map((item) => <div key={item.id}><input type="checkbox" checked={item.done} readOnly /><span>{item.text}</span></div>)}<div className="inline-add"><input aria-label="Nuevo paso" value={newChecklist} onChange={(event) => setNewChecklist(event.target.value)} /><button onClick={() => void addStep()}>Añadir</button></div></section>
          <section className="helpers"><h3>Ayudantes visibles</h3><div className="helper-buttons">{(Object.keys(HELPER_LABELS) as HelperId[]).map((id) => <button key={id} onClick={() => void runHelper(id)}>{HELPER_LABELS[id]}</button>)}</div></section>
          <div className="detail-actions"><button className="primary" onClick={() => void prepareHandoff()}>Preparar entrega manual</button><button onClick={() => void exportFile("selection")}>Exportar selección</button><button className="danger" onClick={() => void removeTask(selectedTask.id)}>Mover a papelera</button></div>
        </section>
      )}

      {selectedNote && (
        <section className="detail" aria-label="Detalle de nota">
          <div className="detail-head"><h2>Nota</h2><button className="icon-button" aria-label="Cerrar detalle" onClick={() => setSelectedNoteId(null)}>×</button></div>
          <label>Título<input value={selectedNote.title} onChange={(event) => void editNote("title", event.target.value)} /></label>
          <label>Contenido<textarea value={selectedNote.body} onChange={(event) => void editNote("body", event.target.value)} /></label>
          <button className="danger" onClick={() => void removeNote(selectedNote.id)}>Archivar nota</button>
        </section>
      )}

      {helper && (
        <section className="modal" role="dialog" aria-modal="true" aria-label="Vista previa de sugerencia">
          <div className="modal-card"><h2>Revisar sugerencia</h2><p className="muted">Método local · no usa IA · no escribe hasta que apliques.</p><pre>{helper.preview}</pre><div className="detail-actions"><button className="primary" onClick={() => void applyHelper()}>Aplicar</button><button onClick={() => setHelper(null)}>Descartar</button></div></div>
        </section>
      )}

      {handoffPayload && (
        <section className="modal" role="dialog" aria-modal="true" aria-label="Entrega manual">
          <div className="modal-card"><h2>Entrega manual</h2><p className="muted">Copiar no confirma creación ni sincronización en DashWeb.</p>{handoffStale && <p className="warning" role="alert">La tarea cambió. Regenerá el preview antes de copiar.</p>}<pre>{handoffPayload}</pre><div className="detail-actions"><button className="primary" disabled={handoffStale} onClick={() => void copyHandoff()}>Copiar</button><button onClick={() => setHandoffPayload("")}>Cerrar</button></div></div>
        </section>
      )}

      <footer className="footer-bar"><span>{workspace.name}</span><button onClick={() => void exportFile("backup")}>Backup privado</button></footer>
      <div className="toast" role="status" aria-live="polite">{message}</div>
    </main>
  );
}

function EmptyState({ label }: { label: string }) {
  return <div className="empty">{label}</div>;
}

function saveLabel(state: SaveState): string {
  return { idle: "Sin cambios", dirty: "Sin guardar", saving: "Guardando…", saved: "Guardado local", error: "Error al guardar" }[state];
}

function errorMessage(error: unknown): string {
  if (error && typeof error === "object" && "code" in error) {
    const domainError = error as DomainError;
    return domainError.message;
  }
  return error instanceof Error ? error.message : String(error);
}
