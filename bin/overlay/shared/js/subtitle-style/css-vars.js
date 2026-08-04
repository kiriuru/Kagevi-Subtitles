import { colorToRgba } from "./color.js";

/**
 * OBS/CEF-reliable text outline: multi-stop text-shadow ring.
 * `-webkit-text-stroke` alone often reads near-invisible at common caption sizes.
 */
export function buildOutlineTextShadow(widthPx, color) {
  const width = Math.max(0, Number(widthPx) || 0);
  if (width <= 0) {
    return "";
  }
  const strokeColor = String(color || "#000000").trim() || "#000000";
  const steps = width <= 1 ? 8 : width <= 2.5 ? 12 : 16;
  const parts = [];
  for (let i = 0; i < steps; i += 1) {
    const angle = (Math.PI * 2 * i) / steps;
    const x = (Math.cos(angle) * width).toFixed(2);
    const y = (Math.sin(angle) * width).toFixed(2);
    parts.push(`${x}px ${y}px 0 ${strokeColor}`);
  }
  return parts.join(", ");
}

export function buildCssVariables(roleStyle, scale) {
  const styleScale = Number.isFinite(scale) ? scale : 1;
  const rawStrokeWidth = Number(roleStyle.stroke_width_px);
  const scaledStrokeWidth = Number(
    Math.max(0, (Number.isFinite(rawStrokeWidth) ? rawStrokeWidth : 0) * styleScale).toFixed(2)
  );
  const shadowOffsetX = Number(roleStyle.shadow_offset_x_px);
  const shadowOffsetY = Number(roleStyle.shadow_offset_y_px);
  const shadowBlur = Number(roleStyle.shadow_blur_px);
  const ox = Number.isFinite(shadowOffsetX) ? shadowOffsetX : 0;
  const oy = Number.isFinite(shadowOffsetY) ? shadowOffsetY : 0;
  const blur = Number.isFinite(shadowBlur) ? Math.max(0, shadowBlur) : 0;
  // Hard drop shadows (blur 0 + offset) must still paint — blur-only gate hid them.
  const dropShadow = blur > 0 || ox !== 0 || oy !== 0
    ? `${ox}px ${oy}px ${blur}px ${colorToRgba(roleStyle.shadow_color, 100)}`
    : "";
  const outlineShadow = buildOutlineTextShadow(scaledStrokeWidth, roleStyle.stroke_color);
  const shadowParts = [outlineShadow, dropShadow].filter(Boolean);
  return {
    "--subtitle-font-family": roleStyle.font_family,
    "--subtitle-font-size": `${Math.max(12, Math.round(roleStyle.font_size_px * styleScale))}px`,
    "--subtitle-font-weight": String(roleStyle.font_weight),
    "--subtitle-fill": roleStyle.fill_color,
    // Keep webkit stroke as a light assist; visible outline comes from text-shadow ring.
    "--subtitle-stroke": scaledStrokeWidth > 0 ? roleStyle.stroke_color : "transparent",
    "--subtitle-stroke-width": scaledStrokeWidth > 0
      ? `${Math.max(0.35, scaledStrokeWidth * 0.55).toFixed(2)}px`
      : "0px",
    "--subtitle-shadow": shadowParts.length ? shadowParts.join(", ") : "none",
    "--subtitle-background": colorToRgba(roleStyle.background_color, roleStyle.background_opacity),
    "--subtitle-radius": `${Math.max(0, Math.round(roleStyle.background_radius_px * styleScale))}px`,
    "--subtitle-padding-x": `${Math.max(0, Math.round(roleStyle.background_padding_x_px * styleScale))}px`,
    "--subtitle-padding-y": `${Math.max(0, Math.round(roleStyle.background_padding_y_px * styleScale))}px`,
    "--subtitle-line-height": String(roleStyle.line_spacing_em),
    "--subtitle-letter-spacing": `${roleStyle.letter_spacing_em}em`,
    "--subtitle-text-align": roleStyle.text_align,
  };
}

export function effectClassName(effect) {
  const normalized = String(effect || "none").trim().toLowerCase().replace(/_/g, "-") || "none";
  return `effect-${normalized}`;
}

export function renderEntrySignature(entry) {
  return [
    entry.transient ? "partial" : "completed",
    entry.style_slot || "source",
    entry.kind || "source",
    entry.lang || "",
    entry.text || "",
  ].join("\u001f");
}

export function shouldAnimateEntry(entry, previousEntrySignatures) {
  if (entry.transient) {
    return false;
  }
  if (previousEntrySignatures.has(renderEntrySignature(entry))) {
    return false;
  }
  // Translation slots: entrance only on first paint of the slot. Draft → final,
  // late revise, or duplicate finals must not replay opacity/filter effects —
  // that re-blinks an already-visible line and looks like a broken font.
  if ((entry.kind || "source") === "translation") {
    const slot = entry.style_slot || "source";
    const kind = entry.kind || "source";
    const lang = entry.lang || "";
    for (const signature of previousEntrySignatures) {
      if (typeof signature !== "string") {
        continue;
      }
      // signature: partial|completed \u001f slot \u001f kind \u001f lang \u001f text
      const parts = signature.split("\u001f");
      if (
        parts.length >= 4
        && parts[1] === slot
        && parts[2] === kind
        && parts[3] === lang
      ) {
        return false;
      }
    }
  }
  return true;
}

export function applyStyleMap(element, styleMap) {
  Object.entries(styleMap).forEach(([key, value]) => {
    element.style.setProperty(key, value);
  });
}
