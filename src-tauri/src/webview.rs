use crate::{console, sentinel, title};
use tauri::{AppHandle, Emitter, Manager, WebviewUrl};

const CONTENT_LABEL: &str = "content";

fn find_content_webview<R: tauri::Runtime>(app: &AppHandle<R>) -> Option<tauri::Webview<R>> {
    app.get_webview(CONTENT_LABEL)
}

fn log_err<R: tauri::Runtime>(
    app: &AppHandle<R>,
    source: &str,
    err: &str,
    details: Option<String>,
) {
    console::push_app_log(app, "error", source, err, details);
}

pub fn init_content_webview(app: &AppHandle) -> Result<(), String> {
    if find_content_webview(app).is_some() {
        return Ok(());
    }

    let main_window = app.get_window("main").ok_or_else(|| {
        let msg = "main window introuvable".to_string();
        log_err(app, "rust.webview.init.main_window", &msg, None);
        msg
    })?;

    let h_nav = app.clone();
    let h_load = app.clone();

    main_window
        .add_child(
            tauri::webview::WebviewBuilder::new(
                CONTENT_LABEL,
                WebviewUrl::External(tauri::Url::parse("about:blank").unwrap()),
            )
            .on_navigation(move |nav_url| {
                let s = nav_url.to_string();
                if sentinel::handle_sentinel(&s, &h_nav) {
                    return false;
                }
                if !s.is_empty() && s != "about:blank" {
                    let _ = h_nav.emit("content-navigated", s);
                }
                true
            })
            .on_page_load(move |_wv, payload| {
                use tauri::webview::PageLoadEvent;
                let url_str = payload.url().to_string();

                if sentinel::is_sentinel(&url_str) {
                    sentinel::handle_sentinel(&url_str, &h_load);
                    return;
                }

                if url_str == "about:blank" || url_str.is_empty() {
                    return;
                }

                match payload.event() {
                    PageLoadEvent::Started => {
                        let _ = h_load.emit("content-navigated", url_str.clone());
                    }
                    PageLoadEvent::Finished => {
                        let _ = h_load.emit("content-loaded", url_str.clone());
                        let h2 = h_load.clone();
                        let u2 = url_str;
                        tauri::async_runtime::spawn(async move {
                            let t = title::fetch_title_inner(&u2).await;
                            if !t.is_empty() {
                                let _ = h2.emit(
                                    "content-title",
                                    serde_json::json!({
                                        "url": u2, "title": t,
                                    }),
                                );
                            } else {
                                console::push_app_log(
                                    &h2,
                                    "warn",
                                    "rust.webview.title.fetch",
                                    "Titre vide recupere",
                                    Some(u2),
                                );
                            }
                        });
                    }
                }
            }),
            tauri::LogicalPosition::new(0.0, 82.0),
            tauri::LogicalSize::new(1280.0, 738.0),
        )
        .map(|_| ())
        .map_err(|e| {
            let msg = e.to_string();
            log_err(
                app,
                "rust.webview.init.add_child",
                &msg,
                Some("label=content".to_string()),
            );
            msg
        })
}

#[tauri::command]
pub fn content_navigate(app: AppHandle, url: String) -> Result<(), String> {
    let wv = find_content_webview(&app).ok_or_else(|| {
        let msg = "webview content introuvable".to_string();
        log_err(
            &app,
            "rust.webview.content_navigate.find",
            &msg,
            Some(url.clone()),
        );
        msg
    })?;
    let src = if url.is_empty() { "about:blank" } else { &url };
    let parsed = tauri::Url::parse(src).map_err(|e| {
        let msg = format!("url invalide: {e}");
        log_err(
            &app,
            "rust.webview.content_navigate.parse_url",
            &msg,
            Some(url.clone()),
        );
        msg
    })?;
    wv.navigate(parsed).map_err(|e| {
        let msg = e.to_string();
        log_err(
            &app,
            "rust.webview.content_navigate.navigate",
            &msg,
            Some(url),
        );
        msg
    })
}

#[tauri::command]
pub fn content_eval(app: AppHandle, js: String) -> Result<(), String> {
    let wv = find_content_webview(&app).ok_or_else(|| {
        let msg = "webview content introuvable".to_string();
        log_err(&app, "rust.webview.content_eval.find", &msg, None);
        msg
    })?;
    wv.eval(&js).map_err(|e| {
        let msg = e.to_string();
        log_err(
            &app,
            "rust.webview.content_eval.eval",
            &msg,
            Some(format!("js_len={}", js.len())),
        );
        msg
    })
}

#[tauri::command]
pub fn content_reload(app: AppHandle) -> Result<(), String> {
    content_eval(app, "window.location.reload()".to_string())
}

#[tauri::command]
pub fn content_set_bounds(app: AppHandle, top: f64, width: f64, height: f64) -> Result<(), String> {
    let wv = find_content_webview(&app).ok_or_else(|| {
        let msg = "webview content introuvable".to_string();
        log_err(&app, "rust.webview.content_set_bounds.find", &msg, None);
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
            "rust.webview.content_set_bounds.set_bounds",
            &msg,
            Some(format!("top={top} width={width} height={height}")),
        );
        msg
    })
}
