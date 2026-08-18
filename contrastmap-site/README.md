# ContrastMap — prototype site bundle

A working front-end prototype of ContrastMap, the cold plunge & infrared sauna directory.
Plain HTML/CSS/JS — the only tooling is Node, used to inject seed data into a template.

## Structure
- index.html              Built homepage (directory + shop + learn). Start here.
- index.template.html     Source template with data placeholders (__PROVIDERS__, __PRODUCTS__).
- build.js                Injects the JSON data into the template and writes index.html.
- providers.json          20 seeded studio listings (Austin, LA, NYC).
- catalog.json            30 seeded products (cold plunge tubs + infrared saunas).
- learn/                  SEO pillar articles:
    cold-plunge-vs-infrared-sauna.html
    contrast-therapy-101.html
- brand/brand-board.html  Naming + logo-direction reference.

## Run locally
Open index.html directly, or serve the folder:

    python3 -m http.server 8000
    # visit http://localhost:8000

## Rebuild after editing data or the template

    node build.js

Reads providers.json + catalog.json, injects them into index.template.html, writes index.html.
Featured (paid) studios and sponsored products are flagged near the top of build.js.

## Notes
- Brand: ContrastMap (contrastmap.com).
- Prototype only: forms don't submit to a backend, and studio/product data is gathered from
  public sources for demonstration. Verify everything before production use.
- Routes like /studios and /gear are the intended production URLs. In this static bundle the
  homepage nav uses in-page anchors and the Learn cards link to the local learn/*.html files.
- "View deal" links point to real brand sites (some may become affiliate links).

## Suggested next steps
- Recreate routes (/studios/[city], /gear/[product]) in your framework of choice.
- Add the interactive map view, the remaining SEO pillars (buyer's guides), and city landing
  pages per the SEO & content strategy.
