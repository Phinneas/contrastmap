# ContrastMap Deployment Guide

## Prerequisites
1. Domain registered (contrastmap.com)
2. Mapbox token (set in .env as `PUBLIC_MAPBOX_TOKEN`)
3. Cloudflare account with Wrangler authenticated (`npx wrangler login`)

## Deploy to Cloudflare Workers

```bash
# Set environment variables
cp .env.example .env
# Edit .env and add your Mapbox token

# Build and deploy
npm run build
npx wrangler deploy
```

## Post-Deploy Checklist

### 1. Verify the site
- [ ] Visit https://contrastmap.com and confirm landing page loads
- [ ] Check that all 7 city pages load (/austin, /denver, /chicago, etc.)
- [ ] Verify listing detail pages load (click through from city pages)
- [ ] Confirm learn articles load (/learn/cold-plunge-vs-infrared-sauna, etc.)
- [ ] Check sitemap at https://contrastmap.com/sitemap-index.xml
- [ ] Verify Mapbox maps render (requires PUBLIC_MAPBOX_TOKEN in env)

### 2. Google Search Console
- [ ] Add contrastmap.com as a property in GSC
- [ ] Verify ownership (DNS TXT record or HTML file)
- [ ] Submit sitemap: https://contrastmap.com/sitemap-index.xml
- [ ] Request indexing for top 20 pages:
  - Homepage: /
  - 7 city pages: /austin, /denver, /chicago, /houston, /san-diego, /los-angeles, /new-york
  - 5 learn articles: /learn/cold-plunge-vs-infrared-sauna, /learn/contrast-therapy-101, /learn/cold-plunge-benefits, /learn/infrared-vs-traditional-sauna, /learn/cold-plunge-membership-vs-dropin
  - Top 7 listing pages (highest-rated Austin listings)

### 3. Bing Webmaster Tools
- [ ] Add contrastmap.com as a site
- [ ] Verify ownership
- [ ] Submit sitemap: https://contrastmap.com/sitemap-index.xml

### 4. Analytics
- [ ] Set up Google Analytics 4 property
- [ ] Add GA4 tracking code to Base.astro and Article.astro
- [ ] Set up conversion events: newsletter_signup, claim_listing_click, get_quote_click
- [ ] (Optional) Set up Plausible or Fathom as privacy-friendly supplement

### 5. Newsletter Provider
- [ ] Sign up for ConvertKit (Kit), Beehiiv, or Mailchimp
- [ ] Get API key and set as NEWSLETTER_API_KEY in Wrangler secrets
- [ ] Update src/pages/api/newsletter.ts to forward to provider
- [ ] Create welcome email sequence (3 emails):
  1. Welcome + top cities
  2. What is contrast therapy
  3. How to find facilities near you

### 6. Payment Processing (for Featured/Premium listings)
- [ ] Create Stripe account
- [ ] Set up products: Featured ($25/mo), Premium ($50/mo)
- [ ] Add Stripe payment links to list-your-studio.astro
- [ ] Set STRIPE_SECRET_KEY in Wrangler secrets

## Environment Variables

| Variable | Where | Purpose |
|----------|-------|---------|
| PUBLIC_MAPBOX_TOKEN | .env / Wrangler | Mapbox map rendering |
| NEWSLETTER_API_KEY | Wrangler secret | Newsletter provider API |
| STRIPE_SECRET_KEY | Wrangler secret | Payment processing |
| GA4_MEASUREMENT_ID | Wrangler secret | Google Analytics |

## Wrangler Secrets
```bash
npx wrangler secret put NEWSLETTER_API_KEY
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put GA4_MEASUREMENT_ID
```
