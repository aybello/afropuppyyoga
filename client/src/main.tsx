import "./index.css";

/**
 * The public home page has a lean bootstrap so a visitor does not download
 * staff portal, dashboard, or data-client code before seeing the booking CTA.
 */
const bootstrap = window.location.pathname === "/"
  ? import("./homeBootstrap")
  : import("./appBootstrap");

void bootstrap.then(({ mount }) => mount());
