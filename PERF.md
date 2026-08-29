# APY Performance Measurements

## 2026-08-29 — APY HQ visible spinner investigation

| Probe | Result | Interpretation |
|---|---:|---|
| Local homepage (`127.0.0.1`) | 16 ms TTFB / 16 ms total | The local application shell is not inherently slow. |
| Public homepage | 2.9–3.6 s TTFB / 4.2–8.0 s total | Public request startup and/or static asset delivery adds material time. |
| Public successful lightweight tRPC request | 2.7–3.3 s TTFB | The public delay occurs before page-specific database work. |
| Employee Directory database plan | 19 rows, full scan + sort | With 19 records, this query is not a meaningful database bottleneck. |
| Employee Directory browser view | Still loading after 10 seconds | A persistent client-side query/render fault exists in addition to the public startup latency. |

**Next measurement:** trace the Employee Directory tRPC request and client error state, then correct the specific fault. No cache or index changes have been made without evidence.

An in-page same-origin probe of `staffAvailability.listEmployees` was started from the stalled live Employee Directory view to capture its exact response status and body without changing any APY data.

## 2026-08-29 — Public homepage resource observations

The public homepage rendered its hero copy and managed hero image, but its embedded upcoming-class section remained in a visible “Loading upcoming classes…” state. The initial page also requested a large partner-logo collection twice, with many external CloudFront or session-hosted images, creating avoidable network competition during first load. A browser resource-timing audit was initiated to identify the largest contributors before changing the public page.

### Resource timing result

The live resource audit identified the embedded Luma calendar as the dominant first-load delay: the Luma calendar embed took approximately **9.4 seconds**, the Luma checkout-button script approximately **3.4 seconds**, and the local Luma Calendar module approximately **1.3 seconds**. These live third-party assets are below the first screen but were competing during initial website load. The planned fix is to defer this live, uncached calendar until visitors approach the class section or request it; no Luma event data will be cached.

### Post-change verification

On a fresh local homepage load, the first screen rendered without initializing the Luma iframe or checkout script. When the calendar section was reached, the normal uncached Luma load began with its existing skeleton state. This removes the 9.4-second third-party calendar request from the visitor’s initial website load while preserving access to current Luma classes at the moment they are requested.

The first screen also contained a 22-logo marquee rendered twice for the seamless animation. Its off-screen duplicate images could compete with first paint despite not being visible. The first six logos remain high-priority for the visible marquee; the remaining and duplicated marks now use browser lazy loading and asynchronous decoding. Font resources are swap-loaded and the browser requested only the displayed font variants, so no font change is required for this pass.
