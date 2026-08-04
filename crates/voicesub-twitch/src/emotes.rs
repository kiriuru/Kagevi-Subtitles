use std::collections::HashSet;
use std::sync::{Arc, RwLock};
use std::time::Instant;

use serde::Deserialize;
use tracing::{debug, info, warn};

use crate::emoji::{is_plain_decimal_token, normalize_whitespace, strip_unicode_emoji};
use crate::settings::TwitchEmoteSources;

pub const DEFAULT_TWITCH_CLIENT_ID: &str = "oraf2d29s9mm8kxq4xx97zo28xaj7b";
const SEVENTV_API_BASE: &str = "https://7tv.io/v3";
const BTTV_API_BASE: &str = "https://api.betterttv.net/3/cached";
const FFZ_API_BASE: &str = "https://api.frankerfacez.com/v1";
const HTTP_USER_AGENT: &str = concat!(env!("CARGO_PKG_NAME"), "/", env!("CARGO_PKG_VERSION"));

#[derive(Debug, Default, Clone)]
pub struct EmoteSets {
    pub twitch: HashSet<String>,
    pub bttv: HashSet<String>,
    pub seventv: HashSet<String>,
    pub ffz: HashSet<String>,
    pub channel_login: String,
    pub twitch_count: usize,
    pub bttv_count: usize,
    pub seventv_count: usize,
    pub ffz_count: usize,
    pub last_refresh: Option<Instant>,
}

#[derive(Debug, Default)]
pub struct EmoteRegistry {
    inner: RwLock<EmoteSets>,
}

impl EmoteRegistry {
    pub fn new() -> Arc<Self> {
        Arc::new(Self::default())
    }

    pub fn snapshot(&self) -> EmoteSets {
        self.inner
            .read()
            .map(|guard| guard.clone())
            .unwrap_or_default()
    }

    #[cfg(test)]
    pub(crate) fn seed_test_emotes(&self, twitch: &[&str], bttv: &[&str]) {
        self.seed_test_emotes_with_providers(twitch, bttv, &[], &[]);
    }

    #[cfg(test)]
    pub(crate) fn seed_test_emotes_with_seventv(
        &self,
        twitch: &[&str],
        bttv: &[&str],
        seventv: &[&str],
    ) {
        self.seed_test_emotes_with_providers(twitch, bttv, seventv, &[]);
    }

    #[cfg(test)]
    pub(crate) fn seed_test_emotes_with_providers(
        &self,
        twitch: &[&str],
        bttv: &[&str],
        seventv: &[&str],
        ffz: &[&str],
    ) {
        let mut guard = self.inner.write().expect("emote lock");
        for name in twitch {
            guard.twitch.insert(name.to_ascii_lowercase());
        }
        for code in bttv {
            insert_third_party_code(&mut guard.bttv, code);
        }
        for code in seventv {
            insert_third_party_code(&mut guard.seventv, code);
        }
        for code in ffz {
            insert_third_party_code(&mut guard.ffz, code);
        }
    }

    pub fn clean_message_text(
        &self,
        text: &str,
        irc_emotes_tag: Option<&str>,
        sources: &TwitchEmoteSources,
        strip_emoji: bool,
    ) -> String {
        // IRC `emotes` indices are relative to the raw PRIVMSG body — strip before trim.
        let mut working = text.to_string();
        if let Some(tag) = irc_emotes_tag.filter(|value| !value.is_empty()) {
            working = strip_irc_emotes(&working, tag);
        }
        self.remove_emotes_from_text(&working, sources, strip_emoji)
    }

    pub fn remove_emotes_from_text(
        &self,
        text: &str,
        sources: &TwitchEmoteSources,
        strip_emoji: bool,
    ) -> String {
        let sets = self.snapshot();
        let mut working = if strip_emoji {
            strip_unicode_emoji(text)
        } else {
            text.to_string()
        };
        if !sources.twitch && !sources.bttv && !sources.seventv && !sources.ffz {
            return normalize_whitespace(&working);
        }
        let words: Vec<String> = working
            .split_whitespace()
            .map(|word| {
                let no_emoji = if strip_emoji {
                    strip_unicode_emoji(word)
                } else {
                    word.to_string()
                };
                if no_emoji.is_empty() {
                    return String::new();
                }
                if is_plain_decimal_token(&no_emoji) {
                    return no_emoji;
                }
                if token_is_known_emote(&no_emoji, &sets, sources) {
                    return String::new();
                }
                // Chat often attaches punctuation: `Kappa!`, `(OMEGALUL)`, `"Clap"`.
                let (_prefix, core, _suffix) = peel_emote_punctuation(&no_emoji);
                if !core.is_empty()
                    && core != no_emoji.as_str()
                    && !is_plain_decimal_token(core)
                    && token_is_known_emote(core, &sets, sources)
                {
                    return String::new();
                }
                no_emoji
            })
            .filter(|word| !word.is_empty())
            .collect();
        working = words.join(" ");
        normalize_whitespace(&working)
    }

