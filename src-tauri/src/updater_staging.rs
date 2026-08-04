//! Stage Tauri updater installers under the install/project root (not `%TEMP%`).
//!
//! `tauri-plugin-updater` writes via `std::env::temp_dir()`. We redirect `TEMP`/`TMP`
//! for this process before `downloadAndInstall`, then delete leftover staging dirs
//! on the next launch. The file must survive until NSIS finishes (app exits first),
//! so cleanup is deferred — never delete mid-install.

use std::ffi::OsString;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use tracing::{info, warn};

static PREV_TEMP_ENV: Mutex<Option<(Option<OsString>, Option<OsString>)>> = Mutex::new(None);

/// True for directories created by `tauri-plugin-updater` (`{app}-{ver}-updater-{rand}`).
pub fn is_updater_staging_dir_name(name: &str) -> bool {
    let lower = name.to_ascii_lowercase();
    lower.contains("-updater-")
}

/// True for installer files written inside those staging dirs.
pub fn is_updater_installer_file_name(name: &str) -> bool {
    let lower = name.to_ascii_lowercase();
    lower.ends_with("-installer.exe") || lower.ends_with("-installer.msi")
}

/// Remove leftover updater staging dirs/files under `project_root`.
/// Best-effort: locked files (installer still running) are skipped and retried later.
pub fn cleanup_updater_staging(project_root: &Path) -> usize {
    let mut removed = 0usize;
    let entries = match fs::read_dir(project_root) {
        Ok(entries) => entries,
        Err(err) => {
            warn!(
                target: "voicesub.updater",
                error = %err,
                path = %project_root.display(),
                "updater staging cleanup: cannot read project root"
            );
            return 0;
        }
    };

    for entry in entries.flatten() {
        let name = entry.file_name();
        let name_str = name.to_string_lossy();
        let path = entry.path();
        let Ok(file_type) = entry.file_type() else {
            continue;
        };

        if file_type.is_dir() && is_updater_staging_dir_name(&name_str) {
            match fs::remove_dir_all(&path) {
                Ok(()) => {
                    removed += 1;
                    info!(
                        target: "voicesub.updater",
                        path = %path.display(),
                        "removed leftover updater staging directory"
                    );
                }
                Err(err) => {
                    warn!(
                        target: "voicesub.updater",
                        error = %err,
                        path = %path.display(),
                        "updater staging dir still in use; will retry on next launch"
                    );
                }
            }
            continue;
        }

        // Orphan installer if a previous run left it at root (should be inside *-updater-*).
        if file_type.is_file() && is_updater_installer_file_name(&name_str) {
            match fs::remove_file(&path) {
                Ok(()) => {
                    removed += 1;
                    info!(
                        target: "voicesub.updater",
                        path = %path.display(),
                        "removed leftover updater installer"
                    );
                }
                Err(err) => {
                    warn!(
                        target: "voicesub.updater",
                        error = %err,
                        path = %path.display(),
                        "updater installer still in use; will retry on next launch"
                    );
                }
            }
        }
    }

    removed
}

/// Point process temp dir at project root so the updater stages the NSIS exe there.
pub fn prepare_updater_staging(project_root: &Path) -> Result<PathBuf, String> {
    if !project_root.exists() {
        return Err(format!(
            "project root does not exist: {}",
            project_root.display()
        ));
    }

    cleanup_updater_staging(project_root);

    let mut guard = PREV_TEMP_ENV
        .lock()
        .map_err(|_| "updater staging env lock poisoned".to_string())?;
    if guard.is_none() {
        *guard = Some((std::env::var_os("TEMP"), std::env::var_os("TMP")));
    }
    drop(guard);

    // SAFETY: called only from the dashboard update path on the main runtime;
    // no other threads in this process rely on TEMP/TMP during the brief staging window.
    unsafe {
        std::env::set_var("TEMP", project_root);
        std::env::set_var("TMP", project_root);
    }

    info!(
        target: "voicesub.updater",
        path = %project_root.display(),
        "updater download staging redirected to project root"
    );
    Ok(project_root.to_path_buf())
}

/// Restore prior TEMP/TMP and clean partial staging after a failed update attempt.
pub fn abort_updater_staging(project_root: &Path) {
    if let Ok(mut guard) = PREV_TEMP_ENV.lock() {
        if let Some((prev_temp, prev_tmp)) = guard.take() {
            // SAFETY: restores values captured in prepare_updater_staging; same single-threaded
            // update path constraints as prepare.
            unsafe {
                match prev_temp {
                    Some(value) => std::env::set_var("TEMP", value),
                    None => std::env::remove_var("TEMP"),
                }
                match prev_tmp {
                    Some(value) => std::env::set_var("TMP", value),
                    None => std::env::remove_var("TMP"),
                }
            }
        }
    }
    cleanup_updater_staging(project_root);
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn unique_temp_root() -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("time")
            .as_nanos();
        let dir = std::env::temp_dir().join(format!("voicesub-updater-staging-{nanos}"));
        fs::create_dir_all(&dir).expect("mkdir");
        dir
    }

    #[test]
    fn staging_dir_name_matches_tauri_prefix() {
        assert!(is_updater_staging_dir_name(
            "Kagevi Subtitles-0.6.3-updater-AbCdE"
        ));
        assert!(!is_updater_staging_dir_name("user-data"));
        assert!(!is_updater_staging_dir_name("bin"));
    }

    #[test]
    fn installer_file_name_matches_tauri_prefix() {
        assert!(is_updater_installer_file_name(
            "Kagevi Subtitles-0.6.3-installer.exe"
        ));
        assert!(!is_updater_installer_file_name(
            "Kagevi.Subtitles_0.6.3_x64-setup.exe"
        ));
    }

    #[test]
    fn cleanup_removes_only_updater_staging() {
        let root = unique_temp_root();
        let keep_dir = root.join("user-data");
        let keep_file = root.join("config-note.txt");
        let staging = root.join("Kagevi Subtitles-0.6.3-updater-xyz");
        let installer = staging.join("Kagevi Subtitles-0.6.3-installer.exe");
        let orphan = root.join("Kagevi Subtitles-0.6.2-installer.exe");

        fs::create_dir_all(&keep_dir).unwrap();
        fs::create_dir_all(&staging).unwrap();
        fs::write(&keep_file, b"keep").unwrap();
        fs::write(&installer, b"exe").unwrap();
        fs::write(&orphan, b"exe").unwrap();

        let removed = cleanup_updater_staging(&root);
        assert_eq!(removed, 2);
        assert!(keep_dir.is_dir());
        assert!(keep_file.is_file());
        assert!(!staging.exists());
        assert!(!orphan.exists());

        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn prepare_redirects_temp_and_abort_restores() {
        let root = unique_temp_root();
        let prev_temp = std::env::var_os("TEMP");
        let prev_tmp = std::env::var_os("TMP");

        prepare_updater_staging(&root).expect("prepare");
        assert_eq!(std::env::var_os("TEMP").as_deref(), Some(root.as_os_str()));
        assert_eq!(std::env::var_os("TMP").as_deref(), Some(root.as_os_str()));

        let staging = root.join("Kagevi Subtitles-0.6.3-updater-tmp");
        fs::create_dir_all(&staging).unwrap();
        fs::write(
            staging.join("Kagevi Subtitles-0.6.3-installer.exe"),
            b"partial",
        )
        .unwrap();

        abort_updater_staging(&root);
        assert!(!staging.exists());
        assert_eq!(std::env::var_os("TEMP"), prev_temp);
        assert_eq!(std::env::var_os("TMP"), prev_tmp);

        let _ = fs::remove_dir_all(&root);
    }
}
