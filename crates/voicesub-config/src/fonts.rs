use std::path::Path;

use serde_json::{Value, json};

fn percent_encode_filename(input: &str) -> String {
    // Encode everything except RFC3986 "unreserved" characters.
    // This matches the intent of SST/Python `quote()` without pulling deps.
    fn is_unreserved(b: u8) -> bool {
        matches!(b, b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'.' | b'_' | b'~')
    }

    let mut out = String::new();
    for &b in input.as_bytes() {
        if is_unreserved(b) {
            out.push(b as char);
        } else {
            out.push_str(&format!("%{b:02X}"));
        }
    }
    out
}

fn project_font_family_name(path: &Path) -> String {
    let stem = path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or_default();

    // Normalize obvious separators.
    let normalized = stem.replace(['_', '-'], " ");
    let chars: Vec<char> = normalized.chars().collect();

    let mut out = String::new();
    for i in 0..chars.len() {
        let c = chars[i];
        if c == ' ' {
            out.push(' ');
            continue;
        }

        if i > 0 {
            let prev = chars[i - 1];
            let next = chars.get(i + 1).copied();

            let boundary = (c.is_ascii_uppercase() && prev.is_ascii_lowercase())
                || (c.is_ascii_uppercase()
                    && prev.is_ascii_uppercase()
                    && next.map(|n| n.is_ascii_lowercase()).unwrap_or(false))
                || (c.is_ascii_digit() && prev.is_ascii_lowercase())
                || (c.is_ascii_uppercase() && prev.is_ascii_digit());

            if boundary {
                out.push(' ');
            }
        }

        out.push(c);
    }

    out.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn font_extension_format(ext: &str) -> Option<&'static str> {
    match ext.to_ascii_lowercase().as_str() {
        "woff2" => Some("woff2"),
        "woff" => Some("woff"),
        "ttf" => Some("truetype"),
        "otf" => Some("opentype"),
        _ => None,
    }
}

/// Latin + common punctuation. Applied to shipped faces that have no Cyrillic
/// cmap so the browser skips them for Russian text and uses the next family
/// in the preset stack (Ubuntu Mono / PT Mono / Noto / Comfortaa / …).
const UNICODE_RANGE_LATIN: &str = "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD";

/// Latin + Japanese — for Mochiy Pop One (JP primary, Cyrillic via Comfortaa).
const UNICODE_RANGE_LATIN_JP: &str = "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+3040-30FF, U+31F0-31FF, U+3400-4DBF, U+4E00-9FFF, U+F900-FAFF, U+FF00-FFEF, U+FEFF, U+FFFD";

/// Latin + Simplified Chinese Han / CJK punctuation — ZCOOL XiaoWei.
/// Safe as a stack fallback: earlier Inter/Oswald still win for Latin codepoints.
const UNICODE_RANGE_LATIN_SC: &str = "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+3000-303F, U+3200-32FF, U+3400-4DBF, U+4E00-9FFF, U+F900-FAFF, U+FF00-FFEF, U+FEFF, U+FFFD";

