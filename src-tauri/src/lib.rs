use tauri::{AppHandle, Emitter, Manager, WebviewUrl};

// ─── Shared title logic ───────────────────────────────────────────────────────

async fn fetch_title_inner(url: &str) -> String {
    use reqwest::header;
    let mut headers = header::HeaderMap::new();
    headers.insert(
        header::ACCEPT,
        header::HeaderValue::from_static(
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        ),
    );
    headers.insert(
        header::ACCEPT_LANGUAGE,
        header::HeaderValue::from_static("en-US,en;q=0.9,fr;q=0.8"),
    );
    let client = match reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36")
        .timeout(std::time::Duration::from_secs(8))
        .default_headers(headers)
        .redirect(reqwest::redirect::Policy::limited(5))
        .build()
    {
        Ok(c) => c,
        Err(_) => return String::new(),
    };
    let html = match client.get(url).send().await {
        Ok(resp) => match resp.text().await {
            Ok(t) => t,
            Err(_) => return String::new(),
        },
        Err(_) => return String::new(),
    };
    extract_title(&html).unwrap_or_default()
}

fn extract_title(html: &str) -> Option<String> {
    let lower = html.to_ascii_lowercase();
    let tag_pos       = lower.find("<title")?;
    let close_bracket = lower[tag_pos..].find('>')? + tag_pos + 1;
    let end_tag       = lower[close_bracket..].find("</title>")? + close_bracket;
    let raw = html[close_bracket..end_tag].trim();
    if raw.is_empty() {
        return None;
    }
    let decoded = raw
        .replace("&amp;",  "&").replace("&lt;",   "<").replace("&gt;",   ">")
        .replace("&quot;", "\"").replace("&#39;", "'").replace("&apos;", "'")
        .replace("&nbsp;", " ").replace("&#x27;", "'").replace("&#x2F;", "/");
    let title = decoded.trim().to_string();
    if title.is_empty() { None } else { Some(title) }
}

// ─── Commands ─────────────────────────────────────────────────────────────────

#[tauri::command]
fn get_version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}

#[tauri::command]
async fn fetch_page_title(url: String) -> String {
    fetch_title_inner(&url).await
}

#[tauri::command]
async fn open_external(url: String) -> Result<(), String> {
    tauri_plugin_opener::open_url(url, None::<&str>)
        .map_err(|e| e.to_string())
}

/// Navigate the content child webview to a URL.
#[tauri::command]
fn content_navigate(app: AppHandle, url: String) -> Result<(), String> {
    let wv = app.get_webview("content").ok_or("content webview not found")?;
    let src = if url.is_empty() { "about:blank" } else { url.as_str() };
    let parsed = tauri::Url::parse(src).map_err(|e| format!("invalid url: {e}"))?;
    wv.navigate(parsed).map_err(|e| e.to_string())
}

/// Evaluate JavaScript in the content webview (back/forward/reload).
#[tauri::command]
fn content_eval(app: AppHandle, js: String) -> Result<(), String> {
    let wv = app.get_webview("content").ok_or("content webview not found")?;
    wv.eval(&js).map_err(|e| e.to_string())
}

/// Resize/reposition the content webview to match the chrome layout.
/// Called from JS after a resize, theme change, or favorites-bar toggle.
#[tauri::command]
fn content_set_bounds(
    app: AppHandle,
    top: f64,
    width: f64,
    height: f64,
) -> Result<(), String> {
    let wv = app.get_webview("content").ok_or("content webview not found")?;
    wv.set_bounds(tauri::Rect {
        position: tauri::Position::Logical(tauri::LogicalPosition::new(0.0, top)),
        size:     tauri::Size::Logical(tauri::LogicalSize::new(width, height)),
    })
    .map_err(|e| e.to_string())
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
            content_navigate,
            content_eval,
            content_set_bounds,
        ])
        .setup(|app| {
            let window = app
                .get_webview_window("main")
                .expect("main window not found");

            window.set_decorations(false)?;

            // ── Content child webview ─────────────────────────────────────────
            // This is a *native* WebView2 instance — no iframe, no X-Frame-Options.
            // It sits below the browser chrome and fills the remaining space.
            // JS calls content_set_bounds whenever the chrome height changes.
            let handle = app.handle().clone();

            // add_child is on Window<R> (unstable), not on WebviewWindow<R>.
            let win = app.get_window("main").expect("main window not found");
            win.add_child(
                tauri::webview::WebviewBuilder::new(
                    "content",
                    WebviewUrl::External(
                        tauri::Url::parse("about:blank").unwrap(),
                    ),
                )
                .on_page_load(move |_wv, payload| {
                    use tauri::webview::PageLoadEvent;
                    if let PageLoadEvent::Finished = payload.event() {
                        let url = payload.url().to_string();

                        // Notify the chrome webview of the new URL
                        let _ = handle.emit("content-navigated", &url);

                        // Background title fetch (non-blocking)
                        if url != "about:blank" && !url.is_empty() {
                            let h2 = handle.clone();
                            let u2 = url.clone();
                            tauri::async_runtime::spawn(async move {
                                let title = fetch_title_inner(&u2).await;
                                if !title.is_empty() {
                                    let _ = h2.emit(
                                        "content-title",
                                        serde_json::json!({ "url": u2, "title": title }),
                                    );
                                }
                            });
                        }
                    }
                }),
                tauri::LogicalPosition::new(0.0, 82.0),
                tauri::LogicalSize::new(1280.0, 738.0),
            )?;

            #[cfg(debug_assertions)]
            window.open_devtools();

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Failed to start Auralis");
}