    pub async fn refresh(
        &self,
        channel_login: &str,
        client_id: &str,
        oauth_token: &str,
        sources: &TwitchEmoteSources,
    ) -> Result<EmoteSets, String> {
        let login = channel_login.trim().trim_start_matches('#').to_lowercase();
        self.refresh_all(&[login], client_id, oauth_token, sources)
            .await
    }

    pub async fn refresh_all(
        &self,
        logins: &[String],
        client_id: &str,
        oauth_token: &str,
        sources: &TwitchEmoteSources,
    ) -> Result<EmoteSets, String> {
        let normalized: Vec<String> = logins
            .iter()
            .map(|raw| raw.trim().trim_start_matches('#').to_lowercase())
            .filter(|login| !login.is_empty())
            .collect();
        if normalized.is_empty() {
            return Err("channel login is empty".into());
        }

        let client = reqwest::Client::new();
        let mut merged = EmoteSets::default();
        for login in &normalized {
            match fetch_sets_for_login(&client, login, client_id, oauth_token, sources).await {
                Ok(partial) => {
                    merged.twitch.extend(partial.twitch);
                    merged.bttv.extend(partial.bttv);
                    merged.seventv.extend(partial.seventv);
                    merged.ffz.extend(partial.ffz);
                }
                Err(err) => {
                    warn!(
                        target: "voicesub.twitch.emotes",
                        channel = %login,
                        error = %err,
                        "channel emote fetch failed"
                    );
                }
            }
        }
        merged.channel_login = normalized.join(",");
        merged.twitch_count = merged.twitch.len();
        merged.bttv_count = merged.bttv.len();
        merged.seventv_count = merged.seventv.len();
        merged.ffz_count = merged.ffz.len();
        merged.last_refresh = Some(Instant::now());

        if let Ok(mut guard) = self.inner.write() {
            *guard = merged.clone();
        }

        info!(
            target: "voicesub.twitch.emotes",
            channels = %merged.channel_login,
            twitch = merged.twitch_count,
            bttv = merged.bttv_count,
            seventv = merged.seventv_count,
            ffz = merged.ffz_count,
            "emote cache refreshed"
        );
        Ok(merged)
    }
}

async fn fetch_sets_for_login(
    client: &reqwest::Client,
    channel_login: &str,
    client_id: &str,
    oauth_token: &str,
    sources: &TwitchEmoteSources,
) -> Result<EmoteSets, String> {
    let login = channel_login.trim().trim_start_matches('#').to_lowercase();
    if login.is_empty() {
        return Err("channel login is empty".into());
    }

    let mut twitch = HashSet::new();
    let mut bttv = HashSet::new();
    let mut seventv = HashSet::new();
    let mut ffz = HashSet::new();

    let bearer = normalize_bearer(oauth_token);
    let mut broadcaster_id: Option<String> = None;

    if sources.twitch || sources.bttv || sources.seventv || sources.ffz {
        broadcaster_id = fetch_broadcaster_id(client, &login, client_id, &bearer).await;
        if broadcaster_id.is_none() {
            broadcaster_id = fetch_broadcaster_id_fallback(client, &login).await;
        }
        if broadcaster_id.is_none() {
            warn!(
                target: "voicesub.twitch.emotes",
                channel = %login,
                "broadcaster id lookup failed — channel BTTV/7TV/FFZ-by-id emotes unavailable"
            );
        }
    }

    if sources.twitch
        && let Err(err) = fetch_twitch_emotes(
            client,
            client_id,
            &bearer,
            broadcaster_id.as_deref(),
            &mut twitch,
        )
        .await
    {
        warn!(target: "voicesub.twitch.emotes", error = %err, "twitch emote fetch failed");
    }

    if sources.bttv
        && let Some(id) = broadcaster_id.as_deref()
        && let Err(err) = fetch_bttv_emotes(client, id, &mut bttv).await
    {
        warn!(target: "voicesub.twitch.emotes", error = %err, "bttv emote fetch failed");
    }

    if sources.seventv
        && let Some(id) = broadcaster_id.as_deref()
        && let Err(err) = fetch_seventv_emotes(client, id, &mut seventv).await
    {
        warn!(target: "voicesub.twitch.emotes", error = %err, "7tv emote fetch failed");
    }

    if sources.ffz
        && let Err(err) =
            fetch_ffz_emotes(client, &login, broadcaster_id.as_deref(), &mut ffz).await
    {
        warn!(target: "voicesub.twitch.emotes", error = %err, "ffz emote fetch failed");
    }

    let mut snapshot = EmoteSets {
        twitch,
        bttv,
        seventv,
        ffz,
        channel_login: login.clone(),
        twitch_count: 0,
        bttv_count: 0,
        seventv_count: 0,
        ffz_count: 0,
        last_refresh: Some(Instant::now()),
    };
    snapshot.twitch_count = snapshot.twitch.len();
    snapshot.bttv_count = snapshot.bttv.len();
    snapshot.seventv_count = snapshot.seventv.len();
    snapshot.ffz_count = snapshot.ffz.len();
    Ok(snapshot)
}

