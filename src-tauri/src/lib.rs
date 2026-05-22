mod console;
mod sentinel;
mod title;
pub mod webview;

use tauri::Manager;

// ─── Misc commands ────────────────────────────────────────────────────────────

#[tauri::command]
fn get_version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}

#[tauri::command]
async fn fetch_page_title(url: String) -> String {
    title::fetch_title_inner(&url).await
}

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
            console::console_log,
            console::console_get_logs,
            webview::content_navigate,
            webview::content_eval,
            webview::content_reload,
            webview::content_set_bounds,
        ])
        .setup(|app| {
            let window = app
                .get_webview_window("main")
                .expect("main window introuvable");
            window.set_decorations(false)?;
            webview::init_content_webview(&app.handle()).map_err(|e| e.to_string())?;
            if app.get_webview_window("console").is_none() {
                tauri::WebviewWindowBuilder::new(
                    app,
                    "console",
                    tauri::WebviewUrl::App("console.html".into()),
                )
                .title("Auralis Console")
                .inner_size(820.0, 520.0)
                .min_inner_size(620.0, 320.0)
                .decorations(true)
                .resizable(true)
                .visible(true)
                .build()
                .map_err(|e| e.to_string())?;
            }
            console::push_app_log(
                &app.handle(),
                "info",
                "app.setup",
                "Fenêtre console initialisée",
                None,
            );
            #[cfg(debug_assertions)]
            window.open_devtools();
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Échec du démarrage d'Auralis");
}
