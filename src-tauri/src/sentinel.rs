use tauri::{AppHandle, Emitter};

pub fn query_param(url_str: &str, key: &str) -> Option<String> {
    let parsed = tauri::Url::parse(url_str).ok()?;
    parsed
        .query_pairs()
        .find(|(k, _)| k == key)
        .map(|(_, v)| v.into_owned())
}

pub fn is_sentinel(url_str: &str) -> bool {
    url_str.contains("auralis-pw.invalid") || url_str.contains("auralis-open.invalid")
}

pub fn handle_sentinel(url_str: &str, handle: &AppHandle, tab_id: Option<&str>) -> bool {
    if url_str.contains("auralis-pw.invalid") {
        if let Some(d) = query_param(url_str, "d") {
            let payload = serde_json::json!({
                "tabId": tab_id.unwrap_or_default(),
                "data": d,
            });
            let _ = handle.emit("content-pw-detected", payload);
        }
        return true;
    }
    if url_str.contains("auralis-open.invalid") {
        if let Some(u) = query_param(url_str, "url") {
            let payload = serde_json::json!({
                "tabId": tab_id.unwrap_or_default(),
                "url": u,
            });
            let _ = handle.emit("content-open-new-tab", payload);
        }
        return true;
    }
    false
}
