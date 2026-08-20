import {
  LINE_SLOT_NAMES,
  OVERLAY_DENSE_PARTIAL_CHARS,
  OVERLAY_MAX_ANIMATED_DELTA_CHARS,
  DEFAULT_BASE_STYLE,
} from "./constants.js";
import {
  buildStyleFromPreset,
  normalizeStyleConfig,
  normalizeBaseStyle,
  resolveEffectiveStyle,
} from "./style-model.js";
import { colorToRgba } from "./color.js";
import {
  buildOutlineTextShadow,
  buildCssVariables,
  effectClassName,
} from "./css-vars.js";
import { composeRenderRows, textAlignToJustify } from "./compose.js";
import {
  commonPrefixLength,
  classifyPartialTransition,
  mergeFreshIntoStatic,
  resolveFreshFragmentEffect,
  usesObsPaintPolicy,
  updateTransientSurfaceInPlace,
} from "./partials.js";
import {
  _shapeSignatureForRows,
  _shapeSignatureForEntry,
  _canFastPathFinalize,
  _finalizeTransientSurfaceInPlace,
  disposeRenderContainer,
} from "./render-state.js";
import { render } from "./render.js";
import {
  computeOverflowPx,
  allocateLineViewports,
  stepOverflowScroll,
  applyOverlayOverflow,
  applyOverlayFitToContainer,
  stopOverlayOverflowScroll,
} from "./fit-box.js";

window.SubtitleStyleRenderer = {
  LINE_SLOT_NAMES,
  OVERLAY_DENSE_PARTIAL_CHARS,
  OVERLAY_MAX_ANIMATED_DELTA_CHARS,
  DEFAULT_BASE_STYLE,
  buildStyleFromPreset,
  normalizeStyleConfig,
  normalizeBaseStyle,
  resolveEffectiveStyle,
  buildOutlineTextShadow,
  buildCssVariables,
  composeRenderRows,
  textAlignToJustify,
  effectClassName,
  colorToRgba,
  commonPrefixLength,
  classifyPartialTransition,
  mergeFreshIntoStatic,
  resolveFreshFragmentEffect,
  usesObsPaintPolicy,
  updateTransientSurfaceInPlace,
  _shapeSignatureForRows,
  _shapeSignatureForEntry,
  _canFastPathFinalize,
  _finalizeTransientSurfaceInPlace,
  disposeRenderContainer,
  render,
  computeOverflowPx,
  allocateLineViewports,
  stepOverflowScroll,
  applyOverlayOverflow,
  applyOverlayFitToContainer,
  stopOverlayOverflowScroll,
};
