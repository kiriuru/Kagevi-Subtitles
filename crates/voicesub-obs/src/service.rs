use std::collections::VecDeque;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex as StdMutex};
use std::time::{Duration, Instant};

use serde_json::{Value, json};
use tokio::sync::{Mutex, Notify};
use tokio::task::JoinHandle;
use tracing::{debug, trace};
use voicesub_subtitle::{ConfigGetter, SubtitlePayloadEvent};

#[cfg(test)]
use crate::client::MockObsClient;
use crate::client::{ObsClientError, ObsClientHandle, ObsWsClient};
use crate::diagnostics::{ConnectionState, ObsCaptionDiagnostics};
use crate::error_codes::{self, native_status};
use crate::settings::{CONNECTABLE_OUTPUT_MODES, ObsCaptionSettings, SOURCE_EVENT_OUTPUT_MODES};
use crate::text::{
    normalize_text, select_payload_live_draft_text, select_payload_text,
    should_throttle_partial_update,
};
use crate::trace::{ObsCaptionLog, StructuredLogFn};

const QUEUE_MAX_SIZE: usize = 32;
/// Retries for best-effort remote clear on stop / disable (transient OBS WS hiccups).
const CLEAR_REMOTE_ATTEMPTS: u32 = 3;
const CLEAR_REMOTE_RETRY_DELAY: Duration = Duration::from_millis(50);

enum QueueItem {
    SourcePartial(String),
    SourceFinal(String),
    Payload(Box<SubtitlePayloadEvent>),
    DelayedSend {
        text: String,
        send_stream: bool,
        mirror_debug: bool,
        delay_ms: u64,
        generation: u64,
    },
    DelayedClear {
        send_stream: bool,
        mirror_debug: bool,
        delay_ms: u64,
        generation: u64,
    },
}

pub struct ObsCaptionService {
    config_getter: ConfigGetter,
    inner: Arc<Inner>,
}

struct Inner {
    config_getter: ConfigGetter,
    log: ObsCaptionLog,
    queue: StdMutex<VecDeque<QueueItem>>,
    queue_notify: Notify,
    worker_task: Mutex<Option<JoinHandle<()>>>,
    /// Hot-path gate: avoids `try_lock` races that silently dropped queue items.
    worker_running: AtomicBool,
    /// True when worker is up and OBS settings want a connection (native and/or debug).
    accepting_events: AtomicBool,
    connection_task: Mutex<Option<JoinHandle<()>>>,
    client: Mutex<Option<ObsClientHandle>>,
    diagnostics: Mutex<ObsCaptionDiagnostics>,
    desired_connection: Mutex<bool>,
    connected_notify: Notify,
    last_partial_text: Mutex<String>,
    last_partial_sent: Mutex<Option<Instant>>,
    last_payload_signature: StdMutex<Option<(u64, String, String)>>,
    connection_key: Mutex<Option<(String, u16, String, bool)>>,
    delayed_generation: AtomicU64,
    clear_generation: AtomicU64,
}

#[cfg(test)]
impl ObsCaptionService {
    pub async fn install_mock_client(&self, mock: MockObsClient) {
        {
            let mut diag = self.inner.diagnostics.lock().await;
            diag.connected = true;
            diag.connection_state = ConnectionState::Connected;
            diag.stream_output_active = Some(true);
            diag.last_error = None;
        }
        *self.inner.client.lock().await = Some(ObsClientHandle::Mock(mock));
        self.inner.connected_notify.notify_waiters();
    }
}

impl ObsCaptionService {
    pub fn new(config_getter: ConfigGetter, structured_log: Option<StructuredLogFn>) -> Arc<Self> {
        let log = ObsCaptionLog::new(structured_log);
        Arc::new(Self {
            config_getter: config_getter.clone(),
            inner: Arc::new(Inner {
                config_getter,
                log,
                queue: StdMutex::new(VecDeque::new()),
                queue_notify: Notify::new(),
                worker_task: Mutex::new(None),
                worker_running: AtomicBool::new(false),
                accepting_events: AtomicBool::new(false),
                connection_task: Mutex::new(None),
                client: Mutex::new(None),
                diagnostics: Mutex::new(ObsCaptionDiagnostics::default()),
                desired_connection: Mutex::new(false),
                connected_notify: Notify::new(),
                last_partial_text: Mutex::new(String::new()),
                last_partial_sent: Mutex::new(None),
                last_payload_signature: StdMutex::new(None),
                connection_key: Mutex::new(None),
                delayed_generation: AtomicU64::new(0),
                clear_generation: AtomicU64::new(0),
            }),
        })
    }

    pub async fn diagnostics(&self) -> Value {
        let settings = ObsCaptionSettings::from_config(&(self.config_getter)());
        let diag = self.inner.diagnostics.lock().await.clone();
        let mut value = diag.to_value(&settings);
        if let Some(obj) = value.as_object_mut() {
            obj.insert(
                "active".into(),
                json!(
                    settings.native_enabled()
                        && diag.connected
                        && diag.stream_output_active == Some(true)
                ),
            );
            obj.insert(
                "native_caption_ready".into(),
                json!(
                    settings.native_enabled()
                        && diag.connected
                        && diag.stream_output_active == Some(true)
                ),
            );
        }
        value
    }

    /// Cheap hot-path check used by the subtitle publish callback to skip `payload.clone()`.
    pub fn is_accepting_events(&self) -> bool {
        self.inner.accepting_events.load(Ordering::Relaxed)
    }

