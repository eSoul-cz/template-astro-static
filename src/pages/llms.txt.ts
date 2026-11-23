import type { APIRoute } from 'astro';

import { buildLlmsTxt } from '../lib/seo/llms';
import { siteDescription, siteName, sitePages } from '../lib/site-pages';

// /llms.txt: generated from src/lib/site-pages.ts, the same list that feeds the sitemap. With the staging gate
// (PUBLIC_NOINDEX=true) the file stays reachable but lists nothing.
export const GET: APIRoute = ({ site }) => {
    const noindex = import.meta.env.PUBLIC_NOINDEX === 'true';
    const origin = site ?? new URL('http://localhost:4321');
    const body = buildLlmsTxt({
        siteName,
        description: noindex ? null : siteDescription,
        pages: noindex ? [] : sitePages.map((page) => ({ url: new URL(page.path, origin).href, title: page.title, description: page.description })),
    });

    return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
