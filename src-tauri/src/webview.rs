use tauri::{AppHandle, Emitter, Manager, WebviewUrl};
use crate::{sentinel, title, tab_label};

#[tauri::command]
pub fn tab_webview_create(app: AppHandle, tab_id: String, url: String) -> Result<(), String> {
    let label      = tab_label(&tab_id);
    let parsed_url = if url.is_empty() || url == "about:newtab" {
        tauri::Url::parse("about:blank").unwrap()
    } else {
        tauri::Url::parse(&url).map_err(|e| format!("url invalide: {e}"))?
    };
    let win      = app.get_window("main").ok_or("main window introuvable")?;
    let h_nav    = app.clone();
    let h_load   = app.clone();
    let tid_load = tab_id.clone();

    win.add_child(
        tauri::webview::WebviewBuilder::new(&label, WebviewUrl::External(parsed_url))
            .on_navigation(move |nav_url| {
                let s = nav_url.to_string();
                if sentinel::handle_sentinel(&s, &h_nav) { return false; }
                true
            })
            .on_page_load(move |wv, payload| {
                use tauri::webview::PageLoadEvent;
                let url_str = payload.url().to_string();
                if sentinel::is_sentinel(&url_str) {
                    sentinel::handle_sentinel(&url_str, &h_load);
                    let _ = wv.navigate(tauri::Url::parse("about:blank").unwrap());
                    return;
                }
                if let PageLoadEvent::Finished = payload.event() {
                    if url_str == "about:blank" || url_str.is_empty() { return; }
                    let _ = h_load.emit("content-navigated", serde_json::json!({
                        "tabId": tid_load, "url": url_str,
                    }));
                    let h2  = h_load.clone();
                    let tid = tid_load.clone();
                    let u2  = url_str;
                    tauri::async_runtime::spawn(async move {
                        let t = title::fetch_title_inner(&u2).await;
                        if !t.is_empty() {
                            let _ = h2.emit("content-title", serde_json::json!({
                                "tabId": tid, "url": u2, "title": t,
                            }));
                        }
                    });
                }
            }),
        tauri::LogicalPosition::new(-9999.0, -9999.0),
        tauri::LogicalSize::new(1.0, 1.0),
    ).map(|_| ()).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn tab_webview_show(app: AppHandle, tab_id: String, top: f64, width: f64, height: f64) -> Result<(), String> {
    let wv = app.get_webview(&tab_label(&tab_id)).ok_or("webview introuvable")?;
    wv.set_bounds(tauri::Rect {
        position: tauri::Position::Logical(tauri::LogicalPosition::new(0.0, top)),
        size:     tauri::Size::Logical(tauri::LogicalSize::new(width, height)),
    }).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn tab_webview_hide(app: AppHandle, tab_id: String) -> Result<(), String> {
    if let Some(wv) = app.get_webview(&tab_label(&tab_id)) {
        wv.set_bounds(tauri::Rect {
            position: tauri::Position::Logical(tauri::LogicalPosition::new(-9999.0, -9999.0)),
            size:     tauri::Size::Logical(tauri::LogicalSize::new(1.0, 1.0)),
        }).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn tab_webview_close(app: AppHandle, tab_id: String) -> Result<(), String> {
    if let Some(wv) = app.get_webview(&tab_label(&tab_id)) {
        wv.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn tab_webview_navigate(app: AppHandle, tab_id: String, url: String) -> Result<(), String> {
    let wv = app.get_webview(&tab_label(&tab_id)).ok_or("webview introuvable")?;
    wv.navigate(tauri::Url::parse(&url).map_err(|e| e.to_string())?).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn tab_webview_eval(app: AppHandle, tab_id: String, js: String) -> Result<(), String> {
    if let Some(wv) = app.get_webview(&tab_label(&tab_id)) {
        wv.eval(&js).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn tab_webview_reload(app: AppHandle, tab_id: String) -> Result<(), String> {
    if let Some(wv) = app.get_webview(&tab_label(&tab_id)) {
        wv.eval("window.location.reload()").map_err(|e| e.to_string())?;
    }
    Ok(())
}