    fn refresh_accepting_events(&self) {
        let settings = ObsCaptionSettings::from_config(&(self.config_getter)());
        let accepting =
            self.inner.worker_running.load(Ordering::Relaxed) && settings.should_connect();
        self.inner
            .accepting_events
            .store(accepting, Ordering::SeqCst);
    }

    pub async fn start(&self) {
        let mut worker = self.inner.worker_task.lock().await;
        if worker.as_ref().is_some_and(|task| !task.is_finished()) {
            self.inner.worker_running.store(true, Ordering::SeqCst);
            drop(worker);
            self.refresh_accepting_events();
            return;
        }
        let inner = self.inner.clone();
        self.inner.log.service_started();
        self.inner.worker_running.store(true, Ordering::SeqCst);
        *worker = Some(tokio::spawn(async move {
            worker_loop(inner).await;
        }));
        drop(worker);
        self.refresh_accepting_events();
    }

    pub async fn stop(&self) {
        self.inner.log.service_stopped();
        self.inner.worker_running.store(false, Ordering::SeqCst);
        self.inner.accepting_events.store(false, Ordering::SeqCst);
        bump_delayed_generation(&self.inner);
        bump_clear_generation(&self.inner);
        *self.inner.desired_connection.lock().await = false;
        drain_queue(&self.inner);
        let settings = ObsCaptionSettings::from_config(&(self.config_getter)());
        self.clear_remote_outputs_if_possible(&settings).await;
        if let Some(task) = self.inner.connection_task.lock().await.take() {
            task.abort();
        }
        if let Some(client) = self.inner.client.lock().await.take() {
            client.close().await;
        }
        *self.inner.connection_key.lock().await = None;
        {
            let mut diag = self.inner.diagnostics.lock().await;
            diag.connected = false;
            diag.stream_output_active = None;
            diag.stream_output_reconnecting = None;
            diag.native_caption_status = None;
        }
        set_connection_state(&self.inner, ConnectionState::Disconnected, None).await;
        self.inner.connected_notify.notify_waiters();
        if let Some(task) = self.inner.worker_task.lock().await.take() {
            task.abort();
        }
        drain_queue(&self.inner);
        *self.inner.last_partial_text.lock().await = String::new();
        *self.inner.last_partial_sent.lock().await = None;
        *self
            .inner
            .last_payload_signature
            .lock()
            .unwrap_or_else(|e| e.into_inner()) = None;
    }

    async fn clear_remote_outputs_if_possible(&self, settings: &ObsCaptionSettings) {
        let mut client_guard = self.inner.client.lock().await;
        let Some(client) = client_guard.as_mut() else {
            return;
        };

        let diag = self.inner.diagnostics.lock().await;
        let should_clear_native = (settings.enabled
            && CONNECTABLE_OUTPUT_MODES.contains(&settings.output_mode.as_str()))
            || diag
                .last_caption_text
                .as_ref()
                .is_some_and(|text| !text.is_empty());
        let debug_input_name = if settings.debug_text_input_enabled() {
            Some(settings.debug_input_name.clone())
        } else {
            None
        };
        let last_debug_input_name = diag.last_debug_input_name.clone();
        let should_clear_debug = diag
            .last_debug_text
            .as_ref()
            .is_some_and(|text| !text.is_empty())
            || last_debug_input_name.is_some();
        drop(diag);

        if should_clear_native {
            match send_clear_with_retries(
                client,
                "SendStreamCaption",
                json!({ "captionText": "" }),
                /*accept_stream_inactive*/ true,
            )
            .await
            {
                Ok(()) => {
                    let mut diag = self.inner.diagnostics.lock().await;
                    diag.last_caption_text = Some(String::new());
                    diag.last_caption_sent_at_utc = Some(utc_now_iso());
                }
                Err(err) => {
                    self.inner
                        .log
                        .caption_send_failed(&format!("clear_native: {err}"));
                    debug!(error = %err, "obs clear SendStreamCaption failed after retries");
                }
            }
        }

        if should_clear_debug && let Some(input_name) = debug_input_name.or(last_debug_input_name) {
            match send_clear_with_retries(
                client,
                "SetInputSettings",
                json!({
                    "inputName": input_name,
                    "inputSettings": { "text": "" },
                    "overlay": true
                }),
                /*accept_stream_inactive*/ false,
            )
            .await
            {
                Ok(()) => {
                    let mut diag = self.inner.diagnostics.lock().await;
                    diag.last_debug_text = Some(String::new());
                    diag.last_debug_input_name = Some(input_name);
                }
                Err(err) => {
                    self.inner
                        .log
                        .caption_send_failed(&format!("clear_debug_mirror: {err}"));
                    debug!(error = %err, input = %input_name, "obs clear debug mirror failed after retries");
                }
            }
        }
    }

