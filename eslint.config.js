// @ts-check
import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import astro from 'eslint-plugin-astro';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Flat config: ESLint recommended + typescript-eslint + eslint-plugin-astro. Formatting is Prettier's job (`pnpm format`).
// A project with Vue islands adds `eslint-plugin-vue` (flat/recommended + vue-eslint-parser with the TypeScript parser).
export default defineConfig(
    globalIgnores(['.astro/', 'dist/', 'node_modules/', 'playwright-report/', 'test-results/']),
    js.configs.recommended,
    ...tseslint.configs.recommended,
    ...astro.configs.recommended,
    {
        rules: {
            '@typescript-eslint/no-explicit-any': 'error',
            '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
        },
    },
    {
        // Node scripts (build verification, e2e server, config files).
        files: ['**/*.mjs', 'e2e/**', 'scripts/**', 'eslint.config.js', 'playwright.config.ts'],
        languageOptions: { globals: globals.node },
    },
);
