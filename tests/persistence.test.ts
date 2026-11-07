import { describe, expect, it } from "vitest";
import { createWorkspace, addCapture } from "../src/core";
import { WorkspaceRepository, type FileSystemLike } from "../src/persistence";

class MemoryFileSystem implements FileSystemLike {
  readonly files = new Map<string, string>();

  async read(path: string): Promise<string> {
    const value = this.files.get(path);
    if (value === undefined) throw new Error(`missing: ${path}`);
    return value;
  }

  async write(path: string, content: string): Promise<void> {
    this.files.set(path, content);
  }

  async exists(path: string): Promise<boolean> {
    return this.files.has(path);
  }

  async copy(path: string, destination: string): Promise<void> {
    const value = this.files.get(path);
    if (value === undefined) throw new Error(`missing: ${path}`);
    this.files.set(destination, value);
  }

  async rename(path: string, destination: string): Promise<void> {
    const value = this.files.get(path);
    if (value === undefined) throw new Error(`missing: ${path}`);
    this.files.set(destination, value);
    this.files.delete(path);
  }

  async remove(path: string): Promise<void> {
    this.files.delete(path);
  }
}

describe("workspace persistence", () => {
  it("survives save, close and reopen", async () => {
    const fs = new MemoryFileSystem();
    const repository = new WorkspaceRepository(fs);
    const path = "/tmp/workspace.json";
    let workspace = createWorkspace("Persistente");
    workspace = addCapture(workspace, "task", "No perder esta tarea");
    await repository.save(path, workspace);
    const reopened = await repository.load(path);
    expect(reopened.tasks[0].title).toBe("No perder esta tarea");
    expect(fs.files.has(`${path}.bak`)).toBe(false);
  });

  it("keeps a backup and recovers instead of replacing corrupt data", async () => {
    const fs = new MemoryFileSystem();
    const repository = new WorkspaceRepository(fs);
    const path = "/tmp/workspace.json";
    let workspace = createWorkspace("Respaldo");
    workspace = addCapture(workspace, "task", "Original");
    await repository.save(path, workspace);
    workspace = addCapture(workspace, "task", "Actualizada");
    await repository.save(path, workspace);
    expect(fs.files.has(`${path}.bak`)).toBe(true);
    fs.files.set(path, "{ broken json");
    await expect(repository.load(path)).rejects.toThrow();
    const recovered = await repository.recover(path);
    expect(recovered?.tasks).toHaveLength(1);
    expect(fs.files.get(path)).toBe("{ broken json");
  });
});