    pub async fn apply_live_settings(&self) {
        bump_delayed_generation(&self.inner);
        bump_clear_generation(&self.inner);
        let settings = ObsCaptionSettings::from_config(&(self.config_getter)());
        if !settings.should_connect() {
            *self.inner.desired_connection.lock().await = false;
            drain_queue(&self.inner);
            self.clear_remote_outputs_if_possible(&settings).await;
            if let Some(task) = self.inner.connection_task.lock().await.take() {
                task.abort();
            }
            if let Some(client) = self.inner.client.lock().await.take() {
                client.close().await;
            }
            *self.inner.connection_key.lock().await = None;
            {
                let mut diag = self.inner.diagnostics.lock().await;
                diag.connected = false;
                diag.stream_output_active = None;
                diag.stream_output_reconnecting = None;
                diag.native_caption_status = None;
                diag.last_error = None;
            }
            set_connection_state(&self.inner, ConnectionState::Disabled, None).await;
            self.refresh_accepting_events();
            self.inner.log.live_settings_applied(
                settings.enabled,
                false,
                &settings.output_mode,
                false,
            );
            return;
        }

        let next_key = settings.connection_key();
        let mut connection_key = self.inner.connection_key.lock().await;
        let connection_key_changed = connection_key.as_ref() != Some(&next_key);
        if connection_key_changed {
            *connection_key = Some(next_key);
            if let Some(client) = self.inner.client.lock().await.take() {
                client.close().await;
            }
            {
                let mut diag = self.inner.diagnostics.lock().await;
                diag.connected = false;
            }
            set_connection_state(&self.inner, ConnectionState::Disconnected, None).await;
        }
        drop(connection_key);

        *self.inner.desired_connection.lock().await = true;
        self.refresh_accepting_events();
        self.inner.log.live_settings_applied(
            settings.enabled,
            true,
            &settings.output_mode,
            connection_key_changed,
        );
        ensure_connection_task(self.inner.clone()).await;
    }

    pub fn publish_source(&self, text: &str, is_final: bool) {
        if !self.is_accepting_events() {
            return;
        }
        if is_final {
            bump_delayed_generation(&self.inner);
            bump_clear_generation(&self.inner);
        }
        let item = if is_final {
            QueueItem::SourceFinal(text.to_string())
        } else {
            QueueItem::SourcePartial(text.to_string())
        };
        self.enqueue(item);
    }

    pub fn publish_payload(&self, payload: SubtitlePayloadEvent) {
        if !self.is_accepting_events() {
            return;
        }
        let settings = ObsCaptionSettings::from_config(&(self.config_getter)());
        let supersede = payload_will_supersede_caption(&self.inner, &settings, &payload);
        let draft = payload_has_sendable_translation_draft(&settings, &payload);
        if supersede {
            bump_delayed_generation(&self.inner);
            bump_clear_generation(&self.inner);
        } else if draft {
            // Bump before enqueue so an in-flight DelayedClear sleep cannot wipe the next phrase.
            bump_clear_generation(&self.inner);
        } else {
            // No new completed phrase / draft — skip sticky frames (including post-clear_after
            // republishes of the same text when avoid_duplicate_text is on).
            return;
        }
        self.enqueue(QueueItem::Payload(Box::new(payload)));
    }

    fn enqueue(&self, item: QueueItem) {
        if !self.inner.worker_running.load(Ordering::Relaxed) {
            return;
        }
        if matches!(&item, QueueItem::SourcePartial(_)) {
            drop_queued_partials(&self.inner);
        }
        if let QueueItem::Payload(payload) = &item {
            // Keep distinct completed finals in the queue (live_partial can finalize faster
            // than OBS WS). Only coalesce sticky republishes / draft-only frames.
            coalesce_queued_payloads(&self.inner, payload);
        }
        {
            let mut queue = self.inner.queue.lock().expect("obs queue lock");
            push_queue_item(&mut queue, item);
        }
        self.inner.queue_notify.notify_one();
    }
}

async fn ensure_connection_task(inner: Arc<Inner>) {
    let mut task_slot = inner.connection_task.lock().await;
    if task_slot.as_ref().is_some_and(|task| !task.is_finished()) {
        return;
    }
    let inner_clone = inner.clone();
    *task_slot = Some(tokio::spawn(async move {
        connection_loop(inner_clone).await;
    }));
}

