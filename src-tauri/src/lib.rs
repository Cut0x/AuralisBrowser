use tauri::{AppHandle, Emitter, Manager, WebviewUrl};

// ─── Title fetch ──────────────────────────────────────────────────────────────

async fn fetch_title_inner(url: &str) -> String {
    use reqwest::header;
    let mut headers = header::HeaderMap::new();
    headers.insert(header::ACCEPT, header::HeaderValue::from_static(
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    ));
    headers.insert(header::ACCEPT_LANGUAGE,
        header::HeaderValue::from_static("en-US,en;q=0.9,fr;q=0.8"));
    let client = match reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36")
        .timeout(std::time::Duration::from_secs(8))
        .default_headers(headers)
        .redirect(reqwest::redirect::Policy::limited(5))
        .build()
    { Ok(c) => c, Err(_) => return String::new() };
    let html = match client.get(url).send().await {
        Ok(r)  => match r.text().await { Ok(t) => t, Err(_) => return String::new() },
        Err(_) => return String::new(),
    };
    extract_title(&html).unwrap_or_default()
}

fn extract_title(html: &str) -> Option<String> {
    let lower         = html.to_ascii_lowercase();
    let tag_pos       = lower.find("<title")?;
    let close_bracket = lower[tag_pos..].find('>')? + tag_pos + 1;
    let end_tag       = lower[close_bracket..].find("</title>")? + close_bracket;
    let raw = html[close_bracket..end_tag].trim();
    if raw.is_empty() { return None; }
    let decoded = raw
        .replace("&amp;",  "&").replace("&lt;",   "<").replace("&gt;",  ">")
        .replace("&quot;", "\"").replace("&#39;", "'").replace("&apos;","'")
        .replace("&nbsp;", " ").replace("&#x27;", "'").replace("&#x2F;","/");
    let t = decoded.trim().to_string();
    if t.is_empty() { None } else { Some(t) }
}

// ─── Misc commands ────────────────────────────────────────────────────────────

#[tauri::command]
fn get_version() -> &'static str { env!("CARGO_PKG_VERSION") }

#[tauri::command]
async fn fetch_page_title(url: String) -> String { fetch_title_inner(&url).await }

