mod title;
mod sentinel;
pub mod webview;

use tauri::Manager;

pub fn tab_label(tab_id: &str) -> String { format!("tab-{tab_id}") }

// ─── Misc commands ────────────────────────────────────────────────────────────

#[tauri::command]
fn get_version() -> &'static str { env!("CARGO_PKG_VERSION") }

#[tauri::command]
async fn fetch_page_title(url: String) -> String { title::fetch_title_inner(&url).await }

#[tauri::command]
async fn open_external(url: String) -> Result<(), String> {
    tauri_plugin_opener::open_url(url, None::<&str>).map_err(|e| e.to_string())
}

// ─── App setup ────────────────────────────────────────────────────────────────

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            get_version,
            fetch_page_title,
            open_external,
            webview::tab_webview_create,
            webview::tab_webview_show,
            webview::tab_webview_hide,
            webview::tab_webview_close,
            webview::tab_webview_navigate,
            webview::tab_webview_eval,
            webview::tab_webview_reload,
        ])
        .setup(|app| {
            let window = app.get_webview_window("main").expect("main window introuvable");
            window.set_decorations(false)?;
            #[cfg(debug_assertions)]
            window.open_devtools();
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Échec du démarrage d'Auralis");
}