/// Latin + Korean Hangul (+ jamo / compatibility) — Black Han Sans / Jua.
const UNICODE_RANGE_LATIN_KR: &str = "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+1100-11FF, U+3130-318F, U+3200-32FF, U+A960-A97F, U+AC00-D7AF, U+D7B0-D7FF, U+FF00-FFEF, U+FEFF, U+FFFD";
/// Shipped `bin/fonts` files with restricted unicode-range (verified offline).
fn unicode_range_for_font_filename(filename: &str) -> Option<&'static str> {
    let stem = filename
        .rsplit_once('.')
        .map(|(stem, _)| stem)
        .unwrap_or(filename);
    match stem {
        // Latin-only — Cyrillic falls through the stack.
        "Bangers-Regular"
        | "BigShouldersStencilDisplay-Regular"
        | "BlackOpsOne-Regular"
        | "Bungee-Regular"
        | "BungeeShade-Regular"
        | "CinzelDecorative-Bold"
        | "Creepster-Regular"
        | "GermaniaOne-Regular"
        | "Lato-Regular"
        | "Lobster-Regular"
        | "LondrinaSketch-Regular"
        | "MetalMania-Regular"
        | "Nosifer-Regular"
        | "Orbitron-Black"
        | "Orbitron-Regular"
        | "Oswald-Bold"
        | "Oswald-Regular"
        | "PermanentMarker-Regular"
        | "PixelOperator"
        | "PlayfairDisplay-Bold"
        | "PlayfairDisplay-Regular"
        | "Poppins-Bold"
        | "Poppins-Regular"
        | "ShareTechMono-Regular"
        | "SpecialElite-Regular"
        | "StardosStencil-Bold"
        | "VT323-Regular" => Some(UNICODE_RANGE_LATIN),
        // Japanese (+ Latin), no Cyrillic cmap.
        "Chokokutai-Regular"
        | "DotGothic16-Regular"
        | "HachiMaruPop-Regular"
        | "MochiyPopOne-Regular"
        | "NewTegomin-Regular"
        | "PottaOne-Regular"
        | "RocknRollOne-Regular"
        | "Stick-Regular"
        | "YuseiMagic-Regular"
        | "ZenMaruGothic-Bold" => Some(UNICODE_RANGE_LATIN_JP),
        // Simplified Chinese (+ Latin)
        "LiuJianMaoCao-Regular"
        | "MaShanZheng-Regular"
        | "ZCOOLKuaiLe-Regular"
        | "ZCOOLXiaoWei-Regular" => Some(UNICODE_RANGE_LATIN_SC),
        // Korean Hangul (+ Latin)
        "BlackHanSans-Regular"
        | "DoHyeon-Regular"
        | "Dokdo-Regular"
        | "Gaegu-Bold"
        | "Gugi-Regular"
        | "Jua-Regular"
        | "NanumBrushScript-Regular"
        | "PoorStory-Regular"
        | "SingleDay-Regular"
        | "SongMyung-Regular"
        | "YeonSung-Regular" => Some(UNICODE_RANGE_LATIN_KR),
        // Multi-script JP/Cyrillic and Latin+Cyrillic faces stay unrestricted.
        _ => None,
    }
}

/// Script tags shown in the font picker (`style.font.script.*` i18n keys).
fn scripts_for_font_filename(filename: &str) -> Vec<&'static str> {
    let stem = filename
        .rsplit_once('.')
        .map(|(stem, _)| stem)
        .unwrap_or(filename);
    match stem {
        "Bangers-Regular"
        | "BigShouldersStencilDisplay-Regular"
        | "BlackOpsOne-Regular"
        | "Bungee-Regular"
        | "BungeeShade-Regular"
        | "CinzelDecorative-Bold"
        | "Creepster-Regular"
        | "GermaniaOne-Regular"
        | "Lato-Regular"
        | "Lobster-Regular"
        | "LondrinaSketch-Regular"
        | "MetalMania-Regular"
        | "Nosifer-Regular"
        | "Orbitron-Black"
        | "Orbitron-Regular"
        | "Oswald-Bold"
        | "Oswald-Regular"
        | "PermanentMarker-Regular"
        | "PixelOperator"
        | "PlayfairDisplay-Bold"
        | "PlayfairDisplay-Regular"
        | "Poppins-Bold"
        | "Poppins-Regular"
        | "ShareTechMono-Regular"
        | "SpecialElite-Regular"
        | "StardosStencil-Bold"
        | "VT323-Regular" => vec!["latin"],
        // Pixel arcade faces with Cyrillic cmap (Press Start 2P ships full RU glyphs).
        "PressStart2P-Regular" => vec!["latin", "cyrillic"],
        "DelaGothicOne-Regular"
        | "RampartOne-Regular"
        | "ReggaeOne-Regular"
        | "TrainOne-Regular"
        | "Yomogi-Regular"
        | "ZenKurenaido-Regular"
        | "ZenOldMincho-Black" => vec!["latin", "cyrillic", "japanese"],
        "Chokokutai-Regular"
        | "DotGothic16-Regular"
        | "HachiMaruPop-Regular"
        | "MochiyPopOne-Regular"
        | "NewTegomin-Regular"
        | "PottaOne-Regular"
        | "RocknRollOne-Regular"
        | "Stick-Regular"
        | "YuseiMagic-Regular"
        | "ZenMaruGothic-Bold" => vec!["latin", "japanese"],
        "LiuJianMaoCao-Regular"
        | "MaShanZheng-Regular"
        | "ZCOOLKuaiLe-Regular"
        | "ZCOOLXiaoWei-Regular" => vec!["latin", "chinese"],
        "BlackHanSans-Regular"
        | "DoHyeon-Regular"
        | "Dokdo-Regular"
        | "Gaegu-Bold"
        | "Gugi-Regular"
        | "Jua-Regular"
        | "NanumBrushScript-Regular"
        | "PoorStory-Regular"
        | "SingleDay-Regular"
        | "SongMyung-Regular"
        | "YeonSung-Regular" => vec!["latin", "korean"],
        _ => vec!["latin", "cyrillic"],
    }
}