fn normalize_bearer(token: &str) -> String {
    let trimmed = token.trim();
    if trimmed.is_empty() {
        return String::new();
    }
    if trimmed.to_ascii_lowercase().starts_with("oauth:") {
        trimmed[6..].trim().to_string()
    } else {
        trimmed.to_string()
    }
}

async fn fetch_broadcaster_id(
    client: &reqwest::Client,
    login: &str,
    client_id: &str,
    bearer: &str,
) -> Option<String> {
    let url = format!("https://api.twitch.tv/helix/users?login={login}");
    let mut req = client.get(&url).header("Client-Id", client_id);
    if !bearer.is_empty() {
        req = req.header("Authorization", format!("Bearer {bearer}"));
    }
    let response = req.send().await.ok()?;
    if !response.status().is_success() {
        debug!(
            target: "voicesub.twitch.emotes",
            status = %response.status(),
            "helix users lookup failed"
        );
        return None;
    }
    let body: HelixUsersResponse = response.json().await.ok()?;
    body.data.into_iter().next().map(|user| user.id)
}

async fn fetch_twitch_emotes(
    client: &reqwest::Client,
    client_id: &str,
    bearer: &str,
    broadcaster_id: Option<&str>,
    out: &mut HashSet<String>,
) -> Result<(), String> {
    let headers = |req: reqwest::RequestBuilder| {
        let mut req = req.header("Client-Id", client_id);
        if !bearer.is_empty() {
            req = req.header("Authorization", format!("Bearer {bearer}"));
        }
        req
    };

    let global: HelixEmotesResponse =
        headers(client.get("https://api.twitch.tv/helix/chat/emotes/global"))
            .send()
            .await
            .map_err(|err| err.to_string())?
            .json()
            .await
            .map_err(|err| err.to_string())?;
    for emote in global.data {
        out.insert(emote.name.to_ascii_lowercase());
    }

    if let Some(id) = broadcaster_id {
        let url = format!("https://api.twitch.tv/helix/chat/emotes?broadcaster_id={id}");
        let channel: HelixEmotesResponse = headers(client.get(url))
            .send()
            .await
            .map_err(|err| err.to_string())?
            .json()
            .await
            .map_err(|err| err.to_string())?;
        for emote in channel.data {
            out.insert(emote.name.to_ascii_lowercase());
        }
    }
    Ok(())
}

async fn fetch_bttv_emotes(
    client: &reqwest::Client,
    broadcaster_id: &str,
    out: &mut HashSet<String>,
) -> Result<(), String> {
    let global_url = format!("{BTTV_API_BASE}/emotes/global");
    let global: Vec<BttvEmote> = bttv_api_request(client, global_url)
        .send()
        .await
        .map_err(|err| err.to_string())?
        .json()
        .await
        .map_err(|err| err.to_string())?;
    collect_bttv_emotes(out, &global);

    let url = format!("{BTTV_API_BASE}/users/twitch/{broadcaster_id}");
    let user: BttvUser = bttv_api_request(client, url)
        .send()
        .await
        .map_err(|err| err.to_string())?
        .json()
        .await
        .map_err(|err| err.to_string())?;
    collect_bttv_emotes(out, &user.channel_emotes);
    collect_bttv_emotes(out, &user.shared_emotes);
    Ok(())
}

fn bttv_api_request(client: &reqwest::Client, url: String) -> reqwest::RequestBuilder {
    client
        .get(url)
        .header("User-Agent", HTTP_USER_AGENT)
        .header("Accept", "application/json")
}

fn collect_bttv_emotes(out: &mut HashSet<String>, emotes: &[BttvEmote]) {
    for emote in emotes {
        insert_third_party_code(out, &emote.code);
    }
}

fn seventv_api_request(client: &reqwest::Client, url: String) -> reqwest::RequestBuilder {
    client
        .get(url)
        .header("User-Agent", HTTP_USER_AGENT)
        .header("Accept", "application/json")
        .header("X-SevenTV-Platform", "voicesub")
        .header("X-SevenTV-Version", env!("CARGO_PKG_VERSION"))
}

