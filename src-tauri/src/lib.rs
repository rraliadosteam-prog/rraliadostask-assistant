use std::fs;
use std::path::{Path, PathBuf};

use serde_json::Value;
use tauri::{AppHandle, Manager};

const APP_DIR: &str = "RR Tareas";

fn resolve_data_root(app: &AppHandle) -> Result<PathBuf, String> {
    if let Ok(executable) = std::env::current_exe() {
        if let Some(parent) = executable.parent() {
            let portable_flag = parent.join("portable.flag");
            if portable_flag.exists() {
                return Ok(parent.join("data"));
            }
        }
    }
    let root = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("No se pudo resolver el directorio local: {error}"))?;
    Ok(root.join(APP_DIR))
}

fn ensure_parent(path: &Path) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("No se pudo crear el directorio del workspace: {error}"))?;
    }
    Ok(())
}

fn atomic_write(path: &Path, content: &str) -> Result<(), String> {
    ensure_parent(path)?;
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| "La ruta de archivo no es válida.".to_string())?;
    let temporary = path.with_file_name(format!("{file_name}.tmp"));
    fs::write(&temporary, content)
        .map_err(|error| format!("No se pudo escribir el temporal: {error}"))?;
    if path.exists() {
        let backup = path.with_file_name(format!("{file_name}.bak"));
        let _ = fs::copy(path, backup);
    }
    fs::rename(&temporary, path)
        .map_err(|error| format!("No se pudo confirmar el workspace: {error}"))?;
    Ok(())
}

fn validate_workspace(content: &str) -> Result<(), String> {
    let value: Value = serde_json::from_str(content)
        .map_err(|error| format!("El workspace no contiene JSON válido: {error}"))?;
    let format = value.get("format").and_then(Value::as_str);
    let version = value.get("format_version").and_then(Value::as_u64);
    if format != Some("rr-task-workspace") || version != Some(2) {
        return Err("El archivo no es un workspace RR Tareas compatible.".to_string());
    }
    Ok(())
}

#[tauri::command]
fn default_data_root(app: AppHandle) -> Result<String, String> {
    resolve_data_root(&app).map(|path| path.to_string_lossy().to_string())
}

#[tauri::command]
fn read_workspace(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|error| format!("No se pudo leer el workspace: {error}"))
}

#[tauri::command]
fn read_text(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|error| format!("No se pudo leer el archivo: {error}"))
}

#[tauri::command]
fn write_workspace(path: String, content: String) -> Result<(), String> {
    validate_workspace(&content)?;
    atomic_write(Path::new(&path), &content)
}

#[tauri::command]
fn write_text(path: String, content: String) -> Result<(), String> {
    atomic_write(Path::new(&path), &content)
}

#[tauri::command]
fn copy_text(app: AppHandle, text: String) -> Result<(), String> {
    use tauri_plugin_clipboard_manager::ClipboardExt;
    app.clipboard()
        .write_text(text)
        .map_err(|error| format!("No se pudo copiar al portapapeles: {error}"))
}

#[tauri::command]
fn set_always_on_top(app: AppHandle, enabled: bool) -> Result<(), String> {
    let window = app.get_webview_window("main").ok_or("No se encontró la ventana principal.")?;
    window.set_always_on_top(enabled).map_err(|error| error.to_string())?;
    Ok(())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            default_data_root,
            read_workspace,
            read_text,
            write_workspace,
            write_text,
            copy_text,
            set_always_on_top
        ])
        .run(tauri::generate_context!())
        .expect("error while running RR Tareas");
}
