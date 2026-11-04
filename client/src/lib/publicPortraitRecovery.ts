import type { SyntheticEvent } from "react";
import { nextPublicPortraitSource } from "@shared/publicPortraits";

export function recoverPublicPortrait(event: SyntheticEvent<HTMLImageElement>): void {
  const image = event.currentTarget;
  const recovery = nextPublicPortraitSource(image.getAttribute("src") ?? "");
  if (recovery) image.src = recovery;
}
