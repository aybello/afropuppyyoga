# AfroPuppyYoga brand specification

## Approved visual redesign — 3 November 2026

Mode: **Redesign · Overhaul visually; preserve behavior, content, assets, and architecture.** This specification implements the approved pink concepts and `/home/ubuntu/reviews/apy-pink-redesign-2026-11-03/redesign-contract.md`, not a new product direction.

The audience is public class guests and private-event organisers, plus APY staff and owners. The visual language is warm boutique-wellness editorial: ivory, espresso, authentic photography, restrained pink, fluid serif headings, and clean sans-serif controls. Narrative role: welcome and booking on public pages; clarity and task completion internally. Viewing distance: phone and laptop. Temperature: calm and warm. Capacity: normal scrolling, wrapping headings, accessible menus and horizontally scrollable tables; never hide content to force one screen.

Five dials: visual variance **6** (selective arched photography and editorial headings); motion **2** (state feedback, no decorative pulse); public density **4** (comfortable spacing); internal density **7** (compact tables and controls); asset dependence **9** (original APY logo and source photographs); brand fidelity **8** (existing fonts, voice, destinations and all technical contracts).

## Semantic palette

| Role | Value | Usage |
| --- | --- | --- |
| Ivory | `#FEFAF4` | Page backgrounds and public navigation from first paint |
| Espresso | `#34221D` | Primary copy, headings, labels on pink buttons |
| Primary pink | `#F29CB8` | Primary action fills, selected controls, restrained accents |
| Pink hover | `#EB8DAA` | Primary action hover |
| Accessible rose | `#B52F5A` | Small links, focus indicators and small accent text |
| Blush | `#FDE9EF` | Secondary surfaces and active tabs |
| Warm muted copy | `#71574F` | Secondary copy and helper text |
| Soft border | `#E8D8D0` | Panels, navigation and row separators |
| Input border | `#A58A81` | Discoverable controls on ivory/white |
| White | `#FFFFFF` | Form and table surfaces |
| Destructive | `#B42318` | Errors and destructive actions, white labels |

Measured WCAG contrast: espresso on primary pink **7.34:1**; accessible rose on ivory **5.74:1** and blush **5.14:1**; muted copy on ivory **6.35:1**. Primary pink is a fill, **not a small-text link color**. Preserve meaningful green/red/amber operational states; do not make all statuses pink. No purple, plum, burgundy brand treatment, no gradients, no recoloring of partner logos.

Legacy Tailwind names (`forest`, `forest-light`, `forest-dark`, `saffron`, `saffron-dark`, `terracotta`, `ivory`, `ivory-dark`, `espresso`) remain available as compatibility aliases. Their underlying colors now belong to the approved palette; new components should prefer semantic tokens.

## Typography, surfaces, and motion

Display: **Fraunces**, weight 400–600, editorial tracking and generous line height. Body and controls: **Plus Jakarta Sans**, body 16px, dense staff UI 14px. Existing `font-accent` is retained as a Fraunces italic-compatible alias rather than adding a third family. Headings wrap; no clipping or forced single-screen layouts.

Spacing follows an 8px rhythm. Controls use comfortable rounded corners, primary public CTAs are pills, panels are gently rounded with fine borders and minimal shadow. Tabs use a blush selected surface with espresso labels. Tables retain 14px text, clear headers, subtle dividers and horizontal scrolling. Mobile controls retain comfortable target heights. Motion is limited to short feedback transitions, with reduced-motion handling and no new animation dependency.

Reusable utilities: `apy-page`, `apy-eyebrow`, `apy-section`, `apy-heading`, `apy-panel`, `apy-hero-image`, `apy-link`, `apy-primary-action`, `apy-nav-link` and `apy-staff-ui`. Existing container, font, divider, grain and pulse selectors remain available for compatibility; decorative pulse is neutralized.

## Authentic asset inventory

- Original logo: `LOGO_URL` in `client/src/const.ts` → `https://files.manuscdn.com/user_upload_by_module/session_file/310519663446228701/pFRlGBKuUoljEWjn.png`. Used without circular cropping in public Navbar and Footer. Never redraw or replace it.
- Actual Kitchener class hero photograph: `/manus-storage/apy_kitchener_gallery_07_jun21_on_mat_172ef0af.jpg`. Used consistently by the React hero, initial HTML shell and preload. Actual source-photo fallback: `/manus-storage/apy_kitchener_gallery_02_oct24_portrait_7773eb35.jpg`. Other page photographs remain their existing source paths.
- Existing favicon and original social image assets stay unchanged.
- Approved visual reference only: `/home/ubuntu/outputs/apy-homepage-concept/apy-homepage-desktop-pink.png` and related pink page concepts. Do not embed concept-generated people or mockup photographs in the app.
- Partner logos, including LiftOff, remain their actual source assets and original colors.

No new image downloads, large local photograph batches, invented testimonials, sample staff, or fabricated availability are permitted.

## Protected contracts and recovery

Preserve all routes, aliases, home anchor IDs and deferred navigation; every current navigation label and destination; Luma embeds, booking URL attribution and CTA tracking; SEO/schema/analytics; legal/contact copy, prices/taxes/forms/order/validation/submission; auth, permissions, roles, employee and operational procedures; tRPC bindings and loading/empty/error states. APY continues to use its horizontal AdminNav: do not wire the unused generic DashboardLayout sidebar into APY pages.

Highest shared risk: changing primary fills can make old `text-primary` usage too light. Shared link variants use the accessible rose token; page owners should normalize old brand-text usage locally, not with broad global overrides.

Source baseline: `c5b037cf5f00001affe237fc50ca6e09f7784224`; rollback checkpoint `c5b037cf`; recovery branch `apy-before-pink-redesign-20261103`; bundle `/home/ubuntu/reviews/apy-pink-redesign-2026-11-03/pre-redesign-code.bundle`. Production database records are not part of this code recovery. No API, database, auth, server or external mutations are authorized.
