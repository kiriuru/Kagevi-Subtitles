import { normalizeTranscriptText } from "./transcript-logic";

/** Close an overlap phrase after this much quiet (no interim/final). */
export const OVERLAP_PHRASE_COALESCE_MS = 1800;

/** Hard-cap joined overlap phrase before forcing a boundary. */
export const OVERLAP_PHRASE_MAX_CHARS = 450;

/**
 * Join Chrome overlap finals/partials across slot handoffs.
 * Handles common restart overlap where the new hypothesis repeats a suffix of the prior text.
 */
export function appendOverlapPhrase(prefix: string, next: string): string {
  const a = normalizeTranscriptText(prefix);
  const b = normalizeTranscriptText(next);
  if (!a) {
    return b;
  }
  if (!b) {
    return a;
  }
  if (b === a || b.startsWith(`${a} `) || b.startsWith(a)) {
    return b;
  }
  if (a.endsWith(b) || a.endsWith(` ${b}`)) {
    return a;
  }

  const aWords = a.split(" ");
  const bWords = b.split(" ");
  const max = Math.min(aWords.length, bWords.length);
  let overlap = 0;
  for (let n = max; n > 0; n -= 1) {
    if (aWords.slice(-n).join(" ") === bWords.slice(0, n).join(" ")) {
      overlap = n;
      break;
    }
  }
  if (overlap > 0) {
    return [...aWords, ...bWords.slice(overlap)].join(" ");
  }
  return `${a} ${b}`;
}

export function overlapDisplayText(prefix: string, live: string): string {
  return appendOverlapPhrase(prefix, live);
}

/**
 * Chrome often trims the *same* interim mid-utterance (trailing unfinished words).
 * Hold the longer display only for that case. Unrelated shorter rewrites must pass
 * through — otherwise a new phrase never replaces the old one (looks like skips)
 * while soft-join keeps accumulating forever.
 */
export function preferStableOverlapPartial(previous: string, candidate: string): string {
  const prev = normalizeTranscriptText(previous);
  const next = normalizeTranscriptText(candidate);
  if (!next) {
    return prev;
  }
  if (!prev) {
    return next;
  }
  if (next === prev || next.length >= prev.length) {
    return next;
  }
  // Same hypothesis trimmed from the end.
  if (prev.startsWith(next)) {
    if (prev.length - next.length <= 16) {
      return next;
    }
    return prev;
  }
  return next;
}
