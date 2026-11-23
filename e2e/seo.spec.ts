import type { APIRequestContext } from '@playwright/test';

import { expect, test } from './fixtures';

// SEO spec (guidelines: framework/astro/tools.md, Checks step 6). Every indexable route of the sitemap has a title and
// description within the limits, one h1, a canonical URL, Open Graph tags and an image; robots.txt and llms.txt
// exist. `pnpm verify` compares the sitemap with the pages of the build (exact set); this spec reads the routes from
// the sitemap, so it also runs against a deployed site (E2E_BASE_URL).
test.skip(process.env.PUBLIC_NOINDEX === 'true', 'A protected preview publishes no sitemap.');

async function sitemapRoutes(request: APIRequestContext): Promise<string[]> {
    const locs = async (path: string) => {
        const response = await request.get(path);
        expect(response.status(), path).toBe(200);
        return [...(await response.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
    };

    const routes: string[] = [];
    for (const sitemap of await locs('/sitemap-index.xml')) routes.push(...(await locs(new URL(sitemap).pathname)));
    return routes.map((loc) => new URL(loc).pathname);
}

test('robots.txt allows crawling, names the sitemap and llms.txt lists the indexable pages', async ({ request }) => {
    const robots = await (await request.get('/robots.txt')).text();
    expect(robots).toContain('Allow: /');
    expect(robots).toMatch(/^Sitemap: .+sitemap-index\.xml$/m);

    const response = await request.get('/llms.txt');
    expect(response.status()).toBe(200);
    const llms = await response.text();
    expect(llms).toMatch(/^# .+/);
    for (const route of await sitemapRoutes(request)) expect(llms, `llms.txt lists ${route}`).toContain(route);
});

test('every sitemap route is an indexable page with complete meta data', async ({ page, request }) => {
    const routes = await sitemapRoutes(request);
    expect(routes.length).toBeGreaterThan(0);

    for (const route of routes) {
        const response = await page.goto(route);
        expect(response?.status(), route).toBe(200);

        const title = await page.title();
        expect(title.length, `${route} title "${title}"`).toBeGreaterThan(0);
        expect(title.length, `${route} title "${title}"`).toBeLessThanOrEqual(60);

        const description = (await page.locator('meta[name="description"]').getAttribute('content')) ?? '';
        expect(description.length, `${route} description`).toBeGreaterThanOrEqual(110);
        expect(description.length, `${route} description`).toBeLessThanOrEqual(155);

        await expect(page.locator('h1'), `${route} h1`).toHaveCount(1);
        await expect(page.locator('meta[name="robots"]'), route).toHaveAttribute('content', /^index/);

        const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
        expect(new URL(canonical ?? '').pathname, `${route} canonical`).toBe(route);

        for (const property of ['og:title', 'og:description', 'og:type', 'og:url', 'og:image']) {
            await expect(page.locator(`meta[property="${property}"]`), `${route} ${property}`).toHaveCount(1);
        }
        await expect(page.locator('meta[name="twitter:card"]'), route).toHaveAttribute('content', 'summary_large_image');
        expect(new URL((await page.locator('meta[property="og:url"]').getAttribute('content')) ?? '').pathname, `${route} og:url`).toBe(route);

        const image = await page.locator('meta[property="og:image"]').getAttribute('content');
        const imageResponse = await request.get(new URL(image ?? '').pathname);
        expect(imageResponse.status(), `${route} og:image ${image}`).toBe(200);
    }
});