async fn connection_loop(inner: Arc<Inner>) {
    let mut backoff = Duration::from_secs(1);
    loop {
        if !*inner.desired_connection.lock().await {
            break;
        }
        let settings = ObsCaptionSettings::from_config(&(inner.config_getter)());
        if !settings.should_connect() {
            set_connection_state(&inner, ConnectionState::Disabled, None).await;
            break;
        }

        if inner.client.lock().await.is_some() {
            let stream_inactive = {
                let diag = inner.diagnostics.lock().await;
                diag.stream_output_active == Some(false)
            };
            // Poll faster while waiting for the user to start streaming so partials resume quickly.
            let poll = if stream_inactive {
                Duration::from_secs(3)
            } else {
                Duration::from_secs(15)
            };
            tokio::time::sleep(poll).await;
            if !*inner.desired_connection.lock().await {
                break;
            }
            let settings = ObsCaptionSettings::from_config(&(inner.config_getter)());
            let mut client_guard = inner.client.lock().await;
            if let Some(client) = client_guard.as_mut() {
                if let Err(err) = client.ping().await {
                    let code = error_codes::error::CONNECTION_LOST;
                    let detail = err.to_string();
                    {
                        let mut diag = inner.diagnostics.lock().await;
                        diag.last_error = Some(code.into());
                        diag.connected = false;
                    }
                    inner.log.connection_lost(&detail);
                    set_connection_state(&inner, ConnectionState::Error, Some(code)).await;
                    drop(client_guard);
                    if let Some(client) = inner.client.lock().await.take() {
                        client.close().await;
                    }
                    inner.connected_notify.notify_waiters();
                    continue;
                }
                if let Err(err) = refresh_stream_status(&inner, client, &settings).await {
                    debug!(error = %err, "obs stream status refresh failed");
                }
            }
            continue;
        }

        set_connection_state(&inner, ConnectionState::Connecting, None).await;

        match ObsWsClient::connect(
            &settings.host,
            settings.port,
            &settings.password,
            settings.use_ssl,
        )
        .await
        {
            Ok(client) => {
                let (studio, ws_ver) = client.versions();
                {
                    let mut diag = inner.diagnostics.lock().await;
                    diag.connected = true;
                    diag.last_error = None;
                    diag.reconnect_attempt_count = 0;
                    diag.obs_studio_version = studio.map(str::to_string);
                    diag.obs_websocket_version = ws_ver.map(str::to_string);
                }
                set_connection_state(&inner, ConnectionState::Connected, None).await;
                *inner.connection_key.lock().await = Some(settings.connection_key());
                *inner.client.lock().await = Some(ObsClientHandle::WebSocket(Box::new(client)));
                inner.connected_notify.notify_waiters();
                backoff = Duration::from_secs(1);
                if let Some(client) = inner.client.lock().await.as_mut() {
                    let _ = refresh_stream_status(&inner, client, &settings).await;
                }
            }
            Err(ObsClientError::PasswordRequired) => {
                let code = error_codes::error::PASSWORD_REQUIRED;
                {
                    let mut diag = inner.diagnostics.lock().await;
                    diag.reconnect_attempt_count += 1;
                    diag.last_error = Some(code.into());
                    diag.connected = false;
                }
                set_connection_state(&inner, ConnectionState::AuthFailed, Some(code)).await;
                tokio::time::sleep(Duration::from_secs(5)).await;
            }
            Err(ObsClientError::AuthFailed) => {
                let code = error_codes::error::AUTH_FAILED;
                {
                    let mut diag = inner.diagnostics.lock().await;
                    diag.reconnect_attempt_count += 1;
                    diag.last_error = Some(code.into());
                    diag.connected = false;
                }
                set_connection_state(&inner, ConnectionState::AuthFailed, Some(code)).await;
                tokio::time::sleep(Duration::from_secs(5)).await;
            }
            Err(err) => {
                let code = error_codes::obs_client_error_code(&err);
                let attempt = {
                    let mut diag = inner.diagnostics.lock().await;
                    diag.reconnect_attempt_count += 1;
                    diag.last_error = Some(code.into());
                    diag.connected = false;
                    diag.reconnect_attempt_count
                };
                if code == error_codes::error::CONNECTION_REFUSED && attempt > 3 {
                    trace!(error = %err, code, attempt, "obs websocket connect failed");
                } else {
                    debug!(error = %err, code, attempt, "obs websocket connect failed");
                }
                set_connection_state(&inner, ConnectionState::Error, Some(code)).await;
                tokio::time::sleep(backoff).await;
                backoff = (backoff * 2).min(Duration::from_secs(10));
            }
        }
    }
}

async fn refresh_stream_status(
    inner: &Inner,
    client: &mut ObsClientHandle,
    settings: &ObsCaptionSettings,
) -> Result<(), ObsClientError> {
    if !settings.native_enabled() {
        let mut diag = inner.diagnostics.lock().await;
        diag.stream_output_active = None;
        diag.stream_output_reconnecting = None;
        return Ok(());
    }
    let response = client.send_request("GetStreamStatus", json!({})).await?;
    let output_active = response
        .get("outputActive")
        .and_then(|value| value.as_bool())
        .unwrap_or(false);
    let output_reconnecting = response
        .get("outputReconnecting")
        .and_then(|value| value.as_bool())
        .unwrap_or(false);
    let mut diag = inner.diagnostics.lock().await;
    diag.stream_output_active = Some(output_active);
    diag.stream_output_reconnecting = Some(output_reconnecting);
    diag.native_caption_status = Some(if output_active {
        if output_reconnecting {
            native_status::STREAM_ACTIVE_RECONNECTING.into()
        } else {
            native_status::STREAM_ACTIVE.into()
        }
    } else {
        native_status::STREAM_INACTIVE.into()
    });
    // Stream inactivity is readiness, not a connection failure — clear sticky 501 error.
    if output_active && diag.last_error.as_deref() == Some(error_codes::error::STREAM_NOT_RUNNING) {
        diag.last_error = None;
    }
    Ok(())
}

async fn worker_loop(inner: Arc<Inner>) {
    loop {
        let item = {
            let mut queue = inner.queue.lock().expect("obs queue lock");
            queue.pop_front()
        };
        let Some(item) = item else {
            inner.queue_notify.notified().await;
            continue;
        };
        if let Err(err) = process_item(inner.clone(), item).await {
            let mut diag = inner.diagnostics.lock().await;
            diag.last_error = Some(err);
        }
    }
}

async fn process_item(inner: Arc<Inner>, item: QueueItem) -> Result<(), String> {
    match item {
        QueueItem::DelayedSend {
            text,
            send_stream,
            mirror_debug,
            delay_ms,
            generation,
        } => {
            if delay_ms > 0 {
                tokio::time::sleep(Duration::from_millis(delay_ms)).await;
            }
            if inner.delayed_generation.load(Ordering::SeqCst) != generation {
                return Ok(());
            }
            let settings = ObsCaptionSettings::from_config(&(inner.config_getter)());
            send_text(
                inner.clone(),
                &text,
                &settings,
                send_stream,
                mirror_debug,
                false,
                true,
            )
            .await
        }
        QueueItem::DelayedClear {
            send_stream,
            mirror_debug,
            delay_ms,
            generation,
        } => {
            if delay_ms > 0 {
                tokio::time::sleep(Duration::from_millis(delay_ms)).await;
            }
            if inner.clear_generation.load(Ordering::SeqCst) != generation {
                return Ok(());
            }
            let settings = ObsCaptionSettings::from_config(&(inner.config_getter)());
            send_text(inner, "", &settings, send_stream, mirror_debug, true, false).await
        }
        QueueItem::SourcePartial(text) => handle_source_partial(inner.clone(), &text).await,
        QueueItem::SourceFinal(text) => handle_source_final(inner.clone(), &text).await,
        QueueItem::Payload(payload) => handle_payload(inner, *payload).await,
    }
}

