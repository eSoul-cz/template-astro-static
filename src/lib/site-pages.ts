// The pages of the site that search engines and AI assistants should know: the one list that `llms.txt` and the
// sitemap `lastmod` are generated from (src/pages/llms.txt.ts, astro.config.mjs). Every indexable page is listed here;
// `pnpm verify` fails when a page of the build is missing from `llms.txt` or from the sitemap.
//
// `updatedAt` is the date the CONTENT of the page last changed (YYYY-MM-DD). Change it with the content and
// leave it alone otherwise: a rebuild must not touch the dates of unchanged pages. A page that must not be indexed
// (thank-you page, error pages) is not listed and carries `noindex` through the layout flag.
export interface SitePage {
    /** Site-relative path with a trailing slash (`/` for the home page). */
    path: string;
    title: string;
    description: string;
    updatedAt: string;
}

export const siteName = 'Example Site';
export const siteDescription = 'Static site starter with a sitemap, llms.txt and a verified build.';

export const sitePages: SitePage[] = [
    {
        path: '/',
        title: 'Home',
        description: 'Static site starter: layout, Tailwind, local fonts, sitemap, robots switch and llms.txt are already wired. Replace this page.',
        updatedAt: '2026-11-23',
    },
];

export function pageByPath(path: string): SitePage | undefined {
    const normalized = path.length > 1 ? `${path.replace(/\/+$/, '')}/` : '/';
    return sitePages.find((page) => page.path === normalized);
}
