use crate::{console, sentinel};
use std::sync::{Mutex, OnceLock};
use tauri::{AppHandle, Emitter, Manager, WebviewUrl};

const CONTENT_PREFIX: &str = "content-tab-";

static ACTIVE_WEBVIEW_LABEL: OnceLock<Mutex<Option<String>>> = OnceLock::new();

fn active_webview_label_store() -> &'static Mutex<Option<String>> {
    ACTIVE_WEBVIEW_LABEL.get_or_init(|| Mutex::new(None))
}

fn sanitize_tab_id(tab_id: &str) -> String {
    tab_id
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | ':' | '/') {
                c
            } else {
                '-'
            }
        })
        .collect()
}

fn tab_label(tab_id: &str) -> String {
    format!("{CONTENT_PREFIX}{}", sanitize_tab_id(tab_id))
}

fn set_active_label(label: Option<String>) {
    if let Ok(mut guard) = active_webview_label_store().lock() {
        *guard = label;
    }
}

fn get_active_label() -> Option<String> {
    active_webview_label_store()
        .lock()
        .ok()
        .and_then(|g| g.clone())
}

fn log_err<R: tauri::Runtime>(
    app: &AppHandle<R>,
    source: &str,
    err: &str,
    details: Option<String>,
) {
    console::push_app_log(app, "error", source, err, details);
}

fn emit_content_url(app: &AppHandle, event: &str, tab_id: &str, url: &str) {
    let _ = app.emit(
        event,
        serde_json::json!({
            "tabId": tab_id,
            "url": url,
        }),
    );
}

fn ensure_tab_webview(app: &AppHandle, tab_id: &str) -> Result<tauri::Webview, String> {
    let label = tab_label(tab_id);
    if let Some(wv) = app.get_webview(&label) {
        return Ok(wv);
    }

    let main_window = app.get_window("main").ok_or_else(|| {
        let msg = "main window introuvable".to_string();
        log_err(app, "rust.webview.ensure.main_window", &msg, None);
        msg
    })?;

    let h_nav = app.clone();
    let h_load = app.clone();
    let tab_for_nav = tab_id.to_string();
    let tab_for_load = tab_id.to_string();
    let label_for_log = label.clone();

    let webview = main_window
        .add_child(
            tauri::webview::WebviewBuilder::new(
                label.as_str(),
                WebviewUrl::External(
                    tauri::Url::parse("about:blank")
                        .map_err(|e| format!("impossible de parser about:blank: {e}"))?,
                ),
            )
            .on_navigation(move |nav_url| {
                let s = nav_url.to_string();
                if sentinel::handle_sentinel(&s, &h_nav, Some(&tab_for_nav)) {
                    return false;
                }
                if !s.is_empty() && s != "about:blank" {
                    emit_content_url(&h_nav, "content-navigated", &tab_for_nav, &s);
                }
                true
            })
            .on_page_load(move |_wv, payload| {
                use tauri::webview::PageLoadEvent;
                let url_str = payload.url().to_string();

                if sentinel::is_sentinel(&url_str) {
                    sentinel::handle_sentinel(&url_str, &h_load, Some(&tab_for_load));
                    return;
                }

                if url_str == "about:blank" || url_str.is_empty() {
                    return;
                }

                match payload.event() {
                    PageLoadEvent::Started => {
                        emit_content_url(&h_load, "content-loaded-started", &tab_for_load, &url_str);
                        emit_content_url(&h_load, "content-navigated", &tab_for_load, &url_str);
                    }
                    PageLoadEvent::Finished => {
                        emit_content_url(&h_load, "content-loaded", &tab_for_load, &url_str);
                    }
                }
            }),
            tauri::LogicalPosition::new(0.0, 9999.0),
            tauri::LogicalSize::new(1.0, 1.0),
        )
        .map_err(|e| {
            let msg = e.to_string();
            log_err(
                app,
                "rust.webview.ensure.add_child",
                &msg,
                Some(format!("label={label_for_log}")),
            );
            msg
        })?;

    webview.hide().map_err(|e| {
        let msg = e.to_string();
        log_err(
            app,
            "rust.webview.ensure.hide",
            &msg,
            Some(format!("label={label_for_log}")),
        );
        msg
    })?;

    Ok(webview)
}

fn set_webview_bounds(
    app: &AppHandle,
    webview: &tauri::Webview,
    top: f64,
    width: f64,
    height: f64,
) -> Result<(), String> {
    webview
        .set_bounds(tauri::Rect {
            position: tauri::Position::Logical(tauri::LogicalPosition::new(0.0, top)),
            size: tauri::Size::Logical(tauri::LogicalSize::new(width, height)),
        })
        .map_err(|e| {
            let msg = e.to_string();
            log_err(
                app,
                "rust.webview.set_bounds",
                &msg,
                Some(format!(
                    "label={} top={top} width={width} height={height}",
                    webview.label()
                )),
            );
            msg
        })
}

pub fn init_content_webview(_app: &AppHandle) -> Result<(), String> {
    Ok(())
}

#[tauri::command]
pub async fn content_tab_ensure(app: AppHandle, tab_id: String) -> Result<(), String> {
    if tab_id.trim().is_empty() {
        return Err("tab_id vide".to_string());
    }
    let _ = ensure_tab_webview(&app, tab_id.trim())?;
    Ok(())
}