async fn fetch_seventv_emotes(
    client: &reqwest::Client,
    broadcaster_id: &str,
    out: &mut HashSet<String>,
) -> Result<(), String> {
    let global_url = format!("{SEVENTV_API_BASE}/emote-sets/global");
    let global: SevenTvEmoteSet = seventv_api_request(client, global_url)
        .send()
        .await
        .map_err(|err| err.to_string())?
        .json()
        .await
        .map_err(|err| err.to_string())?;
    collect_seventv_set_emotes(out, &global.emotes);

    let url = format!("{SEVENTV_API_BASE}/users/twitch/{broadcaster_id}");
    let user: SevenTvUserResponse = seventv_api_request(client, url)
        .send()
        .await
        .map_err(|err| err.to_string())?
        .json()
        .await
        .map_err(|err| err.to_string())?;

    if let Some(set) = user.emote_set {
        collect_seventv_set_emotes(out, &set.emotes);
        if set.emotes.is_empty()
            && let Some(set_id) = user.emote_set_id.as_deref().or(Some(set.id.as_str()))
            && let Err(err) = fetch_seventv_emote_set_by_id(client, set_id, out).await
        {
            warn!(
                target: "voicesub.twitch.emotes",
                set_id = %set_id,
                error = %err,
                "7tv emote set fetch by id failed"
            );
        }
    } else if let Some(set_id) = user.emote_set_id.as_deref() {
        fetch_seventv_emote_set_by_id(client, set_id, out).await?;
    }

    if let Some(profile) = user.user {
        for set_ref in profile.emote_sets {
            if !set_ref.emotes.is_empty() {
                collect_seventv_set_emotes(out, &set_ref.emotes);
                continue;
            }
            if let Some(set_id) = set_ref.id.as_deref()
                && let Err(err) = fetch_seventv_emote_set_by_id(client, set_id, out).await
            {
                warn!(
                    target: "voicesub.twitch.emotes",
                    set_id = %set_id,
                    error = %err,
                    "7tv supplemental emote set fetch failed"
                );
            }
        }
    }

    Ok(())
}

async fn fetch_seventv_emote_set_by_id(
    client: &reqwest::Client,
    set_id: &str,
    out: &mut HashSet<String>,
) -> Result<(), String> {
    let url = format!("{SEVENTV_API_BASE}/emote-sets/{set_id}");
    let set: SevenTvEmoteSet = seventv_api_request(client, url)
        .send()
        .await
        .map_err(|err| err.to_string())?
        .json()
        .await
        .map_err(|err| err.to_string())?;
    collect_seventv_set_emotes(out, &set.emotes);
    Ok(())
}

fn collect_seventv_set_emotes(out: &mut HashSet<String>, emotes: &[SevenTvEmote]) {
    for emote in emotes {
        insert_seventv_emote(out, emote);
    }
}

/// Index both the active set name (channel alias) and canonical `data.name`.
fn insert_seventv_emote(out: &mut HashSet<String>, emote: &SevenTvEmote) {
    if let Some(name) = emote
        .name
        .as_deref()
        .map(str::trim)
        .filter(|name| !name.is_empty())
    {
        insert_third_party_code(out, name);
    }
    if let Some(base) = emote
        .data
        .as_ref()
        .and_then(|data| data.name.as_deref())
        .map(str::trim)
        .filter(|name| !name.is_empty())
        && emote.name.as_deref().map(str::trim) != Some(base)
    {
        insert_third_party_code(out, base);
    }
}

async fn fetch_ffz_emotes(
    client: &reqwest::Client,
    login: &str,
    broadcaster_id: Option<&str>,
    out: &mut HashSet<String>,
) -> Result<(), String> {
    let global_url = format!("{FFZ_API_BASE}/set/global");
    let global: FfzGlobalResponse = ffz_api_request(client, global_url)
        .send()
        .await
        .map_err(|err| err.to_string())?
        .error_for_status()
        .map_err(|err| err.to_string())?
        .json()
        .await
        .map_err(|err| err.to_string())?;
    collect_ffz_default_sets(out, &global);

    // Prefer room-by-login (no Helix id required); fall back to room-by-id.
    let room_urls = [
        format!("{FFZ_API_BASE}/room/{login}"),
        broadcaster_id
            .map(|id| format!("{FFZ_API_BASE}/room/id/{id}"))
            .unwrap_or_default(),
    ];
    let mut room_ok = false;
    let mut last_err = String::new();
    for url in room_urls.into_iter().filter(|url| !url.is_empty()) {
        match ffz_api_request(client, url).send().await {
            Ok(response) if response.status().is_success() => {
                match response.json::<FfzRoomResponse>().await {
                    Ok(room) => {
                        collect_ffz_sets(out, &room.sets);
                        room_ok = true;
                        break;
                    }
                    Err(err) => last_err = err.to_string(),
                }
            }
            Ok(response) => {
                last_err = format!("HTTP {}", response.status());
            }
            Err(err) => last_err = err.to_string(),
        }
    }
    if !room_ok && !last_err.is_empty() {
        debug!(
            target: "voicesub.twitch.emotes",
            channel = %login,
            error = %last_err,
            "ffz room fetch failed — global set still applied"
        );
    }
    Ok(())
}

fn ffz_api_request(client: &reqwest::Client, url: String) -> reqwest::RequestBuilder {
    client.get(url).header("User-Agent", HTTP_USER_AGENT)
}

