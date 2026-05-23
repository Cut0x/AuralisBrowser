mod console;
mod sentinel;
mod title;
pub mod webview;

use tauri::{Emitter, Manager};

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

fn ensure_fav_popup_window(
    app: &tauri::AppHandle,
    parent: Option<&tauri::WebviewWindow>,
) -> Result<tauri::WebviewWindow, String> {
    if let Some(win) = app.get_webview_window("fav-popup") {
        return Ok(win);
    }

    let mut builder = tauri::WebviewWindowBuilder::new(
        app,
        "fav-popup",
        tauri::WebviewUrl::App("fav-popup.html".into()),
    );

    if let Some(p) = parent {
        builder = builder.parent(p).map_err(|e| e.to_string())?;
    }

    builder
        .title("Auralis Fav Popup")
        .inner_size(280.0, 200.0)
        .resizable(false)
        .decorations(false)
        .transparent(true)
        .visible(false)
        .skip_taskbar(true)
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

#[tauri::command]
fn fav_popup_show(
    app: tauri::AppHandle,
    physical_left: i32,
    physical_top: i32,
    width: f64,
    height: f64,
    payload: String,
) -> Result<(), String> {
    let parent = app.get_webview_window("main");
    let win = ensure_fav_popup_window(&app, parent.as_ref())?;
    win.set_position(tauri::Position::Physical(tauri::PhysicalPosition::new(
        physical_left,
        physical_top,
    )))
        .map_err(|e| e.to_string())?;
    win.set_size(tauri::Size::Logical(tauri::LogicalSize::new(width, height)))
        .map_err(|e| e.to_string())?;
    win.show().map_err(|e| e.to_string())?;
    win.set_focus().map_err(|e| e.to_string())?;
    win.emit("fav-popup-data", payload).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn fav_popup_hide(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("fav-popup") {
        win.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn resolve_deal_url(deal_id: String) -> Result<String, String> {
    let trimmed = deal_id.trim();
    if trimmed.is_empty() {
        return Ok(String::new());
    }

    let redirect_url = format!("https://www.cheapshark.com/redirect?dealID={trimmed}");
    let client = reqwest::Client::builder()
        .user_agent(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 \
             (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
        )
        .timeout(std::time::Duration::from_secs(10))
        .redirect(reqwest::redirect::Policy::limited(10))
        .build()
        .map_err(|e| e.to_string())?;

    let response = client
        .get(&redirect_url)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    Ok(response.url().to_string())
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
            fav_popup_show,
            fav_popup_hide,
            resolve_deal_url,
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
            let _ = ensure_fav_popup_window(&app.handle(), Some(&window))?;
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
