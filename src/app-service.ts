import { createWorkspace } from "./core";
import type { Settings, Workspace } from "./domain";
import type { PlatformPort } from "./platform";

/** The file that holds one workspace, inside the app data root. */
export function workspaceFilePath(root: string, workspaceId: string): string {
	const trimmed = root.replace(/[\\/]+$/, "");
	return `${trimmed}/${workspaceId}/workspace.json`;
}

export interface WorkspaceWriter {
	writeWorkspace(path: string, content: string): Promise<void>;
}

/** The non-secret settings file that remembers which workspace was last used. */
export function settingsFilePath(root: string): string {
	const trimmed = root.replace(/[\\/]+$/, "");
	return `${trimmed}/settings.json`;
}

interface AppSettings {
	lastWorkspacePath?: string;
}

/** Reads the remembered workspace path; an unreadable or missing file means "no preference". */
export async function readLastWorkspacePath(
	platform: { readAppFile(path: string): Promise<string> },
	root: string,
): Promise<string | undefined> {
	try {
		const raw = await platform.readAppFile(settingsFilePath(root));
		const parsed = JSON.parse(raw) as AppSettings;
		return typeof parsed.lastWorkspacePath === "string" && parsed.lastWorkspacePath.length > 0
			? parsed.lastWorkspacePath
			: undefined;
	} catch {
		return undefined;
	}
}

/** Remembers the active workspace so the next launch can reopen it. */
export async function rememberWorkspacePath(
	platform: { writeAppFile(path: string, content: string): Promise<void> },
	root: string,
	workspacePath: string,
): Promise<void> {
	await platform.writeAppFile(
		settingsFilePath(root),
		`${JSON.stringify({ lastWorkspacePath: workspacePath }, null, 2)}\n`,
	);
}

/**
 * Creates a workspace and writes it to its own file before the UI reports it as saved.
 * The path is passed explicitly so a brand-new workspace is never saved to the
 * previously selected path (or to none at all).
 */
export async function createWorkspaceAt(
	platform: WorkspaceWriter,
	root: string,
	name: string,
	theme: Settings["theme"] = "system",
): Promise<{ workspace: Workspace; path: string }> {
	const workspace = createWorkspace(name, "America/Bogota", theme);
	const path = workspaceFilePath(root, workspace.workspaceId);
	await platform.writeWorkspace(path, `${JSON.stringify(workspace, null, 2)}\n`);
	return { workspace, path };
}

/** Writes a workspace to the path the UI is currently using. */
export async function saveWorkspace(
	platform: WorkspaceWriter,
	path: string,
	workspace: Workspace,
): Promise<void> {
	await platform.writeWorkspace(path, `${JSON.stringify(workspace, null, 2)}\n`);
}

export type { PlatformPort };
