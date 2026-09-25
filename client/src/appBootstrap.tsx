import { createRoot } from "react-dom/client";
import App from "./App";
import { ClientDataProviders } from "./ClientDataProviders";

export function mount() {
  createRoot(document.getElementById("root")!).render(
    <ClientDataProviders>
      <App />
    </ClientDataProviders>
  );
}