async fn handle_source_partial(inner: Arc<Inner>, text: &str) -> Result<(), String> {
    let settings = ObsCaptionSettings::from_config(&(inner.config_getter)());
    let mode = settings.output_mode.as_str();
    let mut send_stream = settings.native_enabled() && mode == "source_live";
    if send_stream {
        let diag = inner.diagnostics.lock().await;
        if diag.stream_output_active == Some(false) {
            send_stream = false;
        }
    }
    let mirror_debug = settings.debug_text_input_enabled()
        && mode == "source_live"
        && settings.debug_send_partials;
    if !send_stream && !mirror_debug {
        return Ok(());
    }
    if send_stream && !settings.send_partials {
        send_stream = false;
    }
    if !send_stream && !mirror_debug {
        return Ok(());
    }
    let normalized = normalize_text(text);
    if normalized.is_empty() {
        return Ok(());
    }
    let previous = inner.last_partial_text.lock().await.clone();
    let elapsed_ms = inner
        .last_partial_sent
        .lock()
        .await
        .map(|instant| instant.elapsed().as_millis() as u64);
    if normalized == previous {
        return Ok(());
    }
    if should_throttle_partial_update(
        &previous,
        &normalized,
        elapsed_ms,
        settings.partial_throttle_ms,
        settings.min_partial_delta_chars,
    ) {
        inner
            .log
            .partial_throttled(normalized.chars().count(), elapsed_ms);
        return Ok(());
    }
    *inner.last_partial_text.lock().await = normalized.clone();
    *inner.last_partial_sent.lock().await = Some(Instant::now());
    send_text(
        inner,
        &normalized,
        &settings,
        send_stream,
        mirror_debug,
        !settings.avoid_duplicate_text,
        false,
    )
    .await
}

async fn handle_source_final(inner: Arc<Inner>, text: &str) -> Result<(), String> {
    let settings = ObsCaptionSettings::from_config(&(inner.config_getter)());
    let mode = settings.output_mode.as_str();
    let send_stream = settings.native_enabled() && SOURCE_EVENT_OUTPUT_MODES.contains(&mode);
    let mirror_debug =
        settings.debug_text_input_enabled() && SOURCE_EVENT_OUTPUT_MODES.contains(&mode);
    if !send_stream && !mirror_debug {
        return Ok(());
    }
    let normalized = normalize_text(text);
    if normalized.is_empty() {
        return Ok(());
    }
    *inner.last_partial_text.lock().await = String::new();
    *inner.last_partial_sent.lock().await = None;
    *inner
        .last_payload_signature
        .lock()
        .unwrap_or_else(|e| e.into_inner()) = None;
    schedule_final_send(inner, normalized, send_stream, mirror_debug).await?;
    Ok(())
}

async fn handle_payload(inner: Arc<Inner>, payload: SubtitlePayloadEvent) -> Result<(), String> {
    let settings = ObsCaptionSettings::from_config(&(inner.config_getter)());
    let mode = settings.output_mode.as_str();
    let send_stream = settings.native_enabled()
        && !matches!(mode, "disabled" | "source_live" | "source_final_only");
    let mirror_debug = settings.debug_text_input_enabled();
    if !send_stream && !mirror_debug {
        return Ok(());
    }

    // Live MT draft for the next phrase (optional). Must not preempt a completed final that
    // first appears in the same CompletedWithPartial payload — otherwise whole phrases are lost.
    let draft_normalized = if settings.send_translation_partials && mode.starts_with("translation_")
    {
        normalize_text(&select_payload_live_draft_text(&payload, mode))
    } else {
        String::new()
    };
    let has_live_draft = !draft_normalized.is_empty();

    if payload.completed_block_visible {
        let selected = select_payload_text(&payload, mode);
        let normalized = normalize_text(&selected);
        if !normalized.is_empty() {
            let caption_sequence = caption_sequence_for_completed(&payload);
            let signature = (caption_sequence, mode.to_string(), normalized.clone());
            let is_dup = if settings.avoid_duplicate_text {
                let last = inner
                    .last_payload_signature
                    .lock()
                    .unwrap_or_else(|e| e.into_inner());
                last.as_ref() == Some(&signature)
            } else {
                false
            };
            if is_dup {
                inner.log.send_skipped(
                    "payload_dedup",
                    json!({
                        "sequence": caption_sequence,
                        "output_mode": mode,
                    }),
                );
            } else {
                inner
                    .log
                    .payload_routed(caption_sequence, mode, normalized.chars().count());
                *inner
                    .last_payload_signature
                    .lock()
                    .unwrap_or_else(|e| e.into_inner()) = Some(signature);
                *inner.last_partial_text.lock().await = String::new();
                *inner.last_partial_sent.lock().await = None;
                if has_live_draft {
                    // Same-payload next-phrase draft: deliver the completed final immediately
                    // without clear_after / replace-delay so a deferred send cannot overwrite
                    // the growing draft that follows in this tick.
                    send_text(
                        inner.clone(),
                        &normalized,
                        &settings,
                        send_stream,
                        mirror_debug,
                        false,
                        false,
                    )
                    .await?;
                } else {
                    schedule_final_send(inner.clone(), normalized, send_stream, mirror_debug)
                        .await?;
                }
            }
        }
    }

    if has_live_draft {
        return handle_translation_partial(
            inner,
            &settings,
            mode,
            payload.sequence,
            &draft_normalized,
            send_stream,
            mirror_debug,
        )
        .await;
    }

    Ok(())
}

