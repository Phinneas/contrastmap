// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import sitemap from '@astrojs/sitemap';
import rehypeExternalLinks from 'rehype-external-links';

export default defineConfig({
  adapter: cloudflare(),
  output: 'static',
  site: 'https://www.contrastmap.com',
  markdown: {
    // Markdown-rendered pages (buyer-protection guides): external links open
    // in a new tab with safe rel attributes.
    rehypePlugins: [
      [rehypeExternalLinks, { target: '_blank', rel: ['noopener', 'noreferrer'] }],
    ],
  },
  integrations: [
    sitemap({
      filter: (page) => {
        const path = new URL(page).pathname;
        // Keep internal tool pages out of the sitemap.
        if (['/admin/', '/dashboard/', '/search/'].includes(path)) return false;
        // Amenity×city filter pages are noindexed (doorway pattern); keep them
        // out of the sitemap so the indexed footprint stays content-rich.
        if (/^\/(cold-plunge|infrared-sauna|traditional-sauna|contrast-therapy)\/.+/.test(path)) return false;
        return true;
      },
      // Truthful lastmod: only pages published/changed on 2026-10-13 carry a
      // date. Stamping every page would make Google discount the signal.
      serialize: (item) => {
        const path = new URL(item.url).pathname;
        if (path.startsWith('/learn/buyer-protection') || path === '/states/') {
          item.lastmod = '2026-10-13';
        }
        return item;
      },
    }),
  ],
});