fn scripts_for_fallback_id(id: &str) -> Vec<&'static str> {
    match id {
        "fallback-yu-gothic-ui" | "fallback-biz-udpgothic" | "fallback-meiryo" | "fallback-ud-digi" => {
            vec!["latin", "japanese"]
        }
        "fallback-microsoft-yahei" => vec!["latin", "chinese"],
        "fallback-malgun-gothic" => vec!["latin", "korean"],
        _ => vec!["latin", "cyrillic"],
    }
}

/// Returns one catalog entry per project-local font file.
pub fn list_project_font_entries(project_fonts_dir: &Path) -> Vec<Value> {
    let _ = std::fs::create_dir_all(project_fonts_dir);

    let Ok(dir_entries) = std::fs::read_dir(project_fonts_dir) else {
        return Vec::new();
    };

    let mut files: Vec<std::path::PathBuf> = dir_entries
        .flatten()
        .map(|e| e.path())
        .filter(|p| p.is_file())
        .collect();

    files.sort_by_key(|p| {
        p.file_name()
            .and_then(|s| s.to_str())
            .unwrap_or_default()
            .to_ascii_lowercase()
    });

    let mut entries: Vec<Value> = Vec::new();
    for path in files {
        let Some(ext) = path.extension().and_then(|e| e.to_str()) else {
            continue;
        };
        let Some(format) = font_extension_format(ext) else {
            continue;
        };

        let Some(filename) = path.file_name().and_then(|n| n.to_str()) else {
            continue;
        };

        let stem = path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or(filename);
        let label = project_font_family_name(&path);
        let family = format!("\"{label}\"");
        let url = format!("/project-fonts/{}", percent_encode_filename(filename));
        let scripts = scripts_for_font_filename(filename);

        entries.push(json!({
            "id": format!("project-{}", stem.to_ascii_lowercase()),
            "label": label,
            "family": family,
            "source": "project_local",
            "url": url,
            "filename": filename,
            "format": format,
            "scripts": scripts,
        }));
    }

    entries
}

fn fallback_entry(id: &str, label: &str, family: &str) -> Value {
    json!({
        "id": id,
        "label": label,
        "family": family,
        "source": "fallback",
        "scripts": scripts_for_fallback_id(id),
    })
}