async fn handle_translation_partial(
    inner: Arc<Inner>,
    settings: &ObsCaptionSettings,
    mode: &str,
    sequence: u64,
    normalized: &str,
    mut send_stream: bool,
    mirror_debug_base: bool,
) -> Result<(), String> {
    if send_stream {
        let diag = inner.diagnostics.lock().await;
        if diag.stream_output_active == Some(false) {
            send_stream = false;
        }
    }
    let mirror_debug = mirror_debug_base && settings.debug_send_partials;
    if !send_stream && !mirror_debug {
        return Ok(());
    }
    let previous = inner.last_partial_text.lock().await.clone();
    let elapsed_ms = inner
        .last_partial_sent
        .lock()
        .await
        .map(|instant| instant.elapsed().as_millis() as u64);
    if normalized == previous {
        return Ok(());
    }
    if should_throttle_partial_update(
        &previous,
        normalized,
        elapsed_ms,
        settings.partial_throttle_ms,
        settings.min_partial_delta_chars,
    ) {
        inner
            .log
            .partial_throttled(normalized.chars().count(), elapsed_ms);
        return Ok(());
    }
    *inner.last_partial_text.lock().await = normalized.to_string();
    *inner.last_partial_sent.lock().await = Some(Instant::now());
    // Next-phrase live growth supersedes any pending clear_after from the previous final.
    bump_clear_generation(&inner);
    inner
        .log
        .payload_routed(sequence, mode, normalized.chars().count());
    send_text(
        inner,
        normalized,
        settings,
        send_stream,
        mirror_debug,
        !settings.avoid_duplicate_text,
        false,
    )
    .await
}

async fn send_text(
    inner: Arc<Inner>,
    text: &str,
    settings: &ObsCaptionSettings,
    send_stream_caption: bool,
    mirror_debug_text: bool,
    force: bool,
    schedule_clear_after: bool,
) -> Result<(), String> {
    let normalized = normalize_text(text);
    if !send_stream_caption && !mirror_debug_text {
        return Ok(());
    }

    let had_active = inner.client.lock().await.is_some();
    if !had_active && !wait_for_connection(&inner, settings, 3).await {
        {
            let mut diag = inner.diagnostics.lock().await;
            diag.last_send_used_active_connection = false;
            diag.last_send_waited_for_connection = true;
            if diag.last_error.is_none() {
                diag.last_error = Some(error_codes::error::NOT_CONNECTED.into());
            }
        }
        inner.log.send_skipped(
            "not_connected",
            json!({ "text_len": normalized.chars().count() }),
        );
        return Ok(());
    }

    let used_active_connection = had_active;
    let waited_for_connection = !had_active;
    {
        let mut diag = inner.diagnostics.lock().await;
        diag.last_send_used_active_connection = used_active_connection;
        diag.last_send_waited_for_connection = waited_for_connection;
    }

    let mut client_guard = inner.client.lock().await;
    let Some(client) = client_guard.as_mut() else {
        return Ok(());
    };

    let mut should_send_caption = send_stream_caption;
    let mut should_send_debug = mirror_debug_text && !settings.debug_input_name.trim().is_empty();

    if settings.avoid_duplicate_text && !force {
        let diag = inner.diagnostics.lock().await;
        if should_send_caption && diag.last_caption_text.as_deref() == Some(normalized.as_str()) {
            should_send_caption = false;
        }
        if should_send_debug
            && diag.last_debug_text.as_deref() == Some(normalized.as_str())
            && diag.last_debug_input_name.as_deref() == Some(settings.debug_input_name.as_str())
        {
            should_send_debug = false;
        }
    }

    if !should_send_caption && !should_send_debug {
        drop(client_guard);
        inner.log.send_skipped(
            "dedup",
            json!({
                "text_len": normalized.chars().count(),
                "send_stream": send_stream_caption,
                "mirror_debug": mirror_debug_text,
            }),
        );
        // Finals after an identical live-partial still need clear_after scheduling.
        if schedule_clear_after && !normalized.is_empty() {
            enqueue_clear(
                inner,
                send_stream_caption,
                mirror_debug_text,
                settings.clear_after_ms,
            );
        }
        return Ok(());
    }

    let mut debug_mirror_ok = false;
    if should_send_debug {
        match client
            .send_request(
                "SetInputSettings",
                json!({
                    "inputName": settings.debug_input_name,
                    "inputSettings": { "text": normalized },
                    "overlay": true
                }),
            )
            .await
        {
            Ok(_) => {
                {
                    let mut diag = inner.diagnostics.lock().await;
                    diag.last_debug_text = Some(normalized.clone());
                    diag.last_debug_input_name = Some(settings.debug_input_name.clone());
                }
                debug_mirror_ok = true;
                if !should_send_caption {
                    inner.log.debug_mirror_sent(normalized.chars().count());
                }
            }
            Err(err) => {
                // Never block native captions or tear down the WS for a missing/renamed text source.
                let detail = err.to_string();
                {
                    let mut diag = inner.diagnostics.lock().await;
                    diag.last_error = Some(error_codes::error::REQUEST_FAILED.into());
                }
                debug!(error = %detail, "obs debug mirror SetInputSettings failed");
                inner
                    .log
                    .caption_send_failed(&format!("debug_mirror: {detail}"));
            }
        }
    }

    if should_send_caption {
        match client
            .send_request("SendStreamCaption", json!({ "captionText": normalized }))
            .await
        {
            Ok(_) => {
                {
                    let mut diag = inner.diagnostics.lock().await;
                    diag.last_caption_text = Some(normalized.clone());
                    diag.last_caption_sent_at_utc = Some(utc_now_iso());
                    diag.stream_output_active = Some(true);
                    diag.stream_output_reconnecting = Some(false);
                    diag.native_caption_status = Some(native_status::STREAM_DELIVERED.into());
                    diag.last_error = None;
                }
                inner.log.caption_sent(
                    normalized.chars().count(),
                    true,
                    debug_mirror_ok,
                    used_active_connection,
                    waited_for_connection,
                );
                set_connection_state(&inner, ConnectionState::Connected, None).await;
            }
            Err(ObsClientError::RequestFailed {
                code: Some(501), ..
            }) => {
                // obs-websocket: output not active — keep connection; surface via native status only.
                let mut diag = inner.diagnostics.lock().await;
                diag.stream_output_active = Some(false);
                diag.stream_output_reconnecting = Some(false);
                diag.native_caption_status = Some(native_status::STREAM_NOT_RUNNING.into());
                if diag.last_error.as_deref() == Some(error_codes::error::STREAM_NOT_RUNNING) {
                    diag.last_error = None;
                }
                drop(diag);
                inner.log.stream_output_inactive();
                set_connection_state(&inner, ConnectionState::Connected, None).await;
                drop(client_guard);
                if mirror_debug_text && schedule_clear_after && !normalized.is_empty() {
                    enqueue_clear(inner, false, true, settings.clear_after_ms);
                }
                return Ok(());
            }
            Err(err) => {
                let code = error_codes::error::SEND_FAILED;
                let detail = err.to_string();
                {
                    let mut diag = inner.diagnostics.lock().await;
                    diag.last_error = Some(code.into());
                }
                inner.log.caption_send_failed(&detail);
                set_connection_state(&inner, ConnectionState::Error, Some(code)).await;
                drop(client_guard);
                if let Some(client) = inner.client.lock().await.take() {
                    client.close().await;
                }
                ensure_connection_task(inner.clone()).await;
                return Err(code.into());
            }
        }
    }

    drop(client_guard);
    if schedule_clear_after && !normalized.is_empty() {
        enqueue_clear(
            inner,
            should_send_caption,
            should_send_debug,
            settings.clear_after_ms,
        );
    }

    Ok(())
}

