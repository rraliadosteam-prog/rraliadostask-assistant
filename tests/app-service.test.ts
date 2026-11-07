import { describe, expect, it } from "vitest";
import {
	createWorkspaceAt,
	readLastWorkspacePath,
	rememberWorkspacePath,
	saveWorkspace,
	settingsFilePath,
	workspaceFilePath,
} from "../src/app-service";
import { validateWorkspace } from "../src/core";

class RecordingWriter {
	readonly writes: Array<{ path: string; content: string }> = [];

	async writeWorkspace(path: string, content: string): Promise<void> {
		this.writes.push({ path, content });
	}

	async writeAppFile(path: string, content: string): Promise<void> {
		this.writes.push({ path, content });
	}

	async readAppFile(path: string): Promise<string> {
		const found = this.writes.find((write) => write.path === path);
		if (!found) throw new Error("not found");
		return found.content;
	}
}

describe("workspace application service", () => {
	it("writes a brand-new workspace to its own path", async () => {
		const writer = new RecordingWriter();
		const { workspace, path } = await createWorkspaceAt(writer, "/data/RR Tareas", "RR Aliados");
		expect(path).toBe(workspaceFilePath("/data/RR Tareas", workspace.workspaceId));
		expect(writer.writes).toHaveLength(1);
		expect(writer.writes[0].path).toBe(path);
		const saved = validateWorkspace(JSON.parse(writer.writes[0].content) as unknown);
		expect(saved.workspaceId).toBe(workspace.workspaceId);
		expect(saved.name).toBe("RR Aliados");
	});

	it("never writes a workspace to an empty or stale path", async () => {
		const writer = new RecordingWriter();
		const first = await createWorkspaceAt(writer, "/data", "Uno");
		const second = await createWorkspaceAt(writer, "/data", "Dos");
		expect(writer.writes.map((write) => write.path)).toEqual([first.path, second.path]);
		expect(first.path).not.toBe(second.path);
		await saveWorkspace(writer, first.path, first.workspace);
		expect(writer.writes[2].path).toBe(first.path);
	});

	it("remembers and reopens the last workspace", async () => {
		const writer = new RecordingWriter();
		const { path } = await createWorkspaceAt(writer, "/data", "Recordada");
		await rememberWorkspacePath(writer, "/data", path);
		expect(writer.writes[1].path).toBe(settingsFilePath("/data"));
		await expect(readLastWorkspacePath(writer, "/data")).resolves.toBe(path);
	});

	it("treats a missing or broken settings file as no preference", async () => {
		const writer = new RecordingWriter();
		await expect(readLastWorkspacePath(writer, "/data")).resolves.toBeUndefined();
		await writer.writeAppFile(settingsFilePath("/data"), "{ broken");
		await expect(readLastWorkspacePath(writer, "/data")).resolves.toBeUndefined();
	});
});
