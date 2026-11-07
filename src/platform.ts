import type { Workspace } from "./domain";
import { validateWorkspace } from "./core";

export interface PlatformPort {
  defaultDataRoot(): Promise<string>;
  readWorkspace(path: string): Promise<string>;
  writeWorkspace(path: string, content: string): Promise<void>;
  /** Reads a small app file such as the settings pointer, without workspace validation. */
  readAppFile(path: string): Promise<string>;
  /** Writes a small app file, such as the settings pointer, to the local disk. */
  writeAppFile(path: string, content: string): Promise<void>;
  writeText(path: string, content: string): Promise<void>;
  pickWorkspaceFile(): Promise<string | null>;
  pickExportFile(defaultName: string): Promise<string | null>;
  copyText(text: string): Promise<void>;
  setAlwaysOnTop(enabled: boolean): Promise<void>;
}

const isTauri = (): boolean => "__TAURI_INTERNALS__" in window;

export const browserPlatform: PlatformPort = {
  async defaultDataRoot() {
    return "data";
  },
  async readWorkspace(path) {
    const response = await fetch(`/__workspace__?path=${encodeURIComponent(path)}`);
    if (!response.ok) throw new Error(await response.text());
    return response.text();
  },
  async writeWorkspace(path, content) {
    const response = await fetch("/__workspace__", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ path, content }),
    });
    if (!response.ok) throw new Error(await response.text());
  },
  async readAppFile(path) {
    const stored = window.localStorage.getItem(`rr-tareas:${path}`);
    if (stored === null) throw new Error("not found");
    return stored;
  },
  async writeAppFile(path, content) {
    window.localStorage.setItem(`rr-tareas:${path}`, content);
  },
  async writeText(path, content) {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = path.split(/[\\/]/).pop() ?? "rr-tareas.txt";
    anchor.click();
    URL.revokeObjectURL(url);
  },
  async pickWorkspaceFile() {
    return null;
  },
  async pickExportFile() {
    return null;
  },
  async copyText(text) {
    await navigator.clipboard.writeText(text);
  },
  async setAlwaysOnTop() {
    // Browser preview has no desktop window API.
  },
};

export async function createPlatform(): Promise<PlatformPort> {
  if (!isTauri()) return browserPlatform;
  const [{ invoke }, { open, save }] = await Promise.all([
    import("@tauri-apps/api/core"),
    import("@tauri-apps/plugin-dialog"),
  ]);
  return {
    defaultDataRoot: () => invoke<string>("default_data_root"),
    readWorkspace: (path) => invoke<string>("read_workspace", { path }),
    writeWorkspace: (path, content) => invoke<void>("write_workspace", { path, content }),
    readAppFile: (path) => invoke<string>("read_text", { path }),
    writeAppFile: (path, content) => invoke<void>("write_text", { path, content }),
    writeText: (path, content) => invoke<void>("write_text", { path, content }),
    async pickWorkspaceFile() {
      const selected = await open({
        multiple: false,
        directory: false,
        filters: [{ name: "RR Tareas workspace", extensions: ["json"] }],
      });
      return typeof selected === "string" ? selected : null;
    },
    async pickExportFile(defaultName) {
      const selected = await save({
        defaultPath: defaultName,
        filters: [{ name: "Texto", extensions: ["txt", "md"] }, { name: "JSON", extensions: ["json"] }],
      });
      return selected ?? null;
    },
    copyText: (text) => invoke<void>("copy_text", { text }),
    setAlwaysOnTop: (enabled) => invoke<void>("set_always_on_top", { enabled }),
  };
}

export async function loadWorkspace(platform: PlatformPort, path: string): Promise<Workspace> {
  const content = await platform.readWorkspace(path);
  return validateWorkspace(JSON.parse(content) as unknown);
}
