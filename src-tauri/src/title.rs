use reqwest::header;

pub async fn fetch_title_inner(url: &str) -> String {
    let mut hdrs = header::HeaderMap::new();
    hdrs.insert(header::ACCEPT, header::HeaderValue::from_static(
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    ));
    hdrs.insert(header::ACCEPT_LANGUAGE,
        header::HeaderValue::from_static("en-US,en;q=0.9,fr;q=0.8"));
    let client = match reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 \
                     (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36")
        .timeout(std::time::Duration::from_secs(8))
        .default_headers(hdrs)
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
    let lower   = html.to_ascii_lowercase();
    let tag_pos = lower.find("<title")?;
    let close   = lower[tag_pos..].find('>')? + tag_pos + 1;
    let end     = lower[close..].find("</title>")? + close;
    let raw = html[close..end].trim();
    if raw.is_empty() { return None; }
    let t = raw
        .replace("&amp;",  "&").replace("&lt;",   "<").replace("&gt;",   ">")
        .replace("&quot;", "\"").replace("&#39;", "'").replace("&apos;", "'")
        .replace("&nbsp;", " ").replace("&#x27;", "'").replace("&#x2F;", "/")
        .trim().to_string();
    if t.is_empty() { None } else { Some(t) }
}
