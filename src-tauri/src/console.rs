use std::collections::VecDeque;
use std::sync::{Mutex, OnceLock};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};

const MAX_LOG_ENTRIES: usize = 600;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppLogEntry {
    timestamp_ms: u128,
    level: String,
    source: String,
    message: String,
    details: Option<String>,
}

static LOG_BUFFER: OnceLock<Mutex<VecDeque<AppLogEntry>>> = OnceLock::new();

fn log_buffer() -> &'static Mutex<VecDeque<AppLogEntry>> {
    LOG_BUFFER.get_or_init(|| Mutex::new(VecDeque::with_capacity(MAX_LOG_ENTRIES)))
}

fn now_ms() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0)
}

fn normalize_level(level: &str) -> String {
    match level.to_ascii_lowercase().as_str() {
        "debug" => "debug",
        "warn" => "warn",
        "error" => "error",
        _ => "info",
    }
    .to_string()
}

fn trim(s: String, max: usize) -> String {
    if s.chars().count() <= max {
        return s;
    }
    let mut out = String::with_capacity(max + 1);
    for ch in s.chars().take(max) {
        out.push(ch);
    }
    out.push('…');
    out
}

pub fn push_app_log<R: tauri::Runtime>(
    app: &AppHandle<R>,
    level: &str,
    source: &str,
    message: &str,
    details: Option<String>,
) {
    let entry = AppLogEntry {
        timestamp_ms: now_ms(),
        level: normalize_level(level),
        source: trim(source.to_string(), 120),
        message: trim(message.to_string(), 1000),
        details: details.map(|d| trim(d, 4000)),
    };

    if let Ok(mut guard) = log_buffer().lock() {
        guard.push_back(entry.clone());
        while guard.len() > MAX_LOG_ENTRIES {
            let _ = guard.pop_front();
        }
    }

    if let Some(console_window) = app.get_webview_window("console") {
        let _ = console_window.emit("app-log", &entry);
    }
}

#[tauri::command]
pub fn console_log(
    app: AppHandle,
    level: String,
    source: String,
    message: String,
    details: Option<String>,
) -> Result<(), String> {
    push_app_log(&app, &level, &source, &message, details);
    Ok(())
}

#[tauri::command]
pub fn console_get_logs() -> Result<Vec<AppLogEntry>, String> {
    let guard = log_buffer()
        .lock()
        .map_err(|_| "impossible de lire le buffer de logs".to_string())?;
    Ok(guard.iter().cloned().collect())
}
