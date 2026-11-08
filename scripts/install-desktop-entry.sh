#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
BIN=${RR_TAREAS_BIN:-"$ROOT/src-tauri/target/release/rr-tareas"}
ICON_SOURCE="$ROOT/public/brand/rr-logo-fucsia-on-negro.png"
TEMPLATE="$ROOT/desktop/rr-tareas.desktop.in"
APP_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
ICON_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/icons/hicolor/1024x1024/apps"
DESKTOP_FILE="$APP_DIR/rr-tareas.desktop"
ICON_FILE="$ICON_DIR/rr-tareas.png"

if [[ ! -x "$BIN" ]]; then
  printf 'No encuentro el binario nativo ejecutable: %s\nEjecutá primero: pnpm tauri build --no-bundle\n' "$BIN" >&2
  exit 1
fi
if [[ ! -f "$ICON_SOURCE" || ! -f "$TEMPLATE" ]]; then
  printf 'Falta el asset del logo o la plantilla del launcher.\n' >&2
  exit 1
fi

mkdir -p "$APP_DIR" "$ICON_DIR"
cp "$ICON_SOURCE" "$ICON_FILE"
sed -e "s|@EXEC@|$BIN|g" -e "s|@ICON@|$ICON_FILE|g" "$TEMPLATE" > "$DESKTOP_FILE"
chmod 644 "$DESKTOP_FILE" "$ICON_FILE"

if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database "$APP_DIR" >/dev/null 2>&1 || true
fi

printf 'Launcher instalado: %s\nIcono instalado: %s\nBinario: %s\n' "$DESKTOP_FILE" "$ICON_FILE" "$BIN"
