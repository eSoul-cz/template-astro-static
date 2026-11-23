import type { APIRoute } from 'astro';

// All bots are allowed in production; `robots.txt` disallows only the application's own non-public paths (none on a plain
// static site) and names the sitemap. The staging switch PUBLIC_NOINDEX=true disallows everything. Keep the pages themselves
// reachable (crawlers must fetch them to see `noindex`), so a staging site is hidden by robots.txt + meta, and protected by
// whatever gate the web server adds.
const NON_PUBLIC_PATHS: string[] = [];

export const GET: APIRoute = ({ site }) => {
    const noindex = import.meta.env.PUBLIC_NOINDEX === 'true';
    const disallow = noindex ? ['/'] : NON_PUBLIC_PATHS;
    const lines = ['User-agent: *', ...(noindex ? [] : ['Allow: /']), ...disallow.map((path) => `Disallow: ${path}`), ''];
    if (!noindex && site) lines.push(`Sitemap: ${new URL('sitemap-index.xml', site).href}`, '');
    return new Response(lines.join('\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