fn bump_delayed_generation(inner: &Inner) {
    inner.delayed_generation.fetch_add(1, Ordering::SeqCst);
}

fn bump_clear_generation(inner: &Inner) {
    inner.clear_generation.fetch_add(1, Ordering::SeqCst);
}

fn caption_sequence_for_completed(payload: &SubtitlePayloadEvent) -> u64 {
    // During completed_with_partial, payload.sequence is the active ASR partial. Dedup must
    // key the completed phrase itself or every partial tick re-queues the same caption.
    payload.completed_sequence.unwrap_or(payload.sequence)
}

fn payload_will_supersede_caption(
    inner: &Inner,
    settings: &ObsCaptionSettings,
    payload: &SubtitlePayloadEvent,
) -> bool {
    let mode = settings.output_mode.as_str();
    let send_stream = settings.native_enabled()
        && !matches!(mode, "disabled" | "source_live" | "source_final_only");
    let mirror_debug = settings.debug_text_input_enabled();
    if !send_stream && !mirror_debug {
        return false;
    }
    if !payload.completed_block_visible {
        return false;
    }
    let selected = select_payload_text(payload, mode);
    let normalized = normalize_text(&selected);
    if normalized.is_empty() {
        return false;
    }
    if settings.avoid_duplicate_text {
        let signature = (
            caption_sequence_for_completed(payload),
            mode.to_string(),
            normalized,
        );
        let last = inner
            .last_payload_signature
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        if last.as_ref() == Some(&signature) {
            return false;
        }
    }
    true
}

fn payload_has_sendable_translation_draft(
    settings: &ObsCaptionSettings,
    payload: &SubtitlePayloadEvent,
) -> bool {
    if !settings.send_translation_partials {
        return false;
    }
    let mode = settings.output_mode.as_str();
    if !mode.starts_with("translation_") {
        return false;
    }
    let send_stream = settings.native_enabled()
        && !matches!(mode, "disabled" | "source_live" | "source_final_only");
    let mirror_debug = settings.debug_text_input_enabled();
    if !send_stream && !mirror_debug {
        return false;
    }
    !normalize_text(&select_payload_live_draft_text(payload, mode)).is_empty()
}

async fn schedule_final_send(
    inner: Arc<Inner>,
    text: String,
    send_stream: bool,
    mirror_debug: bool,
) -> Result<(), String> {
    let settings = ObsCaptionSettings::from_config(&(inner.config_getter)());
    let delay_ms = settings.final_replace_delay_ms;
    if delay_ms == 0 {
        return send_text(
            inner,
            &text,
            &settings,
            send_stream,
            mirror_debug,
            false,
            true,
        )
        .await;
    }
    let generation = inner.delayed_generation.load(Ordering::SeqCst);
    enqueue_item(
        &inner,
        QueueItem::DelayedSend {
            text,
            send_stream,
            mirror_debug,
            delay_ms,
            generation,
        },
    );
    Ok(())
}

