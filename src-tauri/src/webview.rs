use crate::{console, sentinel, tab_label, title};
use tauri::{AppHandle, Emitter, Manager, WebviewUrl};

fn find_tab_webview<R: tauri::Runtime>(
    app: &AppHandle<R>,
    tab_id: &str,
) -> Option<tauri::Webview<R>> {
    let label = tab_label(tab_id);
    let win = app.get_window("main")?;
    win.webviews()
        .into_iter()
        .find(|w| w.label() == label.as_str())
}

fn log_err<R: tauri::Runtime>(
    app: &AppHandle<R>,
    source: &str,
    err: &str,
    details: Option<String>,
) {
    console::push_app_log(app, "error", source, err, details);
}

#[tauri::command]
pub fn tab_webview_create(app: AppHandle, tab_id: String, url: String) -> Result<(), String> {
    let label = tab_label(&tab_id);
    let parsed_url = if url.is_empty() || url == "about:newtab" {
        tauri::Url::parse("about:blank").unwrap()
    } else {
        tauri::Url::parse(&url).map_err(|e| {
            let msg = format!("url invalide: {e}");
            log_err(
                &app,
                "rust.webview.create.parse_url",
                &msg,
                Some(url.clone()),
            );
            msg
        })?
    };
    let win = app.get_window("main").ok_or_else(|| {
        let msg = "main window introuvable".to_string();
        log_err(&app, "rust.webview.create.main_window", &msg, None);
        msg
    })?;
    let h_nav = app.clone();
    let h_load = app.clone();
    let tid_nav = tab_id.clone();
    let tid_load = tab_id.clone();

    win.add_child(
        tauri::webview::WebviewBuilder::new(&label, WebviewUrl::External(parsed_url))
            .on_navigation(move |nav_url| {
                let s = nav_url.to_string();
                // Bloquer les URLs sentinelles
                if sentinel::handle_sentinel(&s, &h_nav) {
                    return false;
                }
                // Émettre dès que la navigation commence (avant le chargement)
                // Cela permet au JS d'afficher le WebView immédiatement
                if s != "about:blank" && !s.is_empty() {
                    let _ = h_nav.emit(
                        "content-navigated",
                        serde_json::json!({
                            "tabId": tid_nav, "url": s,
                        }),
                    );
                }
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
                    if url_str == "about:blank" || url_str.is_empty() {
                        return;
                    }
                    // Émettre quand la page est chargée → JS arrête le spinner + injecte scripts
                    let _ = h_load.emit(
                        "content-loaded",
                        serde_json::json!({
                            "tabId": tid_load, "url": url_str,
                        }),
                    );
                    let h2 = h_load.clone();
                    let tid = tid_load.clone();
                    let u2 = url_str;
                    tauri::async_runtime::spawn(async move {
                        let t = title::fetch_title_inner(&u2).await;
                        if !t.is_empty() {
                            let _ = h2.emit(
                                "content-title",
                                serde_json::json!({
                                    "tabId": tid, "url": u2, "title": t,
                                }),
                            );
                        } else {
                            console::push_app_log(
                                &h2,
                                "warn",
                                "rust.webview.title.fetch",
                                "Titre vide récupéré",
                                Some(u2),
                            );
                        }
                    });
                }
            }),
        tauri::LogicalPosition::new(-9999.0, -9999.0),
        tauri::LogicalSize::new(1280.0, 800.0),
    )
    .map(|_| ())
    .map_err(|e| {
        let msg = e.to_string();
        log_err(
            &app,
            "rust.webview.create.add_child",
            &msg,
            Some(format!("tab_id={tab_id} url={url}")),
        );
        msg
    })
}

#[tauri::command]
pub fn tab_webview_show(
    app: AppHandle,
    tab_id: String,
    top: f64,
    width: f64,
    height: f64,
) -> Result<(), String> {
    let wv = find_tab_webview(&app, &tab_id).ok_or_else(|| {
        let msg = format!("webview introuvable: {tab_id}");
        log_err(&app, "rust.webview.show.find", &msg, None);
        msg
    })?;
    wv.set_bounds(tauri::Rect {
        position: tauri::Position::Logical(tauri::LogicalPosition::new(0.0, top)),
        size: tauri::Size::Logical(tauri::LogicalSize::new(width, height)),
    })
    .map_err(|e| {
        let msg = e.to_string();
        log_err(
            &app,
            "rust.webview.show.bounds",
            &msg,
            Some(format!(
                "tab_id={tab_id} top={top} width={width} height={height}"
            )),
        );
        msg
    })
}

#[tauri::command]
pub fn tab_webview_hide(app: AppHandle, tab_id: String) -> Result<(), String> {
    if let Some(wv) = find_tab_webview(&app, &tab_id) {
        wv.set_bounds(tauri::Rect {
            position: tauri::Position::Logical(tauri::LogicalPosition::new(-9999.0, -9999.0)),
            size: tauri::Size::Logical(tauri::LogicalSize::new(1280.0, 800.0)),
        })
        .map_err(|e| {
            let msg = e.to_string();
            log_err(
                &app,
                "rust.webview.hide.bounds",
                &msg,
                Some(format!("tab_id={tab_id}")),
            );
            msg
        })?;
    }
    Ok(())
}

#[tauri::command]
pub fn tab_webview_close(app: AppHandle, tab_id: String) -> Result<(), String> {
    if let Some(wv) = find_tab_webview(&app, &tab_id) {
        wv.close().map_err(|e| {
            let msg = e.to_string();
            log_err(
                &app,
                "rust.webview.close",
                &msg,
                Some(format!("tab_id={tab_id}")),
            );
            msg
        })?;
    }
    Ok(())
}

#[tauri::command]
pub fn tab_webview_navigate(app: AppHandle, tab_id: String, url: String) -> Result<(), String> {
    let wv = find_tab_webview(&app, &tab_id).ok_or_else(|| {
        let msg = format!("webview introuvable: {tab_id}");
        log_err(&app, "rust.webview.navigate.find", &msg, Some(url.clone()));
        msg
    })?;
    let parsed = tauri::Url::parse(&url).map_err(|e| {
        let msg = e.to_string();
        log_err(
            &app,
            "rust.webview.navigate.parse_url",
            &msg,
            Some(url.clone()),
        );
        msg
    })?;
    wv.navigate(parsed).map_err(|e| {
        let msg = e.to_string();
        log_err(
            &app,
            "rust.webview.navigate",
            &msg,
            Some(format!("tab_id={tab_id} url={url}")),
        );
        msg
    })
}

#[tauri::command]
pub fn tab_webview_eval(app: AppHandle, tab_id: String, js: String) -> Result<(), String> {
    if let Some(wv) = find_tab_webview(&app, &tab_id) {
        wv.eval(&js).map_err(|e| {
            let msg = e.to_string();
            log_err(
                &app,
                "rust.webview.eval",
                &msg,
                Some(format!("tab_id={tab_id} js_len={}", js.len())),
            );
            msg
        })?;
    }
    Ok(())
}

#[tauri::command]
pub fn tab_webview_reload(app: AppHandle, tab_id: String) -> Result<(), String> {
    if let Some(wv) = find_tab_webview(&app, &tab_id) {
        wv.eval("window.location.reload()").map_err(|e| {
            let msg = e.to_string();
            log_err(
                &app,
                "rust.webview.reload",
                &msg,
                Some(format!("tab_id={tab_id}")),
            );
            msg
        })?;
    }
    Ok(())
}
