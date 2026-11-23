import { defineConfig } from 'vitest/config';

// Unit tests of helpers and islands with logic (`pnpm test`). Browser specs live in e2e/ (`pnpm test:e2e`).
export default defineConfig({
    test: {
        include: ['src/**/*.test.ts'],
    },
});