pub fn build_font_catalog(project_fonts_dir: &Path) -> Value {
    // Port of SST/Python `backend/core/font_catalog.py` fallback entries.
    let fallback = vec![
        fallback_entry(
            "fallback-segoe-ui",
            "Segoe UI",
            "\"Segoe UI\", Tahoma, Geneva, Verdana, sans-serif",
        ),
        fallback_entry(
            "fallback-yu-gothic-ui",
            "Yu Gothic UI",
            "\"Yu Gothic UI\", \"Yu Gothic\", Meiryo, sans-serif",
        ),
        fallback_entry(
            "fallback-biz-udpgothic",
            "BIZ UDPGothic",
            "\"BIZ UDPGothic\", \"Yu Gothic UI\", Meiryo, sans-serif",
        ),
        fallback_entry(
            "fallback-meiryo",
            "Meiryo",
            "\"Meiryo\", \"Yu Gothic UI\", sans-serif",
        ),
        fallback_entry(
            "fallback-microsoft-yahei",
            "Microsoft YaHei",
            "\"Microsoft YaHei\", \"Segoe UI\", sans-serif",
        ),
        fallback_entry(
            "fallback-malgun-gothic",
            "Malgun Gothic",
            "\"Malgun Gothic\", \"Segoe UI\", sans-serif",
        ),
        fallback_entry(
            "fallback-arial",
            "Arial",
            "Arial, \"Segoe UI\", sans-serif",
        ),
        fallback_entry(
            "fallback-verdana",
            "Verdana",
            "Verdana, \"Segoe UI\", sans-serif",
        ),
        fallback_entry(
            "fallback-trebuchet",
            "Trebuchet MS",
            "\"Trebuchet MS\", \"Segoe UI\", sans-serif",
        ),
        fallback_entry(
            "fallback-ud-digi",
            "UD Digi Kyokasho",
            "\"UD Digi Kyokasho NK-R\", \"Yu Gothic UI\", Meiryo, sans-serif",
        ),
    ];

    json!({
        "project_fonts_dir": project_fonts_dir.display().to_string(),
        "project_local": list_project_font_entries(project_fonts_dir),
        "fallback": fallback,
    })
}

