//! Prevent multi-GB Chrome profile growth in the isolated browser worker.
//!
//! Chrome 147+ may download Gemini Nano / Optimization Guide on-device models into
//! the worker `--user-data-dir`. VoiceSub blocks downloads via launch flags and prunes
//! known bloat directories before each worker spawn.
//!
//! Also clears unclean-exit markers left by `taskkill /F` so Chrome does not show the
//! "Restore pages?" / "Chrome didn't shut down correctly" bubble on every relaunch.

use std::path::Path;

use serde_json::{Value, json};
use tracing::{info, warn};

/// Profile subdirectories that may grow to gigabytes when Chrome AI / optimization
/// guide components are left enabled.
pub const BLOAT_PROFILE_SUBDIRS: &[&str] = &[
    "OptGuideOnDeviceModel",
    "optimization_guide_model_store",
    "OptGuideOnDeviceClassifierModel",
    "OnDeviceHeadSuggestModel",
];

/// Create the worker profile root, prune known bloat, and seed first-run preferences.
pub fn prepare_worker_profile_dir(profile_dir: &Path) -> std::io::Result<()> {
    std::fs::create_dir_all(profile_dir)?;
    let reclaimed = prune_bloat_subdirs(profile_dir);
    if reclaimed > 0 {
        info!(
            target: "voicesub.browser",
            profile = %profile_dir.display(),
            reclaimed_mb = reclaimed / (1024 * 1024),
            "reclaimed worker profile disk space"
        );
    }
    seed_initial_preferences(profile_dir)?;
    clear_unclean_exit_markers(profile_dir);
    Ok(())
}

/// Mark the previous Chrome session as a clean exit so the restore-pages bubble is not shown.
///
/// The browser worker is stopped with `taskkill /T /F`, which leaves `exit_type=Crashed` in
/// the isolated profile. Best-effort: failures are logged and ignored so launch still proceeds.
fn clear_unclean_exit_markers(profile_dir: &Path) {
    patch_preferences_exit_markers(&profile_dir.join("Default").join("Preferences"));
    patch_local_state_exit_markers(&profile_dir.join("Local State"));
}

fn patch_preferences_exit_markers(path: &Path) {
    if !path.is_file() {
        return;
    }
    let Ok(raw) = std::fs::read_to_string(path) else {
        return;
    };
    let Ok(mut value) = serde_json::from_str::<Value>(&raw) else {
        warn!(
            target: "voicesub.browser",
            path = %path.display(),
            "failed to parse Chrome Preferences; leaving unclean-exit markers unchanged"
        );
        return;
    };
    let Some(root) = value.as_object_mut() else {
        return;
    };
    // Legacy top-level keys (older Chromium builds).
    root.insert("exit_type".into(), json!("Normal"));
    root.insert("exited_cleanly".into(), json!(true));
    if let Some(profile) = root.get_mut("profile").and_then(|v| v.as_object_mut()) {
        profile.insert("exit_type".into(), json!("Normal"));
        profile.insert("exited_cleanly".into(), json!(true));
    }
    if let Err(err) = write_json_atomic(path, &value) {
        warn!(
            target: "voicesub.browser",
            path = %path.display(),
            error = %err,
            "failed to clear Chrome Preferences unclean-exit markers"
        );
    }
}

fn patch_local_state_exit_markers(path: &Path) {
    if !path.is_file() {
        return;
    }
    let Ok(raw) = std::fs::read_to_string(path) else {
        return;
    };
    let Ok(mut value) = serde_json::from_str::<Value>(&raw) else {
        warn!(
            target: "voicesub.browser",
            path = %path.display(),
            "failed to parse Chrome Local State; leaving unclean-exit markers unchanged"
        );
        return;
    };
    let Some(root) = value.as_object_mut() else {
        return;
    };
    root.insert("exited_cleanly".into(), json!(true));
    if let Some(profile) = root.get_mut("profile").and_then(|v| v.as_object_mut()) {
        profile.insert("exited_cleanly".into(), json!(true));
    }
    if let Err(err) = write_json_atomic(path, &value) {
        warn!(
            target: "voicesub.browser",
            path = %path.display(),
            error = %err,
            "failed to clear Chrome Local State unclean-exit markers"
        );
    }
}

fn write_json_atomic(path: &Path, value: &Value) -> std::io::Result<()> {
    let tmp = path.with_extension("voicesub-tmp");
    let content = serde_json::to_string(value)
        .map_err(|err| std::io::Error::new(std::io::ErrorKind::InvalidData, err))?;
    std::fs::write(&tmp, content)?;
    match std::fs::rename(&tmp, path) {
        Ok(()) => Ok(()),
        Err(_) => {
            let _ = std::fs::remove_file(path);
            std::fs::rename(&tmp, path)
        }
    }
}

