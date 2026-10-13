// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  adapter: cloudflare(),
  output: 'static',
  site: 'https://www.contrastmap.com',
  integrations: [
    sitemap({
      filter: (page) => {
        const path = new URL(page).pathname;
        // Keep internal tool pages out of the sitemap.
        return !['/admin/', '/dashboard/', '/search/'].includes(path);
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
