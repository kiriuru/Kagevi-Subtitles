//! Lightweight EN/RU/JA heuristics: is the latest ASR draft a likely end of utterance?

/// Returns `true` when the draft looks unfinished (short mid-phrase pause should not finalize).
pub fn utterance_looks_incomplete(text: &str) -> bool {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return false;
    }

    let last = trimmed
        .chars()
        .next_back()
        .unwrap_or('\0');
    if matches!(
        last,
        '.' | '?' | '!' | '。' | '？' | '！' | '…' | ';' | '；'
    ) {
        // Ellipsis alone marks incompleteness; other terminals mark completion.
        if last == '…' || trimmed.ends_with("...") {
            return true;
        }
        return false;
    }

    if matches!(last, ',' | '、' | ':' | '：' | '-' | '—' | '–') {
        return true;
    }

    let lower = trimmed.to_lowercase();
    let last_token = last_token(&lower);
    if last_token.is_empty() {
        return false;
    }

    if INCOMPLETE_EN_TOKENS.contains(&last_token) || INCOMPLETE_RU_TOKENS.contains(&last_token) {
        return true;
    }

    if ends_with_ja_incomplete_particle(trimmed) {
        return true;
    }

    false
}

fn last_token(lower: &str) -> &str {
    lower
        .rsplit(|c: char| c.is_whitespace() || matches!(c, ',' | '.' | ';' | ':' | '!' | '?' | '、' | '。'))
        .find(|part| !part.is_empty())
        .unwrap_or("")
}

fn ends_with_ja_incomplete_particle(text: &str) -> bool {
    const PARTICLES: &[&str] = &[
        "は", "が", "を", "に", "で", "と", "も", "の", "へ", "や", "か", "て", "から", "けど",
        "けれど", "し", "たり", "って", "という", "ので", "のに",
    ];
    PARTICLES.iter().any(|p| text.ends_with(p))
}

const INCOMPLETE_EN_TOKENS: &[&str] = &[
    "a", "an", "the", "and", "or", "but", "if", "so", "to", "of", "in", "on", "at", "for",
    "with", "from", "by", "as", "into", "about", "like", "than", "that", "this", "these",
    "those", "my", "your", "our", "their", "his", "her", "its", "i", "we", "you", "they",
    "he", "she", "it", "am", "is", "are", "was", "were", "be", "been", "being", "have",
    "has", "had", "do", "does", "did", "will", "would", "can", "could", "should", "may",
    "might", "must", "gonna", "wanna", "because", "when", "while", "until", "unless",
];

const INCOMPLETE_RU_TOKENS: &[&str] = &[
    "и", "а", "но", "или", "что", "как", "если", "когда", "пока", "чтобы", "потому",
    "на", "в", "во", "с", "со", "к", "ко", "у", "о", "об", "от", "до", "за", "из", "по",
    "для", "без", "при", "про", "над", "под", "между", "через", "это", "этот", "эта",
    "эти", "мой", "моя", "мое", "наш", "ваш", "их", "его", "ее", "я", "мы", "ты", "вы",
    "он", "она", "они", "не", "ни", "бы", "ли", "же",
];

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn complete_on_terminals() {
        assert!(!utterance_looks_incomplete("Hello world."));
        assert!(!utterance_looks_incomplete("Готово!"));
        assert!(!utterance_looks_incomplete("終わりました。"));
        assert!(!utterance_looks_incomplete(""));
    }

    #[test]
    fn incomplete_on_connectors_and_pad() {
        assert!(utterance_looks_incomplete("I went to the"));
        assert!(utterance_looks_incomplete("привет и"));
        assert!(utterance_looks_incomplete("今日は"));
        assert!(utterance_looks_incomplete("wait..."));
        assert!(utterance_looks_incomplete("hmm,"));
    }
}