fn enqueue_clear(inner: Arc<Inner>, send_stream: bool, mirror_debug: bool, delay_ms: u64) {
    if delay_ms == 0 {
        return;
    }
    bump_clear_generation(&inner);
    let generation = inner.clear_generation.load(Ordering::SeqCst);
    enqueue_item(
        &inner,
        QueueItem::DelayedClear {
            send_stream,
            mirror_debug,
            delay_ms,
            generation,
        },
    );
}

fn enqueue_item(inner: &Inner, item: QueueItem) {
    if !inner.worker_running.load(Ordering::Relaxed) {
        return;
    }
    {
        let mut queue = inner.queue.lock().expect("obs queue lock");
        push_queue_item(&mut queue, item);
    }
    inner.queue_notify.notify_one();
}

fn drain_queue(inner: &Inner) {
    inner.queue.lock().expect("obs queue lock").clear();
}

fn drop_queued_partials(inner: &Inner) {
    let mut queue = inner.queue.lock().expect("obs queue lock");
    queue.retain(|item| !matches!(item, QueueItem::SourcePartial(_)));
}

fn coalesce_queued_payloads(inner: &Inner, incoming: &SubtitlePayloadEvent) {
    let settings = ObsCaptionSettings::from_config(&(inner.config_getter)());
    let mode = settings.output_mode.as_str();
    let incoming_seq = caption_sequence_for_completed(incoming);
    let incoming_final = normalize_text(&select_payload_text(incoming, mode));
    let incoming_draft = if settings.send_translation_partials {
        normalize_text(&select_payload_live_draft_text(incoming, mode))
    } else {
        String::new()
    };
    let incoming_draft_only = !incoming_draft.is_empty() && incoming_final.is_empty();

    let mut queue = inner.queue.lock().expect("obs queue lock");
    queue.retain(|entry| {
        let QueueItem::Payload(existing) = entry else {
            return true;
        };
        let existing_seq = caption_sequence_for_completed(existing);
        let existing_final = normalize_text(&select_payload_text(existing, mode));

        // Replace sticky republishes of the same completed phrase.
        if !incoming_final.is_empty() && existing_seq == incoming_seq {
            return false;
        }
        // Draft-only frames coalesce to the latest draft update.
        if incoming_draft_only && existing_final.is_empty() {
            return false;
        }
        // Preserve queued finals for other phrases.
        true
    });
}

async fn send_clear_with_retries(
    client: &mut ObsClientHandle,
    request_type: &str,
    request_data: Value,
    accept_stream_inactive: bool,
) -> Result<(), String> {
    let mut last_err = String::from("clear failed");
    for attempt in 1..=CLEAR_REMOTE_ATTEMPTS {
        match client
            .send_request(request_type, request_data.clone())
            .await
        {
            Ok(_) => return Ok(()),
            Err(ObsClientError::RequestFailed {
                code: Some(501), ..
            }) if accept_stream_inactive => {
                // Empty SendStreamCaption while not streaming — nothing visible to clear.
                return Ok(());
            }
            Err(err) => {
                last_err = err.to_string();
                if attempt < CLEAR_REMOTE_ATTEMPTS {
                    tokio::time::sleep(CLEAR_REMOTE_RETRY_DELAY).await;
                }
            }
        }
    }
    Err(last_err)
}

fn push_queue_item(queue: &mut VecDeque<QueueItem>, item: QueueItem) {
    if queue.len() >= QUEUE_MAX_SIZE {
        // Prefer dropping coalescable partials/payloads over DelayedClear (stale text risk).
        let drop_idx = queue
            .iter()
            .position(|entry| matches!(entry, QueueItem::SourcePartial(_)))
            .or_else(|| {
                queue
                    .iter()
                    .position(|entry| matches!(entry, QueueItem::Payload(_)))
            })
            .or_else(|| {
                if matches!(item, QueueItem::DelayedClear { .. }) {
                    queue
                        .iter()
                        .position(|entry| !matches!(entry, QueueItem::DelayedClear { .. }))
                } else {
                    queue
                        .iter()
                        .position(|entry| matches!(entry, QueueItem::DelayedSend { .. }))
                }
            });
        if let Some(idx) = drop_idx {
            queue.remove(idx);
        } else {
            queue.pop_front();
        }
    }
    queue.push_back(item);
}

async fn wait_for_connection(
    inner: &Arc<Inner>,
    settings: &ObsCaptionSettings,
    timeout_secs: u64,
) -> bool {
    if inner.client.lock().await.is_some() {
        return true;
    }
    if !settings.should_connect() {
        return false;
    }
    *inner.desired_connection.lock().await = true;
    ensure_connection_task(inner.clone()).await;
    let notified = inner.connected_notify.notified();
    tokio::pin!(notified);
    tokio::time::timeout(Duration::from_secs(timeout_secs), &mut notified)
        .await
        .is_ok()
        && inner.client.lock().await.is_some()
}

async fn set_connection_state(inner: &Inner, state: ConnectionState, error: Option<&str>) {
    let prev = {
        let mut diag = inner.diagnostics.lock().await;
        let prev = diag.connection_state;
        diag.connection_state = state;
        prev
    };
    if prev != state {
        inner.log.connection_state_changed(state, error);
    }
}

fn utc_now_iso() -> String {
    voicesub_types::utc_now_rfc3339()
}
