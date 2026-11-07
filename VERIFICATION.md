# Verification — RR Tareas local MVP

**Cut:** 7 November 2026

## Automated checks

| Check | Result | Evidence |
|---|---|---|
| TypeScript typecheck | PASS | `pnpm typecheck` exited 0. |
| Domain and persistence tests | PASS | `pnpm test`: 3 files, 15 tests passed. |
| Web production build | PASS | `pnpm build`: 39 modules transformed; `dist/index.html` plus CSS/JS emitted. |
| Dependency audit | PASS | `pnpm audit --prod --audit-level high`: no known vulnerabilities. |
| Native Tauri compile | PASS | `pnpm tauri build --no-bundle` exited 0; binary at `src-tauri/target/release/rr-tareas`. |

The first native build exposed two concrete defects and both were corrected:

1. The Tauri permission manifest named FS permissions before the FS plugin was registered; the corrected manifest/plugin set is in `src-tauri/capabilities/default.json` and `src-tauri/src/lib.rs`.
2. The native command and its helper initially shared the same Rust name, and the placeholder icon was RGB instead of RGBA. The helper is now `resolve_data_root`; the icon is generated as RGBA by `scripts/generate-icon.mjs`.

A third native smoke issue was found during the accessibility check: `window.prompt` blocked the desktop provider. The first-run action now creates the default local workspace directly, so it does not depend on a modal prompt.

## Browser proof

- Local UI served at `http://127.0.0.1:1420/`.
- Browser DOM read confirmed the first-run screen: create/open workspace, local-only promise, and manual DashWeb copy wording.
- No account, provider, secret, network integration, or DashWeb request exists in the core manual flow.

## Native desktop proof

- The release binary compiles and opens as a 420×640 desktop window.
- First run: `Crear workspace` writes `data/<workspace_id>/workspace.json` (`format: rr-task-workspace`, `format_version: 2`) and `data/settings.json`, and the UI reports `Guardado local`.
- Restart: relaunching the same binary reopens that workspace automatically, so data survives closing and reopening.
- Portable mode: a `portable.flag` next to the executable moves the data root to `<executable>/data`.

Defect found and fixed during this smoke: the first save of a brand-new workspace used the stale path, so the UI reported `Guardado local` without writing any file. The fix writes the new workspace to its own path through `createWorkspaceAt` and remembers the active path in `data/settings.json`. Regression coverage lives in `tests/app-service.test.ts`.

## Covered MVP criteria

- Independent Tauri 2 + React/TypeScript project.
- Compact floating window configuration, resizable, opt-in always-on-top.
- First-run create/open workspace flow.
- Versioned authoritative JSON with backup recovery.
- Quick task/note capture and deterministic title/body split.
- Task status transitions, priority, tags, due date, checklist, search/filter.
- Note creation/edit/archive.
- Manual Markdown handoff preview, copy/export, explicit non-verification warning.
- Selection and private backup export.
- Six visible local helpers with preview/apply/discard and revision/allowlist guards.
- Accessible labels, focus, status messages, reduced motion and compact responsive layout.

## Remaining limitations

- No signed installer or published release yet; the release workflow is ready but a tag has to be pushed by someone with write access.
- No model-backed helper and no DashWeb API write path; manual copy is the verified path.
- No global shortcut implementation yet; the in-app Ctrl/Command+Enter capture shortcut works.
- No automated E2E desktop test or Windows clean-install test yet.
- The licence of the published repository is still an open decision for RR Aliados.
