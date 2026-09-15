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
    }),
  ],
});
