import type { Workspace } from "./domain";
import { validateWorkspace } from "./core";

export interface FileSystemLike {
  read(path: string): Promise<string>;
  write(path: string, content: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  copy(path: string, destination: string): Promise<void>;
  rename(path: string, destination: string): Promise<void>;
  remove(path: string): Promise<void>;
}

export class WorkspaceRepository {
  constructor(private readonly fs: FileSystemLike) {}

  async load(path: string): Promise<Workspace> {
    const raw = await this.fs.read(path);
    return validateWorkspace(JSON.parse(raw) as unknown);
  }

  async save(path: string, workspace: Workspace): Promise<void> {
    const content = `${JSON.stringify(workspace, null, 2)}\n`;
    validateWorkspace(JSON.parse(content) as unknown);
    const temporary = `${path}.tmp`;
    await this.fs.write(temporary, content);
    if (await this.fs.exists(path)) {
      await this.fs.copy(path, `${path}.bak`);
    }
    await this.fs.rename(temporary, path);
  }

  async recover(path: string): Promise<Workspace | null> {
    const backup = `${path}.bak`;
    if (!(await this.fs.exists(backup))) return null;
    const raw = await this.fs.read(backup);
    return validateWorkspace(JSON.parse(raw) as unknown);
  }
}
