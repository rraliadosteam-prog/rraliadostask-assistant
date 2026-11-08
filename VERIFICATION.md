# Verification — RR Tareas local MVP

**Cut:** 7 November 2026
**Project:** `/home/deadkiss/rr-encargos/2026-11-07_rr-floating-task-assistant`

## Automated checks

| Check | Result | Evidence |
|---|---|---|
| TypeScript typecheck | PASS | `pnpm typecheck` exited 0. |
| Domain and persistence tests | PASS | `pnpm test`: 3 files, 16 tests passed. |
| Web production build | PASS | `pnpm build`: 39 modules transformed; `dist/index.html` plus CSS/JS emitted, including the local RR logo asset. |
| Dependency audit | PASS | `pnpm audit --prod --audit-level high`: no known vulnerabilities. |
| Native Tauri compile | PASS | `pnpm tauri build --no-bundle` exited 0; binary at `src-tauri/target/release/rr-tareas`. |

The first native build exposed two concrete defects and both were corrected:

1. The Tauri permission manifest named FS permissions before the FS plugin was registered; the corrected manifest/plugin set is in `src-tauri/capabilities/default.json` and `src-tauri/src/lib.rs`.
2. The native command and its helper initially shared the same Rust name. The helper is now `resolve_data_root`; the native icon is copied from the canonical RR logo asset by `scripts/generate-icon.mjs`.

A third native smoke issue was found during the accessibility check: `window.prompt` blocked the desktop provider. The first-run action now creates the default local workspace directly, so it does not depend on a modal prompt.

## Browser proof

- Local UI served at `http://127.0.0.1:1420/`.
- Browser DOM read confirmed the first-run screen: create/open workspace, local-only promise, manual DashWeb copy wording, canonical RR logo and theme selector.
- Preview screenshots verified the first-run screen in light and dark themes; the selector also supports system theme.
- Screenshot: `/home/deadkiss/.gentle-dot/home/.gentle-dot/screenshots/shot-1794077575240.png`.
- No account, provider, secret, network integration, or DashWeb request exists in the core manual flow.

## Native desktop proof

- The release binary compiles and opens as a 420×640 desktop window (`src-tauri/target/release/rr-tareas`).
- First run: `Crear workspace` writes `data/<workspace_id>/workspace.json` (`format: rr-task-workspace`, `format_version: 2`) and `data/settings.json`, and the UI reports `Guardado local`.
- Restart: relaunching the same binary reopens that workspace automatically (the capture screen is shown instead of the first-run screen), so data survives closing and reopening.
- Portable mode: a `portable.flag` next to the executable moves the data root to `<executable>/data`.
- Linux launcher: `/home/deadkiss/.local/share/applications/rr-tareas.desktop`; `desktop-file-validate` passed and its icon matches `public/brand/rr-logo-fucsia-on-negro.png`.

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
- Accessible labels, focus, status messages, reduced motion, compact responsive layout and the canonical RR logo in the setup/topbar surfaces.

## Remaining limitations

- No signed installer or public release. Organization, repository name/visibility and license still need Rosas's decision.
- No model-backed helper and no DashWeb API write path; manual copy is the verified path.
- No global shortcut implementation yet; the in-app Ctrl/Command+Enter capture shortcut works.
- No automated E2E desktop test or Windows clean-install test yet.
- The current native binary compiled with the canonical RR logo copied into `src-tauri/icons/icon.png` and launched as a 420×657 desktop window; the first-run action created a workspace and the UI reported `Guardado local`. A full capture/save/reopen click-through remains unavailable in this session because the desktop-control provider could not focus the window; no private configuration or sign-in data was read to bypass that limitation.
