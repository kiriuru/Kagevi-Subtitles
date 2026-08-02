// Shared subtitle style / overlay renderer constants.
const LINE_SLOT_NAMES = [
  "source",
  "translation_1",
  "translation_2",
  "translation_3",
  "translation_4",
];

// OBS Browser Source: above this length we hint the compositor to contain
// layout/paint. Animation policy is separate (see resolveFreshFragmentEffect).
const OVERLAY_DENSE_PARTIAL_CHARS = 200;
// OBS: animate only small per-frame deltas; large ASR bursts display instantly.
const OVERLAY_MAX_ANIMATED_DELTA_CHARS = 12;

const DEFAULT_BASE_STYLE = {
  font_family: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif',
  font_size_px: 30,
  font_weight: 700,
  fill_color: "#ffffff",
  stroke_color: "#000000",
  stroke_width_px: 2,
  shadow_color: "#000000",
  shadow_blur_px: 10,
  shadow_offset_x_px: 0,
  shadow_offset_y_px: 3,
  background_color: "#000000",
  background_opacity: 0,
  background_padding_x_px: 12,
  background_padding_y_px: 4,
  background_radius_px: 10,
  line_spacing_em: 1.15,
  letter_spacing_em: 0,
  text_align: "center",
  line_gap_px: 8,
  effect: "none",
};

export {
  LINE_SLOT_NAMES,
  OVERLAY_DENSE_PARTIAL_CHARS,
  OVERLAY_MAX_ANIMATED_DELTA_CHARS,
  DEFAULT_BASE_STYLE,
};
