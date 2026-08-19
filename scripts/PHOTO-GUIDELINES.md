# ContrastMap Photo Guidelines

## Minimum Standard
- At least 1 photo per listing
- Minimum 800x600px
- 16:9 aspect ratio preferred (landscape)
- JPEG or WebP format

## Sources (in order of preference)
1. **Business website** — Use `fetch-photos.mjs` to extract images from the listing's website homepage
2. **Google Places API** — If available, use Places Photo API (requires API key, check licensing)
3. **Owner-submitted** — When a listing is claimed, the owner can upload photos
4. **Stock photography** — Use as last resort placeholder; must be wellness-relevant

## Photo Guidelines
- Show the actual facility (plunge tub, sauna room, common area) when possible
- Avoid stock photos of generic water/sauna scenes unless no other option
- No people's faces without explicit consent (or use photos where faces are not visible)
- Maintain consistent aspect ratio across listings for grid layout
- File naming: `{listing-slug}-{n}.jpg` (e.g., `contrast-austin-tx-1.jpg`)

## Workflow
1. Run `node scripts/fetch-photos.mjs` to auto-extract from websites
2. Review extracted photos manually — remove logos, banners, or irrelevant images
3. For listings without websites, manually search and add photos
4. When a listing is claimed, allow owner to replace photos with their own

## Update Handling
- When a facility changes hours, adds a new amenity, or closes, check if photos need updating
- Re-run `fetch-photos.mjs` quarterly to catch website changes
- Owner-submitted photos always take priority over scraped photos
