// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

const brand = process.env.BRAND || 'azul';
const site = brand === 'azul' ? 'https://autoescuelachillan.cl' : 'https://conductoreschillan.cl';

// https://astro.build/config
export default defineConfig({
  site: site,
  integrations: [sitemap()],
  outDir: `./dist/${brand}`,
});
