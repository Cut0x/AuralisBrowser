mod console;
mod sentinel;
mod title;
pub mod webview;

use tauri::Manager;

fn ensure_console_window(app: &tauri::AppHandle) -> Result<tauri::WebviewWindow, String> {
    if let Some(win) = app.get_webview_window("console") {
        return Ok(win);
    }

    tauri::WebviewWindowBuilder::new(app, "console", tauri::WebviewUrl::App("console.html".into()))
        .title("Console Auralis")
        .inner_size(820.0, 520.0)
        .min_inner_size(620.0, 320.0)
        .decorations(true)
        .resizable(true)
        .visible(false)
        .build()
        .map_err(|e| e.to_string())
}

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

#[tauri::command]
fn console_show(app: tauri::AppHandle) -> Result<(), String> {
    let win = ensure_console_window(&app)?;
    win.show().map_err(|e| e.to_string())?;
    win.set_focus().map_err(|e| e.to_string())?;
    Ok(())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            get_version,
            fetch_page_title,
            open_external,
            console_show,
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

            let _ = ensure_console_window(&app.handle())?;
            console::push_app_log(
                &app.handle(),
                "info",
                "app.setup",
                "Console Auralis initialisee en arriere-plan",
                None,
            );

            #[cfg(debug_assertions)]
            window.open_devtools();
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Echec du demarrage d'Auralis");
}