fn prune_bloat_subdirs(profile_dir: &Path) -> u64 {
    let mut reclaimed = 0u64;
    for name in BLOAT_PROFILE_SUBDIRS {
        let path = profile_dir.join(name);
        if !path.exists() {
            continue;
        }
        let bytes = dir_size(&path).unwrap_or(0);
        match std::fs::remove_dir_all(&path) {
            Ok(()) => {
                reclaimed = reclaimed.saturating_add(bytes);
                info!(
                    target: "voicesub.browser",
                    path = %path.display(),
                    size_mb = bytes / (1024 * 1024),
                    "pruned worker profile bloat directory"
                );
            }
            Err(err) => {
                warn!(
                    target: "voicesub.browser",
                    path = %path.display(),
                    error = %err,
                    "failed to prune worker profile bloat directory"
                );
            }
        }
    }
    reclaimed
}

fn dir_size(path: &Path) -> std::io::Result<u64> {
    let mut total = 0u64;
    if path.is_file() {
        return Ok(path.metadata()?.len());
    }
    for entry in std::fs::read_dir(path)? {
        let entry = entry?;
        let entry_path = entry.path();
        if entry_path.is_dir() {
            total = total.saturating_add(dir_size(&entry_path)?);
        } else {
            total = total.saturating_add(entry.metadata()?.len());
        }
    }
    Ok(total)
}

fn seed_initial_preferences(profile_dir: &Path) -> std::io::Result<()> {
    let path = profile_dir.join("Initial Preferences");
    let content = r#"{
  "distribution": {
    "skip_first_run_ui": true,
    "import_bookmarks": false,
    "import_history": false,
    "import_home_page": false,
    "import_search_engine": false
  },
  "genai": {
    "local_foundational_model_settings": 1
  }
}"#;
    std::fs::write(path, content)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn prune_removes_known_bloat_subdirs() {
        let temp = tempfile::tempdir().expect("tempdir");
        let profile = temp.path();
        let bloat = profile.join("OptGuideOnDeviceModel").join("2026.1.1.1");
        std::fs::create_dir_all(&bloat).expect("mkdir");
        std::fs::write(bloat.join("weights.bin"), vec![0u8; 1024]).expect("write");
        std::fs::create_dir_all(profile.join("Default")).expect("default profile");

        let reclaimed = prune_bloat_subdirs(profile);
        assert!(reclaimed >= 1024);
        assert!(!profile.join("OptGuideOnDeviceModel").exists());
        assert!(profile.join("Default").exists());
    }

    #[test]
    fn prepare_creates_profile_and_initial_preferences() {
        let temp = tempfile::tempdir().expect("tempdir");
        let profile = temp.path().join("browser-worker-profile-classic-chrome");
        prepare_worker_profile_dir(&profile).expect("prepare");
        assert!(profile.is_dir());
        assert!(profile.join("Initial Preferences").is_file());
    }

    #[test]
    fn prepare_clears_unclean_exit_markers_from_preferences() {
        let temp = tempfile::tempdir().expect("tempdir");
        let profile = temp.path().join("browser-worker-profile-classic-chrome");
        let default_dir = profile.join("Default");
        std::fs::create_dir_all(&default_dir).expect("mkdir");
        std::fs::write(
            default_dir.join("Preferences"),
            r#"{"profile":{"exit_type":"Crashed","exited_cleanly":false},"exit_type":"Crashed"}"#,
        )
        .expect("write Preferences");
        std::fs::write(
            profile.join("Local State"),
            r#"{"exited_cleanly":false,"profile":{"exited_cleanly":false}}"#,
        )
        .expect("write Local State");

        prepare_worker_profile_dir(&profile).expect("prepare");

        let prefs: Value = serde_json::from_str(
            &std::fs::read_to_string(default_dir.join("Preferences")).expect("read prefs"),
        )
        .expect("parse prefs");
        assert_eq!(prefs["exit_type"], "Normal");
        assert_eq!(prefs["exited_cleanly"], true);
        assert_eq!(prefs["profile"]["exit_type"], "Normal");
        assert_eq!(prefs["profile"]["exited_cleanly"], true);

        let local: Value = serde_json::from_str(
            &std::fs::read_to_string(profile.join("Local State")).expect("read local"),
        )
        .expect("parse local");
        assert_eq!(local["exited_cleanly"], true);
        assert_eq!(local["profile"]["exited_cleanly"], true);
    }
}