fn collect_ffz_default_sets(out: &mut HashSet<String>, global: &FfzGlobalResponse) {
    for set_id in &global.default_sets {
        let key = set_id.to_string();
        if let Some(set) = global.sets.get(&key) {
            collect_ffz_emoticons(out, &set.emoticons);
        }
    }
}

fn collect_ffz_sets(
    out: &mut HashSet<String>,
    sets: &std::collections::HashMap<String, FfzEmoteSet>,
) {
    for set in sets.values() {
        collect_ffz_emoticons(out, &set.emoticons);
    }
}

fn collect_ffz_emoticons(out: &mut HashSet<String>, emoticons: &[FfzEmote]) {
    for emote in emoticons {
        if emote.hidden {
            continue;
        }
        insert_third_party_code(out, &emote.name);
    }
}

/// Strip Twitch IRC `emotes` tag ranges (UTF-16 indices, inclusive).
pub fn strip_irc_emotes(text: &str, emotes_tag: &str) -> String {
    let ranges = parse_irc_emote_ranges(emotes_tag);
    if ranges.is_empty() {
        return text.to_string();
    }
    let mut units: Vec<u16> = text.encode_utf16().collect();
    for (start, end) in ranges {
        if start < units.len() && end < units.len() && start <= end {
            units.drain(start..=end);
        }
    }
    String::from_utf16_lossy(&units)
}

fn parse_irc_emote_ranges(emotes_tag: &str) -> Vec<(usize, usize)> {
    let mut ranges = Vec::new();
    for segment in emotes_tag.split('/') {
        let Some((_, ranges_part)) = segment.split_once(':') else {
            continue;
        };
        for range in ranges_part.split(',') {
            let Some((start, end)) = range.split_once('-') else {
                continue;
            };
            if let (Ok(start), Ok(end)) = (start.parse::<usize>(), end.parse::<usize>()) {
                ranges.push((start, end));
            }
        }
    }
    ranges.sort_by_key(|range| std::cmp::Reverse(range.0));
    ranges
}

fn insert_third_party_code(set: &mut HashSet<String>, code: &str) {
    let trimmed = code.trim();
    if trimmed.is_empty() {
        return;
    }
    set.insert(trimmed.to_string());
    let lower = trimmed.to_ascii_lowercase();
    if lower != trimmed {
        set.insert(lower);
    }
}

fn emote_set_contains(set: &HashSet<String>, word: &str) -> bool {
    set.contains(word) || set.contains(&word.to_ascii_lowercase())
}

fn token_is_known_emote(token: &str, sets: &EmoteSets, sources: &TwitchEmoteSources) -> bool {
    if token.is_empty() {
        return false;
    }
    let lc = token.to_ascii_lowercase();
    if sources.twitch && sets.twitch.contains(&lc) {
        return true;
    }
    if sources.bttv && emote_set_contains(&sets.bttv, token) {
        return true;
    }
    if sources.seventv && emote_set_contains(&sets.seventv, token) {
        return true;
    }
    if sources.ffz && emote_set_contains(&sets.ffz, token) {
        return true;
    }
    false
}

/// Peel common chat punctuation so lexical emote codes still match (`Kappa!`, `(OMEGALUL)`).
fn peel_emote_punctuation(token: &str) -> (&str, &str, &str) {
    const EDGE: &[char] = &[
        '!', '?', '.', ',', ';', ':', '"', '\'', '(', ')', '[', ']', '{', '}', '<', '>', '*', '«',
        '»', '„', '“', '”', '‘', '’',
    ];
    let bytes = token.as_bytes();
    let mut start = 0;
    while start < bytes.len() {
        let ch = token[start..].chars().next().unwrap_or('\0');
        if !EDGE.contains(&ch) {
            break;
        }
        start += ch.len_utf8();
    }
    let mut end = bytes.len();
    while end > start {
        let ch = token[..end].chars().next_back().unwrap_or('\0');
        if !EDGE.contains(&ch) {
            break;
        }
        end -= ch.len_utf8();
    }
    if start == 0 && end == bytes.len() {
        return ("", token, "");
    }
    (&token[..start], &token[start..end], &token[end..])
}

async fn fetch_broadcaster_id_fallback(client: &reqwest::Client, login: &str) -> Option<String> {
    #[derive(Debug, Deserialize)]
    struct IvrUser {
        id: Option<u64>,
    }
    let url = format!("https://api.ivr.fi/v2/twitch/user?login={login}");
    let response = client.get(&url).send().await.ok()?;
    if !response.status().is_success() {
        debug!(
            target: "voicesub.twitch.emotes",
            status = %response.status(),
            "ivr.fi user lookup failed"
        );
        return None;
    }
    let body: IvrUser = response.json().await.ok()?;
    body.id.map(|id| id.to_string())
}

#[derive(Debug, Deserialize)]
struct HelixUsersResponse {
    data: Vec<HelixUser>,
}

