import { createRoot } from "react-dom/client";
import { ClientDataProviders } from "./ClientDataProviders";
import Home from "./pages/Home";

export function mount() {
  createRoot(document.getElementById("root")!).render(
    <ClientDataProviders>
      <Home />
    </ClientDataProviders>
  );
}
