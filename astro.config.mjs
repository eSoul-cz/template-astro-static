// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { existsSync, readFileSync } from 'node:fs';

import { pageByPath } from './src/lib/site-pages';

// Process env wins over `.env`, so Jenkins / Docker build args need no file.
/** @returns {Record<string, string>} */
function readDotEnv() {
    /** @type {Record<string, string>} */
    const values = {};
    if (!existsSync('.env')) return values;
    for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) {
        const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
        if (match) values[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
    }
    return values;
}
const dotEnv = readDotEnv();
/** @param {string} key */
const env = (key) => process.env[key] || dotEnv[key];

const site = env('SITE_URL') || 'http://localhost:4321';
const noindex = env('PUBLIC_NOINDEX') === 'true';

// https://astro.build/config
export default defineConfig({
    site,
    trailingSlash: 'ignore',
    build: { format: 'directory' },
    // No Markdown in the site: nothing to highlight (Shiki inline styles clash with the CSP).
    markdown: { syntaxHighlight: false },

    // CSP in a <meta> tag of every page (script and style hashes are computed by the build).
    // `frame-ancestors` does not work in <meta>; the web server sets X-Frame-Options.
    security: {
        csp: {
            directives: [
                "default-src 'self'",
                "img-src 'self' data:",
                "font-src 'self'",
                "connect-src 'self'",
                "base-uri 'self'",
                "form-action 'self'",
                "object-src 'none'",
            ],
        },
    },

    // A staging site (PUBLIC_NOINDEX=true) must not advertise its pages: no sitemap. `lastmod` is the date the content of
    // the page last changed (src/lib/site-pages.ts); a page without an entry there has none, and `pnpm verify` fails.
    integrations: noindex
        ? []
        : [
              sitemap({
                  serialize(item) {
                      return { ...item, lastmod: pageByPath(new URL(item.url).pathname)?.updatedAt };
                  },
              }),
          ],

    // Local fonts keep the build hermetic (no Google Fonts). Files live in src/assets/fonts/, not in public/,
    // otherwise they would be copied to the output twice. Source Sans 3 is SIL OFL (see OFL.txt): replace it
    // with the project's own typeface.
    fonts: [
        {
            provider: fontProviders.local(),
            name: 'Source Sans 3',
            cssVariable: '--font-source-sans',
            fallbacks: ['system-ui', 'sans-serif'],
            options: {
                variants: [
                    { src: ['./src/assets/fonts/SourceSans3-Variable.woff2'], weight: '200 900', style: 'normal' },
                    { src: ['./src/assets/fonts/SourceSans3-Italic-Variable.woff2'], weight: '200 900', style: 'italic' },
                ],
            },
        },
    ],

    vite: {
        plugins: [tailwindcss()],
    },
});
