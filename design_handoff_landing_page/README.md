# Handoff: ContrastMap Landing Page

## Overview
Marketing landing page for ContrastMap, a directory for finding sauna and cold-plunge studios, with a shop and editorial teaser. Goal: drive studio search, browse featured studios, and newsletter signup.

## About the Design Files
The bundled file (`ContrastMap-Landing.dc.html`) is a **design reference built in HTML** — a high-fidelity prototype showing exact look, copy, and layout. It is not production code to copy directly. Recreate it in the target codebase's existing framework/component library and patterns (or choose an appropriate framework if none exists yet).

## Fidelity
**High-fidelity.** Final colors, typography, spacing, and copy are locked. Icons and studio/product/article imagery are placeholders (striped blocks with monospace labels) — swap in real photography/illustration.

## Screens / Views

### 1. Nav
Sticky top bar, semi-transparent bone background with blur, bottom border. Left: circular split mark (Ember/Ice) + "ContrastMap" wordmark (Bricolage Grotesque 600, 1.3rem). Center: nav links "Find a studio", "Shop", "How it works", "Journal" (Bricolage Grotesque, 0.95rem, #334155, hover #0F172A). Right: pill button "List your studio" (1px solid #0F172A border, ink text).

### 2. Hero
Two-column grid (1.1fr / 0.9fr), ~76px top padding, max-width 1200px centered.
- Left: eyebrow ("Find your temperature", #EA580C, uppercase, letter-spacing .2em), H1 "Hot rooms and cold plunges, found in seconds." (Bricolage Grotesque 700, clamp(2.4rem,4.6vw,3.6rem)), italic Fraunces subhead (1.2rem, #334155), search bar (white pill container: city/zip text input + type select dropdown + orange "Search" button #F97316), trust row with gradient dot bullets ("500+ studios listed", "free to browse").
- Right: large (300px) split-circle brand mark with two floating info chips ("190°F sauna" orange dot, "39°F plunge" blue dot) positioned absolute top-right and bottom-left.

### 3. How it works
Centered header (eyebrow #0369A1 "How it works", H2 "Three steps to your next reset"). 3-column grid of cards (white, 1px #E7E1D8 border, 16px radius, centered text): circular icon badge (52px, tinted bg), step label, title, description. Steps: Search your area / Compare studios / Book your session.

### 4. Featured studios (id="studios")
Header row with title left, "Browse all studios →" link right. 3-column card grid: striped placeholder image (140px), studio name, city, tag chips. Sample studios: Northbound Sauna House (Portland), The Ice Room (Austin), Ember & Basin (Denver).

### 5. Benefits
Centered header ("Why contrast therapy" / "What hot-and-cold does for you"). 4-column grid, icon-in-circle + title + short description: Sharper focus, Faster recovery, Better sleep, Stress relief.

### 6. Shop teaser (id="shop")
Header row + "Visit the shop →" link. 3-column product cards: striped placeholder (160px), name, price. Sample products: Cedar Barrel Sauna ($3,400+), Home Cold Plunge Tub ($1,890+), Contrast Timer & Thermometer ($58).

### 7. Journal (id="journal")
Centered header ("From the journal" / "Stories & guides"). 3-column article cards: striped placeholder (130px), category tag (#EA580C uppercase), title, excerpt.

### 8. Newsletter
Full-bleed dark band (#0F172A). Centered: H2 "Get the cold email." (white), italic Fraunces subtext (#8595ab), email input + orange "Subscribe" button.

### 9. Footer
4-column grid: brand blurb + mark, Explore links, Company links, Legal links. Bottom bar: centered copyright, top border.

## Interactions & Behavior
- Nav links and hero/section CTAs are anchor links to in-page section ids (`#studios`, `#shop`, `#journal`, `#how`).
- All card hovers: subtle lift (translateY(-2px)) + shadow increase, 0.2s ease.
- Nav link hover: color darkens to ink.
- Buttons: background darkens on hover (#F97316 → #EA580C).
- No client-side search/filtering logic implemented yet — the search bar and dropdown are static inputs; wire up to real studio data/search endpoint.
- Newsletter form has no submit handler yet — wire to email capture service.
- Responsive breakpoints were not built into this static reference — grids are fixed-column; add responsive collapse (e.g. to 1 column) for mobile.

## State Management
- Search: city/zip text + studio-type select — needs state + submit handler to query/filter studio data.
- Newsletter: email input — needs state + submit handler.
- Studio/product/article data is currently hardcoded sample data — replace with real data source (CMS/API).

## Design Tokens

**Colors**
- Ember (hot/accent): `#F97316`, hover/dark `#EA580C`
- Ice (cold/accent): `#0EA5E9`, dark `#0369A1`
- Ink (text/dark bg): `#0F172A`
- Ink-2 (body text): `#334155`
- Muted (secondary text): `#64748B`
- Faint: `#94A3B8`
- Line (borders): `#E7E1D8`
- Bone (page bg): `#FAF7F2`
- Panel (subtle fill): `#F3EEE6`
- White: `#FFFFFF`
- Success green: `#16A34A`

**Typography**
- Display/UI: "Bricolage Grotesque" (weights 400–800), letter-spacing -.02em on headings
- Editorial/italic accents: "Fraunces" italic
- Scale: H1 clamp(2.4rem,4.6vw,3.6rem); H2 clamp(1.7rem,3vw,2.3rem); body 0.88–1rem; eyebrow 0.72rem uppercase, letter-spacing .2em

**Spacing / Radius**
- Card radius: 16px; pill/button radius: 999px/11px; section padding: 56px vertical, 40px horizontal; max content width: 1200px

**Shadows**
- Card: `0 6px 24px rgba(15,23,42,.07), 0 2px 6px rgba(15,23,42,.04)`
- Hover: `0 24px 60px -18px rgba(15,23,42,.22)`

## Assets
- Brand mark: inline SVG, circle clip with vertical Ember/Ice split and two translucent white circles (used in nav, hero, footer).
- All studio/product/article imagery are striped placeholder divs (`repeating-linear-gradient`) with monospace labels — need real photography or illustration.
- Icons (search, calendar/compare, checkmark, weather/temp, heart, moon, face) are hand-authored inline SVGs using simple stroke paths — fine to keep or swap for an icon library matching codebase conventions.

## Files
- `ContrastMap-Landing.dc.html` — full landing page design reference (self-contained, includes inline styles and Google Fonts links for Bricolage Grotesque + Fraunces).