#[tauri::command]
pub async fn content_tab_activate(
    app: AppHandle,
    tab_id: String,
    top: f64,
    width: f64,
    height: f64,
) -> Result<(), String> {
    let trimmed = tab_id.trim();
    if trimmed.is_empty() {
        return Err("tab_id vide".to_string());
    }

    let next_label = tab_label(trimmed);
    if let Some(prev_label) = get_active_label() {
        if prev_label != next_label {
            if let Some(prev) = app.get_webview(&prev_label) {
                let _ = prev.hide();
                let _ = set_webview_bounds(&app, &prev, 9999.0, 1.0, 1.0);
            }
        }
    }

    let current = ensure_tab_webview(&app, trimmed)?;
    set_webview_bounds(&app, &current, top, width, height)?;
    current.show().map_err(|e| {
        let msg = e.to_string();
        log_err(
            &app,
            "rust.webview.content_tab_activate.show",
            &msg,
            Some(format!("label={next_label}")),
        );
        msg
    })?;
    set_active_label(Some(next_label));
    Ok(())
}

#[tauri::command]
pub async fn content_tab_close(app: AppHandle, tab_id: String) -> Result<(), String> {
    let trimmed = tab_id.trim();
    if trimmed.is_empty() {
        return Ok(());
    }
    let label = tab_label(trimmed);
    if let Some(wv) = app.get_webview(&label) {
        wv.close().map_err(|e| {
            let msg = e.to_string();
            log_err(
                &app,
                "rust.webview.content_tab_close.close",
                &msg,
                Some(format!("label={label}")),
            );
            msg
        })?;
    }
    if get_active_label().as_deref() == Some(label.as_str()) {
        set_active_label(None);
    }
    Ok(())
}

#[tauri::command]
pub async fn content_navigate(app: AppHandle, tab_id: String, url: String) -> Result<(), String> {
    let trimmed = tab_id.trim();
    if trimmed.is_empty() {
        return Err("tab_id vide".to_string());
    }
    let wv = ensure_tab_webview(&app, trimmed)?;
    let src = if url.is_empty() { "about:blank" } else { &url };
    tauri::Url::parse(src).map_err(|e| {
        let msg = format!("url invalide: {e}");
        log_err(
            &app,
            "rust.webview.content_navigate.parse_url",
            &msg,
            Some(format!("tab_id={trimmed} url={url}")),
        );
        msg
    })?;

    let js_url = serde_json::to_string(src).map_err(|e| {
        let msg = format!("serialisation url impossible: {e}");
        log_err(
            &app,
            "rust.webview.content_navigate.serialize_url",
            &msg,
            Some(format!("tab_id={trimmed} url={url}")),
        );
        msg
    })?;
    let nav_js = format!("window.location.href = {js_url};");
    wv.eval(&nav_js).map_err(|e| {
        let msg = e.to_string();
        log_err(
            &app,
            "rust.webview.content_navigate.eval",
            &msg,
            Some(format!("tab_id={trimmed} url={url}")),
        );
        msg
    })?;

    if !src.is_empty() && src != "about:blank" {
        emit_content_url(&app, "content-navigated", trimmed, src);
    }
    Ok(())
}

#[tauri::command]
pub async fn content_eval(app: AppHandle, tab_id: String, js: String) -> Result<(), String> {
    let trimmed = tab_id.trim();
    if trimmed.is_empty() {
        return Err("tab_id vide".to_string());
    }
    let label = tab_label(trimmed);
    let wv = app.get_webview(&label).ok_or_else(|| {
        let msg = "webview content introuvable".to_string();
        log_err(
            &app,
            "rust.webview.content_eval.find",
            &msg,
            Some(format!("tab_id={trimmed} label={label}")),
        );
        msg
    })?;
    wv.eval(&js).map_err(|e| {
        let msg = e.to_string();
        log_err(
            &app,
            "rust.webview.content_eval.eval",
            &msg,
            Some(format!("tab_id={trimmed} js_len={}", js.len())),
        );
        msg
    })
}

#[tauri::command]
pub async fn content_reload(app: AppHandle, tab_id: String) -> Result<(), String> {
    let trimmed = tab_id.trim();
    if trimmed.is_empty() {
        return Err("tab_id vide".to_string());
    }
    let label = tab_label(trimmed);
    let wv = app.get_webview(&label).ok_or_else(|| {
        let msg = "webview content introuvable".to_string();
        log_err(
            &app,
            "rust.webview.content_reload.find",
            &msg,
            Some(format!("tab_id={trimmed} label={label}")),
        );
        msg
    })?;
    wv.reload().map_err(|e| {
        let msg = e.to_string();
        log_err(
            &app,
            "rust.webview.content_reload.reload",
            &msg,
            Some(format!("tab_id={trimmed}")),
        );
        msg
    })
}

#[tauri::command]
pub async fn content_set_bounds(app: AppHandle, top: f64, width: f64, height: f64) -> Result<(), String> {
    let Some(active_label) = get_active_label() else {
        return Ok(());
    };
    let Some(wv) = app.get_webview(&active_label) else {
        set_active_label(None);
        return Ok(());
    };
    set_webview_bounds(&app, &wv, top, width, height)
}
