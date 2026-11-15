import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://mabuonomo.github.io',
  output: 'static',
  markdown: {
    shikiConfig: {
      theme: 'github-dark',
      wrap: true,
    },
  },
});
