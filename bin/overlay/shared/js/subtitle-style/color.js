let _colorProbeEl = null;

// Minimal CSS Level 1/3 named colors for environments (e.g. jsdom) that leave
// getComputedStyle().color as the keyword instead of resolving to rgb().
const NAMED_CSS_COLORS = {
  black: { r: 0, g: 0, b: 0 },
  white: { r: 255, g: 255, b: 255 },
  red: { r: 255, g: 0, b: 0 },
  green: { r: 0, g: 128, b: 0 },
  blue: { r: 0, g: 0, b: 255 },
  transparent: null,
};

export function _parseRgbChannels(cssColor) {
  const match = String(cssColor || "").match(
    /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i
  );
  if (!match) {
    return null;
  }
  return {
    r: Math.round(Number(match[1])),
    g: Math.round(Number(match[2])),
    b: Math.round(Number(match[3])),
  };
}

export function _resolveCssColorChannels(color) {
  const key = String(color || "").trim().toLowerCase();
  if (Object.prototype.hasOwnProperty.call(NAMED_CSS_COLORS, key)) {
    return NAMED_CSS_COLORS[key];
  }
  if (typeof document === "undefined") {
    return null;
  }
  try {
    if (!_colorProbeEl) {
      _colorProbeEl = document.createElement("div");
      _colorProbeEl.setAttribute("aria-hidden", "true");
      _colorProbeEl.style.cssText =
        "position:absolute;left:-99999px;top:0;width:0;height:0;visibility:hidden;pointer-events:none;";
      (document.documentElement || document.body).appendChild(_colorProbeEl);
    }
    _colorProbeEl.style.color = "";
    _colorProbeEl.style.color = color;
    const computed = getComputedStyle(_colorProbeEl).color;
    const fromRgb = _parseRgbChannels(computed);
    if (fromRgb) {
      return fromRgb;
    }
    const computedKey = String(computed || "").trim().toLowerCase();
    if (Object.prototype.hasOwnProperty.call(NAMED_CSS_COLORS, computedKey)) {
      return NAMED_CSS_COLORS[computedKey];
    }
    return null;
  } catch (_error) {
    return null;
  }
}

export function colorToRgba(color, opacityPercent) {
  const normalized = String(color || "").trim();
  const alpha = Math.max(0, Math.min(1, Number(opacityPercent || 0) / 100));
  if (!normalized || alpha <= 0) {
    return "transparent";
  }
  // Accept "#rgb" / "#rrggbb" / "#rrggbbaa" and bare hex (legacy configs).
  const hexMatch = normalized.match(/^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/);
  if (hexMatch) {
    const hex = hexMatch[1];
    let r;
    let g;
    let b;
    let hexAlpha = 1;
    if (hex.length === 3) {
      r = Number.parseInt(`${hex[0]}${hex[0]}`, 16);
      g = Number.parseInt(`${hex[1]}${hex[1]}`, 16);
      b = Number.parseInt(`${hex[2]}${hex[2]}`, 16);
    } else {
      r = Number.parseInt(hex.slice(0, 2), 16);
      g = Number.parseInt(hex.slice(2, 4), 16);
      b = Number.parseInt(hex.slice(4, 6), 16);
      if (hex.length === 8) {
        hexAlpha = Number.parseInt(hex.slice(6, 8), 16) / 255;
      }
    }
    const combinedAlpha = Math.max(0, Math.min(1, hexAlpha * alpha));
    if (combinedAlpha <= 0) {
      return "transparent";
    }
    return `rgba(${r}, ${g}, ${b}, ${combinedAlpha.toFixed(2)})`;
  }

  const rgbMatch = normalized.match(
    /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i
  );
  if (rgbMatch) {
    const r = Math.round(Number(rgbMatch[1]));
    const g = Math.round(Number(rgbMatch[2]));
    const b = Math.round(Number(rgbMatch[3]));
    const baseAlpha = rgbMatch[4] !== undefined ? Number(rgbMatch[4]) : 1;
    const combinedAlpha = Math.max(0, Math.min(1, baseAlpha * alpha));
    if (combinedAlpha <= 0) {
      return "transparent";
    }
    return `rgba(${r}, ${g}, ${b}, ${combinedAlpha.toFixed(2)})`;
  }

  if (alpha >= 1) {
    return normalized;
  }
  const channels = _resolveCssColorChannels(normalized);
  if (!channels) {
    return "transparent";
  }
  if (!Number.isFinite(channels.r) || !Number.isFinite(channels.g) || !Number.isFinite(channels.b)) {
    return "transparent";
  }
  return `rgba(${channels.r}, ${channels.g}, ${channels.b}, ${alpha.toFixed(2)})`;
}