#[derive(Debug, Deserialize)]
struct HelixUser {
    id: String,
}

#[derive(Debug, Deserialize)]
struct HelixEmotesResponse {
    data: Vec<HelixEmote>,
}

#[derive(Debug, Deserialize)]
struct HelixEmote {
    name: String,
}

#[derive(Debug, Deserialize)]
struct BttvEmote {
    code: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BttvUser {
    #[serde(default)]
    channel_emotes: Vec<BttvEmote>,
    #[serde(default)]
    shared_emotes: Vec<BttvEmote>,
}

#[derive(Debug, Deserialize)]
struct SevenTvUserResponse {
    #[serde(default)]
    emote_set_id: Option<String>,
    emote_set: Option<SevenTvEmoteSet>,
    user: Option<SevenTvUserProfile>,
}

#[derive(Debug, Deserialize)]
struct SevenTvUserProfile {
    #[serde(default)]
    emote_sets: Vec<SevenTvEmoteSetRef>,
}

#[derive(Debug, Deserialize)]
struct SevenTvEmoteSetRef {
    id: Option<String>,
    #[serde(default)]
    emotes: Vec<SevenTvEmote>,
}

#[derive(Debug, Deserialize)]
struct SevenTvEmoteSet {
    #[serde(default)]
    id: String,
    #[serde(default)]
    emotes: Vec<SevenTvEmote>,
}

#[derive(Debug, Deserialize)]
struct SevenTvEmote {
    name: Option<String>,
    #[serde(default)]
    data: Option<SevenTvEmoteData>,
}

#[derive(Debug, Deserialize)]
struct SevenTvEmoteData {
    name: Option<String>,
}

#[derive(Debug, Deserialize)]
struct FfzGlobalResponse {
    #[serde(default)]
    default_sets: Vec<i64>,
    #[serde(default)]
    sets: std::collections::HashMap<String, FfzEmoteSet>,
}

#[derive(Debug, Deserialize)]
struct FfzRoomResponse {
    #[serde(default)]
    sets: std::collections::HashMap<String, FfzEmoteSet>,
}

#[derive(Debug, Deserialize)]
struct FfzEmoteSet {
    #[serde(default)]
    emoticons: Vec<FfzEmote>,
}

#[derive(Debug, Deserialize)]
struct FfzEmote {
    #[serde(default)]
    name: String,
    #[serde(default)]
    hidden: bool,
}

#[cfg(test)]
#[allow(clippy::field_reassign_with_default)]
mod tests {
    use super::*;

    #[test]
    fn filters_known_emotes_lexically() {
        let registry = EmoteRegistry::new();
        {
            let mut guard = registry.inner.write().unwrap();
            guard.twitch.insert("kappa".into());
            insert_third_party_code(&mut guard.bttv, "OMEGALUL");
        }
        let sources = TwitchEmoteSources::default();
        let out = registry.remove_emotes_from_text("hello Kappa OMEGALUL world", &sources, true);
        assert_eq!(out, "hello world");
    }

    #[test]
    fn strips_irc_emote_positions() {
        let out = strip_irc_emotes("baleGIGA", "25:0-7");
        assert_eq!(out, "");
    }

    #[test]
    fn irc_emote_indices_apply_before_trim() {
        let registry = EmoteRegistry::new();
        let sources = TwitchEmoteSources {
            twitch: false,
            bttv: false,
            seventv: false,
            ffz: false,
        };
        // Leading spaces must not shift UTF-16 indices from the IRC tag.
        let out = registry.clean_message_text("  Kappa hi", Some("25:2-6"), &sources, false);
        assert_eq!(out, "hi");
    }

    #[test]
    fn lexical_emote_strips_trailing_punctuation() {
        let registry = EmoteRegistry::new();
        registry.seed_test_emotes(&["kappa"], &["OMEGALUL"]);
        let sources = TwitchEmoteSources::default();
        assert_eq!(
            registry.remove_emotes_from_text("hello Kappa! world", &sources, false),
            "hello world"
        );
        assert_eq!(
            registry.remove_emotes_from_text("(OMEGALUL) nice", &sources, false),
            "nice"
        );
        assert_eq!(
            registry.remove_emotes_from_text("\"Kappa\" ok", &sources, false),
            "ok"
        );
    }

    #[test]
    fn lexical_emote_keeps_punctuation_only_tokens() {
        let registry = EmoteRegistry::new();
        registry.seed_test_emotes(&["kappa"], &[]);
        let sources = TwitchEmoteSources::default();
        assert_eq!(
            registry.remove_emotes_from_text("!!! ???", &sources, false),
            "!!! ???"
        );
    }

    #[test]
    fn strips_multiple_irc_emote_ranges() {
        let out = strip_irc_emotes("Kappa Keepo hi", "25:0-4/1902:6-10");
        assert_eq!(crate::emoji::normalize_whitespace(&out), "hi");
    }

