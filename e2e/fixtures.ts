import { test as base, expect } from '@playwright/test';

// Network guard (guidelines: framework/astro/testing.md): a catch-all route aborts every request to an origin other
// than the tested site. A spec that needs an external system answers it with its own `page.route(...)`; routes
// registered later win over this one, so explicit mocks keep working and an unrouted request fails the spec
// instead of making a real call.
export const test = base.extend({
    page: async ({ page, baseURL }, use) => {
        const own = new URL(baseURL ?? 'http://127.0.0.1').origin;
        await page.route('**/*', (route) => {
            const { origin, protocol } = new URL(route.request().url());
            return origin === own || protocol === 'data:' || protocol === 'blob:' ? route.fallback() : route.abort('blockedbyclient');
        });
        await use(page);
    },
});

export { expect };