#[tauri::command]
async fn open_external(url: String) -> Result<(), String> {
    tauri_plugin_opener::open_url(url, None::<&str>).map_err(|e| e.to_string())
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

fn tab_label(tab_id: &str) -> String { format!("tab-{tab_id}") }

/// Extrait un paramètre de query d'une URL sous forme de String.
fn query_param(url_str: &str, key: &str) -> Option<String> {
    let parsed = tauri::Url::parse(url_str).ok()?;
    parsed.query_pairs()
        .find(|(k, _)| k == key)
        .map(|(_, v)| v.into_owned())
}

/// Retourne true si l'URL est une sentinelle interne Auralis (*.invalid).
fn is_sentinel(url_str: &str) -> bool {
    url_str.contains("auralis-pw.invalid") || url_str.contains("auralis-open.invalid")
}

/// Intercepte et émet l'événement correspondant à une URL sentinelle.
/// Retourne true si l'URL était une sentinelle (et a été traitée).
fn handle_sentinel(url_str: &str, handle: &AppHandle) -> bool {
    if url_str.contains("auralis-pw.invalid") {
        if let Some(d) = query_param(url_str, "d") {
            let _ = handle.emit("content-pw-detected", d);
        }
        return true;
    }
    if url_str.contains("auralis-open.invalid") {
        if let Some(u) = query_param(url_str, "url") {
            let _ = handle.emit("content-open-new-tab", u);
        }
        return true;
    }
    false
}

// ─── Tab webview commands ─────────────────────────────────────────────────────

/// Crée un WebView enfant pour l'onglet donné. Démarre hors-écran.
///
/// Interception à deux niveaux :
///   1. on_navigation  → annule avant la résolution DNS (NavigationStarting)
///   2. on_page_load   → filet de sécurité si 1 ne suffit pas (navigue vers about:blank)
#[tauri::command]
fn tab_webview_create(app: AppHandle, tab_id: String, url: String) -> Result<(), String> {
    let label = tab_label(&tab_id);
    let parsed_url = if url.is_empty() || url == "about:newtab" {
        tauri::Url::parse("about:blank").unwrap()
    } else {
        tauri::Url::parse(&url).map_err(|e| format!("url invalide: {e}"))?
    };

    let win       = app.get_window("main").ok_or("main window introuvable")?;
    let h_nav     = app.clone(); // pour on_navigation
    let h_load    = app.clone(); // pour on_page_load
    let tid_load  = tab_id.clone();

    win.add_child(
        tauri::webview::WebviewBuilder::new(&label, WebviewUrl::External(parsed_url))
            // ── Niveau 1 : avant la résolution DNS ───────────────────────────
            .on_navigation(move |url| {
                let s = url.to_string();
                if handle_sentinel(&s, &h_nav) {
                    return false; // annule la navigation, aucun paquet réseau émis
                }
                true
            })
            // ── Niveau 2 : filet de sécurité ─────────────────────────────────
            .on_page_load(move |wv, payload| {
                use tauri::webview::PageLoadEvent;
                let url_str = payload.url().to_string();

                // Sentinelles : extraire les données, rediriger vers blank
                if is_sentinel(&url_str) {
                    handle_sentinel(&url_str, &h_load);
                    // Redirige pour effacer la page d'erreur DNS si elle a eu
                    // le temps de s'afficher (on_navigation n'a pas suffi)
                    let _ = wv.navigate(tauri::Url::parse("about:blank").unwrap());
                    return;
                }

                // Navigation réelle : n'émettre qu'au Finished
                if let PageLoadEvent::Finished = payload.event() {
                    if url_str == "about:blank" || url_str.is_empty() { return; }
                    let _ = h_load.emit("content-navigated", serde_json::json!({
                        "tabId": tid_load,
                        "url":   url_str,
                    }));
                    let h2  = h_load.clone();
                    let tid = tid_load.clone();
                    let u2  = url_str;
                    tauri::async_runtime::spawn(async move {
                        let title = fetch_title_inner(&u2).await;
                        if !title.is_empty() {
                            let _ = h2.emit("content-title", serde_json::json!({
                                "tabId": tid,
                                "url":   u2,
                                "title": title,
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
fn tab_webview_show(app: AppHandle, tab_id: String, top: f64, width: f64, height: f64) -> Result<(), String> {
    let wv = app.get_webview(&tab_label(&tab_id)).ok_or("webview introuvable")?;
    wv.set_bounds(tauri::Rect {
        position: tauri::Position::Logical(tauri::LogicalPosition::new(0.0, top)),
        size:     tauri::Size::Logical(tauri::LogicalSize::new(width, height)),
    }).map_err(|e| e.to_string())
}

#[tauri::command]
fn tab_webview_hide(app: AppHandle, tab_id: String) -> Result<(), String> {
    if let Some(wv) = app.get_webview(&tab_label(&tab_id)) {
        wv.set_bounds(tauri::Rect {
            position: tauri::Position::Logical(tauri::LogicalPosition::new(-9999.0, -9999.0)),
            size:     tauri::Size::Logical(tauri::LogicalSize::new(1.0, 1.0)),
        }).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn tab_webview_close(app: AppHandle, tab_id: String) -> Result<(), String> {
    if let Some(wv) = app.get_webview(&tab_label(&tab_id)) {
        wv.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn tab_webview_navigate(app: AppHandle, tab_id: String, url: String) -> Result<(), String> {
    let wv = app.get_webview(&tab_label(&tab_id)).ok_or("webview introuvable")?;
    let parsed = tauri::Url::parse(&url).map_err(|e| e.to_string())?;
    wv.navigate(parsed).map_err(|e| e.to_string())
}

#[tauri::command]
fn tab_webview_eval(app: AppHandle, tab_id: String, js: String) -> Result<(), String> {
    if let Some(wv) = app.get_webview(&tab_label(&tab_id)) {
        wv.eval(&js).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn tab_webview_reload(app: AppHandle, tab_id: String) -> Result<(), String> {
    if let Some(wv) = app.get_webview(&tab_label(&tab_id)) {
        wv.eval("window.location.reload()").map_err(|e| e.to_string())?;
    }
    Ok(())
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
            tab_webview_create,
            tab_webview_show,
            tab_webview_hide,
            tab_webview_close,
            tab_webview_navigate,
            tab_webview_eval,
            tab_webview_reload,
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
