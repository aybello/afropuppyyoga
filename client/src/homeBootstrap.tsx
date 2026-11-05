import { createRoot } from "react-dom/client";
import { ClientDataProviders } from "./ClientDataProviders";
import Home from "./pages/Home";
import { heroImageStateFromShell } from "@shared/heroImage";

export function mount() {
  // Capture before createRoot replaces the first-paint shell. Ignore unknown URLs.
  const shellPhoto = document.getElementById("home-shell-photo");
  const initialHeroImageState = heroImageStateFromShell(
    shellPhoto?.getAttribute("src") ?? null,
    shellPhoto?.dataset.heroFailed === "true",
  );
  createRoot(document.getElementById("root")!).render(
    <ClientDataProviders>
      <Home initialHeroImageState={initialHeroImageState} />
    </ClientDataProviders>
  );
}
