import { expect, test } from './fixtures';

// Runs in two projects: desktop 1440x900 and mobile 390x844.

test('home page renders with a title, one h1 and no horizontal scroll', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status()).toBe(200);

    await expect(page).toHaveTitle(/.+/);
    await expect(page.locator('h1')).toHaveCount(1);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, 'horizontal overflow in px').toBeLessThanOrEqual(0);
});

test('head carries canonical, robots and the page is not a placeholder', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
    await expect(page.locator('meta[name="robots"]')).toHaveCount(1);
    await expect(page.locator('body')).not.toContainText(/\bTODO\b/);
});

test('CSP meta tag is present and the page runs without console errors or violations', async ({ page }) => {
    const problems: string[] = [];
    page.on('console', (message) => {
        if (message.type() === 'error') problems.push(message.text());
    });
    page.on('pageerror', (error) => problems.push(error.message));
    await page.addInitScript(() => {
        document.addEventListener('securitypolicyviolation', (event) =>
            console.error(`CSP violation: ${event.violatedDirective} ${event.blockedURI}`),
        );
    });

    await page.goto('/');
    const csp = await page.locator('meta[http-equiv="content-security-policy"]').getAttribute('content');
    expect(csp).toContain("default-src 'self'");
    expect(csp).not.toMatch(/'unsafe-(inline|eval)'/);
    expect(problems).toEqual([]);
});

test('robots.txt answers and states the switch', async ({ request }) => {
    const response = await request.get('/robots.txt');
    expect(response.status()).toBe(200);
    expect(await response.text()).toContain('User-agent: *');
});

test('unknown page answers 404', async ({ request }) => {
    const response = await request.get('/this-page-does-not-exist/');
    expect(response.status()).toBe(404);
});