    #[test]
    fn bttv_case_insensitive_match() {
        let mut set = HashSet::new();
        insert_third_party_code(&mut set, "baleGIGA");
        assert!(emote_set_contains(&set, "baleGIGA"));
        assert!(emote_set_contains(&set, "BaleGIGA"));
    }

    #[test]
    fn parses_bttv_user_payload_camel_case_fields() {
        let payload = r#"{
            "id": "602017945244db6c5980e4bc",
            "channelEmotes": [
                { "id": "60bb405ff8b3f62601c38e47", "code": "peepoHeyyy" }
            ],
            "sharedEmotes": [
                { "id": "5f503a0568d9d86c020db3bb", "code": "NOPERS" }
            ]
        }"#;
        let user: BttvUser = serde_json::from_str(payload).expect("json");
        assert_eq!(user.channel_emotes.len(), 1);
        assert_eq!(user.shared_emotes.len(), 1);
        assert_eq!(user.channel_emotes[0].code, "peepoHeyyy");
        assert_eq!(user.shared_emotes[0].code, "NOPERS");

        let mut out = HashSet::new();
        collect_bttv_emotes(&mut out, &user.channel_emotes);
        collect_bttv_emotes(&mut out, &user.shared_emotes);
        assert!(emote_set_contains(&out, "peepoHeyyy"));
        assert!(emote_set_contains(&out, "NOPERS"));
    }

    #[test]
    fn bttv_strips_channel_and_shared_codes() {
        let registry = EmoteRegistry::new();
        registry.seed_test_emotes(&[], &["OMEGALUL", "NOPERS"]);
        let mut sources = TwitchEmoteSources::default();
        sources.twitch = false;
        sources.seventv = false;
        assert_eq!(
            registry.remove_emotes_from_text("OMEGALUL hi NOPERS", &sources, false),
            "hi"
        );
    }

    #[test]
    fn bttv_respects_source_toggle() {
        let registry = EmoteRegistry::new();
        registry.seed_test_emotes(&[], &["CiGrip"]);
        let mut sources = TwitchEmoteSources::default();
        sources.twitch = false;
        sources.seventv = false;
        sources.bttv = false;
        assert_eq!(
            registry.remove_emotes_from_text("CiGrip hello", &sources, false),
            "CiGrip hello"
        );
        sources.bttv = true;
        assert_eq!(
            registry.remove_emotes_from_text("CiGrip hello", &sources, false),
            "hello"
        );
    }

    #[test]
    fn clean_message_text_removes_cached_emote_without_irc_tag() {
        let registry = EmoteRegistry::new();
        {
            let mut guard = registry.inner.write().unwrap();
            insert_third_party_code(&mut guard.bttv, "baleGIGA");
        }
        let sources = TwitchEmoteSources::default();
        let out = registry.clean_message_text("baleGIGA", None, &sources, false);
        assert_eq!(out, "");
    }

    #[test]
    fn keeps_numeric_tokens_when_emote_cache_has_same_code() {
        let registry = EmoteRegistry::new();
        {
            let mut guard = registry.inner.write().unwrap();
            insert_third_party_code(&mut guard.bttv, "100");
            insert_third_party_code(&mut guard.bttv, "5");
            guard.twitch.insert("kappa".into());
        }
        let sources = TwitchEmoteSources::default();
        let sample = "Kappa до 100 сделать 5ю и 42";
        let out = registry.remove_emotes_from_text(sample, &sources, true);
        assert_eq!(out, "до 100 сделать 5ю и 42");
    }

    #[test]
    fn strips_emotes_and_unicode_emoji_while_preserving_digits() {
        let registry = EmoteRegistry::new();
        {
            let mut guard = registry.inner.write().unwrap();
            guard.twitch.insert("kappa".into());
            insert_third_party_code(&mut guard.bttv, "OMEGALUL");
        }
        let sources = TwitchEmoteSources::default();
        let input = format!("Kappa OMEGALUL gg {} 123 ok", '\u{1F600}');
        let out = registry.clean_message_text(&input, None, &sources, true);
        assert_eq!(out, "gg 123 ok");
    }

    #[test]
    fn irc_emote_strip_leaves_surrounding_digits() {
        let out = strip_irc_emotes("5 baleGIGA 100", "25:2-9");
        assert_eq!(out, "5  100");
    }

    #[test]
    fn seventv_strips_channel_alias_and_canonical_name() {
        let registry = EmoteRegistry::new();
        registry.seed_test_emotes_with_seventv(&[], &[], &["MyClap"]);
        {
            let mut guard = registry.inner.write().unwrap();
            insert_third_party_code(&mut guard.seventv, "Clap");
        }
        let mut sources = TwitchEmoteSources::default();
        sources.twitch = false;
        sources.bttv = false;
        assert_eq!(
            registry.remove_emotes_from_text("hello MyClap world", &sources, false),
            "hello world"
        );
        assert_eq!(
            registry.remove_emotes_from_text("hello Clap world", &sources, false),
            "hello world"
        );
    }

