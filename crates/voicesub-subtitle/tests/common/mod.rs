use std::fs;
use std::path::PathBuf;

pub fn workspace_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .and_then(|p| p.parent())
        .expect("workspace root")
        .to_path_buf()
}

#[allow(dead_code)]
pub fn read_workspace_file(rel: &str) -> String {
    fs::read_to_string(workspace_root().join(rel)).unwrap_or_else(|e| {
        panic!("failed to read `{rel}`: {e}");
    })
}

/// Concatenate all `*.js` files under a workspace-relative directory (sorted).
/// Used for source contracts after the overlay renderer was split into ESM modules.
#[allow(dead_code)]
pub fn read_workspace_js_dir(rel_dir: &str) -> String {
    let dir = workspace_root().join(rel_dir);
    let mut paths: Vec<_> = fs::read_dir(&dir)
        .unwrap_or_else(|e| panic!("failed to read dir `{rel_dir}`: {e}"))
        .filter_map(|entry| entry.ok())
        .map(|entry| entry.path())
        .filter(|path| path.extension().and_then(|e| e.to_str()) == Some("js"))
        .collect();
    paths.sort();
    let mut out = String::new();
    for path in paths {
        let name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("unknown.js");
        out.push_str(&format!("\n// ----- {rel_dir}/{name} -----\n"));
        out.push_str(&fs::read_to_string(&path).unwrap_or_else(|e| {
            panic!("failed to read `{}`: {e}", path.display());
        }));
        out.push('\n');
    }
    assert!(!out.is_empty(), "no .js files under `{rel_dir}`");
    out
}

pub fn assert_contains(haystack: &str, needle: &str, context: &str) {
    assert!(
        haystack.contains(needle),
        "{context}: expected substring `{needle}`"
    );
}

#[allow(dead_code)]
pub fn assert_not_contains(haystack: &str, needle: &str, context: &str) {
    assert!(
        !haystack.contains(needle),
        "{context}: unexpected substring `{needle}`"
    );
}

#[allow(dead_code)]
pub fn count_innerhtml_wipe_statements(source: &str) -> usize {
    source
        .lines()
        .filter(|line| line.trim() == r#"container.innerHTML = "";"#)
        .count()
}

#[allow(dead_code)]
pub fn slice_from_function(source: &str, name: &str, max_len: usize) -> String {
    let markers = [
        format!("export function {name}"),
        format!("function {name}"),
    ];
    let index = markers
        .iter()
        .find_map(|marker| source.find(marker))
        .unwrap_or_else(|| panic!("function `{name}` not found"));
    source[index..index.saturating_add(max_len).min(source.len())].to_string()
}
