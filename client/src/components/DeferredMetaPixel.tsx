import { useMetaPixel } from "@/hooks/useMetaPixel";

/** Loads the marketing pixel only after the public home page is interactive. */
export default function DeferredMetaPixel() {
  useMetaPixel();
  return null;
}