    #[test]
    fn seventv_respects_source_toggle() {
        let registry = EmoteRegistry::new();
        registry.seed_test_emotes_with_seventv(&[], &[], &["RainbowPls"]);
        let mut sources = TwitchEmoteSources::default();
        sources.twitch = false;
        sources.bttv = false;
        sources.seventv = false;
        sources.ffz = false;
        assert_eq!(
            registry.remove_emotes_from_text("RainbowPls gg", &sources, false),
            "RainbowPls gg"
        );
        sources.seventv = true;
        assert_eq!(
            registry.remove_emotes_from_text("RainbowPls gg", &sources, false),
            "gg"
        );
    }

    #[test]
    fn insert_seventv_emote_indexes_alias_and_base_name() {
        let mut set = HashSet::new();
        insert_seventv_emote(
            &mut set,
            &SevenTvEmote {
                name: Some("MyClap".into()),
                data: Some(SevenTvEmoteData {
                    name: Some("Clap".into()),
                }),
            },
        );
        assert!(emote_set_contains(&set, "MyClap"));
        assert!(emote_set_contains(&set, "Clap"));
    }

    #[test]
    fn parses_seventv_user_payload_and_collects_alias_names() {
        let payload = r#"{
            "emote_set_id": "01SET",
            "emote_set": {
                "id": "01SET",
                "emotes": [
                    {
                        "name": "MyClap",
                        "data": { "name": "Clap" }
                    }
                ]
            },
            "user": {
                "emote_sets": [
                    { "id": "01OTHER", "emotes": [ { "name": "RainbowPls", "data": { "name": "RainbowPls" } } ] }
                ]
            }
        }"#;
        let parsed: SevenTvUserResponse = serde_json::from_str(payload).expect("json");
        let mut out = HashSet::new();
        if let Some(set) = parsed.emote_set {
            collect_seventv_set_emotes(&mut out, &set.emotes);
        }
        if let Some(profile) = parsed.user {
            for set_ref in profile.emote_sets {
                collect_seventv_set_emotes(&mut out, &set_ref.emotes);
            }
        }
        assert!(emote_set_contains(&out, "MyClap"));
        assert!(emote_set_contains(&out, "Clap"));
        assert!(emote_set_contains(&out, "RainbowPls"));
    }

    #[test]
    fn ffz_strips_channel_and_global_codes() {
        let registry = EmoteRegistry::new();
        registry.seed_test_emotes_with_providers(&[], &[], &[], &["CatBag", "BeanieHipster"]);
        let mut sources = TwitchEmoteSources::default();
        sources.twitch = false;
        sources.bttv = false;
        sources.seventv = false;
        assert_eq!(
            registry.remove_emotes_from_text("CatBag hi BeanieHipster", &sources, false),
            "hi"
        );
    }

    #[test]
    fn ffz_respects_source_toggle() {
        let registry = EmoteRegistry::new();
        registry.seed_test_emotes_with_providers(&[], &[], &[], &["CatBag"]);
        let mut sources = TwitchEmoteSources::default();
        sources.twitch = false;
        sources.bttv = false;
        sources.seventv = false;
        sources.ffz = false;
        assert_eq!(
            registry.remove_emotes_from_text("CatBag hello", &sources, false),
            "CatBag hello"
        );
        sources.ffz = true;
        assert_eq!(
            registry.remove_emotes_from_text("CatBag hello", &sources, false),
            "hello"
        );
    }

    #[test]
    fn parses_ffz_global_default_sets_only() {
        let payload = r#"{
            "default_sets": [3],
            "sets": {
                "3": {
                    "emoticons": [
                        { "name": "CatBag", "hidden": false },
                        { "name": "HiddenOne", "hidden": true }
                    ]
                },
                "4330": {
                    "emoticons": [
                        { "name": "DonorOnly", "hidden": false }
                    ]
                }
            }
        }"#;
        let global: FfzGlobalResponse = serde_json::from_str(payload).expect("json");
        let mut out = HashSet::new();
        collect_ffz_default_sets(&mut out, &global);
        assert!(emote_set_contains(&out, "CatBag"));
        assert!(!emote_set_contains(&out, "HiddenOne"));
        assert!(
            !emote_set_contains(&out, "DonorOnly"),
            "non-default global sets must not be indexed"
        );
    }

    #[test]
    fn parses_ffz_room_sets() {
        let payload = r#"{
            "sets": {
                "1": {
                    "emoticons": [
                        { "name": "BeanieHipster", "hidden": false }
                    ]
                }
            }
        }"#;
        let room: FfzRoomResponse = serde_json::from_str(payload).expect("json");
        let mut out = HashSet::new();
        collect_ffz_sets(&mut out, &room.sets);
        assert!(emote_set_contains(&out, "BeanieHipster"));
    }
}
