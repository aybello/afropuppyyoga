import { publicPortraitSources } from "./publicPortraits";

export const HERO_IMAGE_SOURCES = [
  ...publicPortraitSources("/manus-storage/apy_portrait_chow_cuddle_nov01_52f30f49.jpg"),
  ...publicPortraitSources("/manus-storage/apy_portrait_golden_cuddle_oct19_d7e4953e.jpg"),
] as const;
export const PRIMARY_HERO_IMAGE = HERO_IMAGE_SOURCES[0];
export const FALLBACK_HERO_IMAGE = HERO_IMAGE_SOURCES[1];

export function getNextHeroImageOnError(currentImage: string): string | null {
  const index = HERO_IMAGE_SOURCES.indexOf(currentImage);
  return index >= 0 ? HERO_IMAGE_SOURCES[index + 1] ?? null : null;
}

export type HeroImageState = { index: number; cycle: number; failed: boolean };
export type HeroImageAction =
  | { type: "error"; index: number; cycle: number }
  | { type: "retry" };
export const INITIAL_HERO_IMAGE_STATE: HeroImageState = { index: 0, cycle: 0, failed: false };

/** Events from an earlier image or retry cycle cannot exhaust the current one. */
export function heroImageReducer(state: HeroImageState, action: HeroImageAction): HeroImageState {
  if (action.type === "retry") {
    return state.failed ? { index: 0, cycle: state.cycle + 1, failed: false } : state;
  }
  if (state.failed || action.index !== state.index || action.cycle !== state.cycle) return state;
  return state.index < HERO_IMAGE_SOURCES.length - 1
    ? { ...state, index: state.index + 1 }
    : { ...state, failed: true };
}

export function heroImageSource(state: HeroImageState): string {
  const source = HERO_IMAGE_SOURCES[state.index];
  return state.cycle === 0 ? source : `${source}${source.includes("?") ? "&" : "?"}retry=${state.cycle}`;
}