/// Port of SST `build_project_fonts_stylesheet` (shared with catalog).
pub fn build_project_fonts_stylesheet(project_fonts_dir: &Path) -> String {
    let entries = list_project_font_entries(project_fonts_dir);
    if entries.is_empty() {
        return "/* No project-local fonts found in the fonts folder yet. */\n".into();
    }

    let mut rules = Vec::new();
    for entry in entries {
        let label = entry
            .get("label")
            .and_then(|v| v.as_str())
            .unwrap_or_default();
        let url = entry
            .get("url")
            .and_then(|v| v.as_str())
            .unwrap_or_default();
        let format = entry
            .get("format")
            .and_then(|v| v.as_str())
            .unwrap_or_default();
        let filename = entry
            .get("filename")
            .and_then(|v| v.as_str())
            .unwrap_or_default();
        let family = label.replace('"', "\\\"");
        let unicode_range = unicode_range_for_font_filename(filename)
            .map(|range| format!("\n  unicode-range: {range};"))
            .unwrap_or_default();

        rules.push(format!(
            "@font-face {{\n  font-family: \"{family}\";\n  src: url(\"{url}\") format(\"{format}\");\n  font-display: swap;{unicode_range}\n}}"
        ));
    }

    format!("{}\n", rules.join("\n\n"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empty_dir_returns_comment() {
        let dir = std::env::temp_dir().join(format!("voicesub-fonts-test-{}", std::process::id()));
        let _ = std::fs::create_dir_all(&dir);
        let css = build_project_fonts_stylesheet(&dir);
        assert!(css.contains("No project-local fonts"));
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn latin_only_faces_get_unicode_range_so_cyrillic_falls_through() {
        let dir =
            std::env::temp_dir().join(format!("voicesub-fonts-range-test-{}", std::process::id()));
        let _ = std::fs::create_dir_all(&dir);
        // Minimal valid-enough TTF is not required — stylesheet only needs the filename.
        let font_path = dir.join("VT323-Regular.ttf");
        std::fs::write(&font_path, b"unused").unwrap();
        let cyr_path = dir.join("UbuntuMono-Regular.ttf");
        std::fs::write(&cyr_path, b"unused").unwrap();

        let css = build_project_fonts_stylesheet(&dir);
        assert!(
            css.contains("font-family: \"VT323 Regular\""),
            "expected VT323 face in {css}"
        );
        assert!(
            css.contains("unicode-range:"),
            "VT323 must declare unicode-range so Cyrillic uses Ubuntu/PT Mono"
        );
        // Cyrillic-capable Ubuntu Mono must NOT be range-limited.
        let ubuntu_idx = css.find("font-family: \"Ubuntu Mono Regular\"").unwrap();
        let ubuntu_block_end = css[ubuntu_idx..].find('}').map(|i| ubuntu_idx + i).unwrap();
        let ubuntu_block = &css[ubuntu_idx..ubuntu_block_end];
        assert!(
            !ubuntu_block.contains("unicode-range"),
            "Ubuntu Mono must stay unrestricted for Cyrillic: {ubuntu_block}"
        );

        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn jetbrains_family_name_keeps_brand_split_from_filename() {
        let dir =
            std::env::temp_dir().join(format!("voicesub-fonts-jb-test-{}", std::process::id()));
        let _ = std::fs::create_dir_all(&dir);
        std::fs::write(dir.join("JetBrainsMono-Regular.ttf"), b"x").unwrap();
        let entries = list_project_font_entries(&dir);
        assert_eq!(entries[0]["label"], "Jet Brains Mono Regular");
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn cjk_faces_keep_latin_so_primary_selection_still_paints_ascii() {
        assert_eq!(
            unicode_range_for_font_filename("ZenMaruGothic-Bold.ttf"),
            Some(UNICODE_RANGE_LATIN_JP)
        );
        assert_eq!(
            unicode_range_for_font_filename("RocknRollOne-Regular.ttf"),
            Some(UNICODE_RANGE_LATIN_JP)
        );
        assert_eq!(
            unicode_range_for_font_filename("DotGothic16-Regular.ttf"),
            Some(UNICODE_RANGE_LATIN_JP)
        );
        assert_eq!(
            unicode_range_for_font_filename("YuseiMagic-Regular.ttf"),
            Some(UNICODE_RANGE_LATIN_JP)
        );
        assert_eq!(
            unicode_range_for_font_filename("NewTegomin-Regular.ttf"),
            Some(UNICODE_RANGE_LATIN_JP)
        );
        assert_eq!(
            unicode_range_for_font_filename("Chokokutai-Regular.ttf"),
            Some(UNICODE_RANGE_LATIN_JP)
        );
        // Anime-title faces with Cyrillic cmap stay unrestricted.
        assert_eq!(unicode_range_for_font_filename("DelaGothicOne-Regular.ttf"), None);
        assert_eq!(unicode_range_for_font_filename("RampartOne-Regular.ttf"), None);
        assert_eq!(unicode_range_for_font_filename("ReggaeOne-Regular.ttf"), None);
        assert_eq!(unicode_range_for_font_filename("TrainOne-Regular.ttf"), None);
        assert_eq!(unicode_range_for_font_filename("ZenOldMincho-Black.ttf"), None);
        assert_eq!(
            unicode_range_for_font_filename("ZCOOLXiaoWei-Regular.ttf"),
            Some(UNICODE_RANGE_LATIN_SC)
        );
        assert_eq!(
            unicode_range_for_font_filename("ZCOOLKuaiLe-Regular.ttf"),
            Some(UNICODE_RANGE_LATIN_SC)
        );
        assert_eq!(
            unicode_range_for_font_filename("MaShanZheng-Regular.ttf"),
            Some(UNICODE_RANGE_LATIN_SC)
        );
        assert_eq!(
            unicode_range_for_font_filename("LiuJianMaoCao-Regular.ttf"),
            Some(UNICODE_RANGE_LATIN_SC)
        );
        assert_eq!(
            unicode_range_for_font_filename("BlackHanSans-Regular.ttf"),
            Some(UNICODE_RANGE_LATIN_KR)
        );
        assert_eq!(
            unicode_range_for_font_filename("DoHyeon-Regular.ttf"),
            Some(UNICODE_RANGE_LATIN_KR)
        );
        assert_eq!(
            unicode_range_for_font_filename("Gaegu-Bold.ttf"),
            Some(UNICODE_RANGE_LATIN_KR)
        );
        // Latin included (safe as fallback: earlier Inter/Oswald still win for ASCII).
        assert!(UNICODE_RANGE_LATIN_JP.contains("U+0000-00FF"));
        assert!(UNICODE_RANGE_LATIN_SC.contains("U+0000-00FF"));
        assert!(UNICODE_RANGE_LATIN_KR.contains("U+0000-00FF"));
        // Still exclude Cyrillic blocks so RU falls through to Noto/Comfortaa/etc.
        assert!(!UNICODE_RANGE_LATIN_JP.contains("U+0400"));
        assert!(!UNICODE_RANGE_LATIN_SC.contains("U+0400"));
        assert!(!UNICODE_RANGE_LATIN_KR.contains("U+0400"));
    }

    #[test]
    fn creative_latin_only_faces_get_unicode_range() {
        for name in [
            "PixelOperator.ttf",
            "Lobster-Regular.ttf",
            "Bungee-Regular.ttf",
            "MetalMania-Regular.ttf",
            "Creepster-Regular.ttf",
            "BlackOpsOne-Regular.ttf",
            "GermaniaOne-Regular.ttf",
            "Nosifer-Regular.ttf",
            "LondrinaSketch-Regular.ttf",
            "BungeeShade-Regular.ttf",
            "StardosStencil-Bold.ttf",
            "PermanentMarker-Regular.ttf",
        ] {
            assert_eq!(
                unicode_range_for_font_filename(name),
                Some(UNICODE_RANGE_LATIN),
                "{name}"
            );
        }
        // Dual-script creative faces stay unrestricted for Cyrillic.
        for name in [
            "PressStart2P-Regular.ttf",
            "RussoOne-Regular.ttf",
            "Caveat-Bold.ttf",
            "Neucha-Regular.ttf",
            "YesevaOne-Regular.ttf",
            "Rubik-Regular.ttf",
            "RubikDirt-Regular.ttf",
            "RubikDistressed-Regular.ttf",
            "RubikSprayPaint-Regular.ttf",
            "RubikWetPaint-Regular.ttf",
            "Unbounded-Regular.ttf",
            "StalinistOne-Regular.ttf",
            "KellySlab-Regular.ttf",
            "PoiretOne-Regular.ttf",
            "RuslanDisplay-Regular.ttf",
            "DelaGothicOne-Regular.ttf",
            "RampartOne-Regular.ttf",
            "Yomogi-Regular.ttf",
            "ZenKurenaido-Regular.ttf",
        ] {
            assert_eq!(unicode_range_for_font_filename(name), None, "{name}");
        }
    }

    #[test]
    fn catalog_entries_expose_script_tags_for_picker_labels() {
        let dir =
            std::env::temp_dir().join(format!("voicesub-fonts-scripts-{}", std::process::id()));
        let _ = std::fs::create_dir_all(&dir);
        std::fs::write(dir.join("Oswald-Bold.ttf"), b"x").unwrap();
        std::fs::write(dir.join("NotoSans-Regular.ttf"), b"x").unwrap();
        std::fs::write(dir.join("ZenMaruGothic-Bold.ttf"), b"x").unwrap();
        std::fs::write(dir.join("ZCOOLXiaoWei-Regular.ttf"), b"x").unwrap();
        std::fs::write(dir.join("BlackHanSans-Regular.ttf"), b"x").unwrap();
        std::fs::write(dir.join("DoHyeon-Regular.ttf"), b"x").unwrap();
        std::fs::write(dir.join("RussoOne-Regular.ttf"), b"x").unwrap();
        std::fs::write(dir.join("PressStart2P-Regular.ttf"), b"x").unwrap();
        std::fs::write(dir.join("YuseiMagic-Regular.ttf"), b"x").unwrap();
        std::fs::write(dir.join("ZCOOLKuaiLe-Regular.ttf"), b"x").unwrap();
        std::fs::write(dir.join("DelaGothicOne-Regular.ttf"), b"x").unwrap();
        std::fs::write(dir.join("MetalMania-Regular.ttf"), b"x").unwrap();
        std::fs::write(dir.join("YeonSung-Regular.ttf"), b"x").unwrap();
        std::fs::write(dir.join("LiuJianMaoCao-Regular.ttf"), b"x").unwrap();

        let catalog = build_font_catalog(&dir);
        let project = catalog["project_local"].as_array().unwrap();
        let by_file = |name: &str| {
            project
                .iter()
                .find(|e| e["filename"] == name)
                .unwrap_or_else(|| panic!("missing {name}"))
                .clone()
        };
        assert_eq!(by_file("Oswald-Bold.ttf")["scripts"], json!(["latin"]));
        assert_eq!(
            by_file("NotoSans-Regular.ttf")["scripts"],
            json!(["latin", "cyrillic"])
        );
        assert_eq!(
            by_file("ZenMaruGothic-Bold.ttf")["scripts"],
            json!(["latin", "japanese"])
        );
        assert_eq!(
            by_file("ZCOOLXiaoWei-Regular.ttf")["scripts"],
            json!(["latin", "chinese"])
        );
        assert_eq!(
            by_file("BlackHanSans-Regular.ttf")["scripts"],
            json!(["latin", "korean"])
        );
        assert_eq!(
            by_file("DoHyeon-Regular.ttf")["scripts"],
            json!(["latin", "korean"])
        );
        assert_eq!(
            by_file("RussoOne-Regular.ttf")["scripts"],
            json!(["latin", "cyrillic"])
        );
        assert_eq!(
            by_file("PressStart2P-Regular.ttf")["scripts"],
            json!(["latin", "cyrillic"])
        );
        assert_eq!(
            by_file("YuseiMagic-Regular.ttf")["scripts"],
            json!(["latin", "japanese"])
        );
        assert_eq!(
            by_file("ZCOOLKuaiLe-Regular.ttf")["scripts"],
            json!(["latin", "chinese"])
        );
        assert_eq!(
            by_file("DelaGothicOne-Regular.ttf")["scripts"],
            json!(["latin", "cyrillic", "japanese"])
        );
        assert_eq!(
            by_file("MetalMania-Regular.ttf")["scripts"],
            json!(["latin"])
        );
        assert_eq!(
            by_file("YeonSung-Regular.ttf")["scripts"],
            json!(["latin", "korean"])
        );
        assert_eq!(
            by_file("LiuJianMaoCao-Regular.ttf")["scripts"],
            json!(["latin", "chinese"])
        );
        let yahei = catalog["fallback"]
            .as_array()
            .unwrap()
            .iter()
            .find(|e| e["id"] == "fallback-microsoft-yahei")
            .expect("YaHei fallback");
        assert_eq!(yahei["scripts"], json!(["latin", "chinese"]));
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn special_elite_is_latin_only_so_noir_cyrillic_uses_plex_mono() {
        assert_eq!(
            unicode_range_for_font_filename("SpecialElite-Regular.ttf"),
            Some(UNICODE_RANGE_LATIN)
        );
        assert_eq!(
            unicode_range_for_font_filename("IBMPlexMono-Medium.ttf"),
            None,
            "IBM Plex Mono must stay unrestricted for Cyrillic in Film Noir"
        );

        let dir =
            std::env::temp_dir().join(format!("voicesub-fonts-noir-test-{}", std::process::id()));
        let _ = std::fs::create_dir_all(&dir);
        std::fs::write(dir.join("SpecialElite-Regular.ttf"), b"x").unwrap();
        std::fs::write(dir.join("IBMPlexMono-Medium.ttf"), b"x").unwrap();
        let css = build_project_fonts_stylesheet(&dir);
        let elite_idx = css
            .find("font-family: \"Special Elite Regular\"")
            .expect("Special Elite face");
        let elite_end = css[elite_idx..].find('}').map(|i| elite_idx + i).unwrap();
        assert!(
            css[elite_idx..elite_end].contains("unicode-range:"),
            "Special Elite must declare unicode-range for dual-script Film Noir"
        );
        let plex_idx = css
            .find("font-family: \"IBM Plex Mono Medium\"")
            .expect("Plex face");
        let plex_end = css[plex_idx..].find('}').map(|i| plex_idx + i).unwrap();
        assert!(
            !css[plex_idx..plex_end].contains("unicode-range"),
            "Plex Mono must accept Cyrillic"
        );
        let _ = std::fs::remove_dir_all(dir);
    }
}
