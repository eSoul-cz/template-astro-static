<!-- esoul-guidelines:begin tools -->
# Project guidelines - Tools

This file lists the tools the project uses and how to run them.

## Versions

| Area            | Tool                                                          | Version / source                                  |
| --------------- | ------------------------------------------------------------- | ------------------------------------------------- |
| Runtime         | Node.js                                                       | 26 (`engines` in `package.json`, `.nvmrc`)        |
| Package manager | pnpm                                                          | 12 (latest release, `packageManager`)             |
| Framework       | Astro                                                         | 7 (`package.json` is authoritative)               |
| Styling         | Tailwind CSS 4 via `@tailwindcss/vite`                        | [frontend.md](frontend.md)                        |
| Islands         | Vue (React only by an ADR)                                    | [architecture.md](architecture.md#islands)        |
| Type checks     | `astro check`; plus `vue-tsc --noEmit` when the site has Vue islands | `tsconfig.json` (and the Vue tsconfig)     |
| Lint            | ESLint flat config (Astro and TypeScript rules, Vue rules only with Vue islands; `@typescript-eslint/no-explicit-any` on) | `eslint.config.js` |
| Format          | Prettier with the Astro plugin                                | `prettier.config.mjs`                             |
| Browser tests   | Playwright                                                    | `playwright.config.ts`, `e2e/`                    |
| Delivery        | static (`deployStaticSite`) or a `FROM scratch` image via Komodo, Jenkins | [deployment.md](deployment.md#delivery-paths) |

`package.json` and `pnpm-lock.yaml` are authoritative for versions. Use the Astro documentation for the installed major (the Astro Docs MCP when available) and check the installed source before concluding that a feature does not exist. Use the pinned pnpm from `packageManager`; where pnpm reads its settings is in [dependencies.md](dependencies.md#pnpm-repositories).

`tsc --noEmit` alone does not type-check `.vue` files; that is why a site with Vue islands adds `vue-tsc --noEmit` to `pnpm check`.

## Where tools run

- Run the Astro CLI through pnpm: **`pnpm astro ...`, never `npx`** (and no `npx` for any other CLI the project installs).
- Start the dev server with `pnpm dev`; an agent runs it in the background and stops it when done.
- Zod comes from `astro/zod`. Invalid HTML is a compile error; close every non-void element.
- Jenkins runs the same scripts as local development, in a Node 26 image ([Jenkins `Checks` stage](#jenkins-checks-stage)).
- Do not keep the working copy in a cloud-synchronised folder (OneDrive, iCloud, Dropbox): the synchroniser creates duplicate files such as `index 5.html`, which Astro turns into phantom routes. When the build behaves oddly, `rm -rf dist && pnpm build`.

## pnpm hardening

The install hardening (`minimumReleaseAge`, the `allowBuilds` allow-list, `pnpm audit` in CI with dated `auditConfig.ignoreGhsas`) holds for every pnpm repository and is stated in [dependencies.md](dependencies.md#install-hardening). `pnpm audit` runs in the [Checks stage](#jenkins-checks-stage). Adding a dependency needs approval ([workflow.md](workflow.md#repository-rules)).

## Read-only verification

```bash
pnpm audit          # known advisories (ignores documented in pnpm-workspace.yaml)
pnpm eslint         # ESLint, read-only
pnpm format:check   # Prettier, read-only
pnpm check          # astro check (+ vue-tsc --noEmit with Vue islands)
pnpm test           # Vitest for islands and helpers with logic, where the project has such tests
pnpm build          # astro build
pnpm verify         # checks the built dist/ (scripts/verify-dist.mjs)
pnpm test:e2e       # Playwright smoke and SEO specs at 1440 and 390 px
```

Run them before every push; Jenkins runs the same commands. They MUST NOT rewrite tracked files.

## Formatting and lint autofixes

`pnpm format` (Prettier `--write`) and `pnpm eslint:fix` (ESLint `--fix`) rewrite files. Run them deliberately, review the diff, then rerun the read-only checks. CI uses the read-only commands only.

## Jenkins `Checks` stage

The `Jenkinsfile` has a **`Checks` stage that is mandatory** and runs before any image is built or any file is deployed. It fails the build when any step fails:

1. `pnpm install --frozen-lockfile`, then `pnpm audit`;
2. `pnpm eslint` and `pnpm format:check`;
3. `pnpm check`: `astro check`, plus `vue-tsc --noEmit` when the site has Vue islands; then `pnpm test` (Vitest) where the project has Vitest tests;
4. `pnpm build`, then **`pnpm verify`**: the output is checked after the build, because Astro and its integrations only log many errors and still finish. Verification covers at least a title and canonical URL on every page, a Content-Security-Policy without `unsafe-inline` or `unsafe-eval` scripts, no internal addresses or `TODO` placeholders in the output, `robots.txt`, and a sitemap that lists exactly the indexable pages (none while `PUBLIC_NOINDEX=true`). A headless site (archetype `C-headless`) adds the **build provenance check**: the build writes the content export it was made from next to the build, and `pnpm verify` compares `dist/` with it (every page and media file of the export exists, nothing else does) ([content.md](content.md#c-headless-edited-in-a-separate-backend));
5. **Playwright smoke** against the built site (the template serves `dist/` with `e2e/serve.mjs`), at **1440x900 and 390x844**, failing on a console error, a failed request or a broken image;
6. **SEO spec**: every indexable route has a title and description within limits, one `h1`, a canonical URL, Open Graph tags and an image; the sitemap lists exactly the indexable routes; `robots.txt` and `llms.txt` exist ([seo.md](seo.md)).

## Playwright

- Configuration is in `playwright.config.ts`; specs live in `e2e/*.spec.ts`. The base URL comes from **`E2E_BASE_URL`**; without it the config serves the built `dist/` on **`E2E_PORT`** (default 4330) through `e2e/serve.mjs`. `E2E_BASE_URL` also points the read-only specs at a running or deployed site.
- CI defaults of the template stay: `forbidOnly` in CI, `retries: 1` in CI, `trace: 'retain-on-failure'` and `screenshot: 'only-on-failure'`, and `reuseExistingServer` only outside CI.
- Two projects match the design frames: `desktop` (1440x900) and `mobile` (390x844, touch).
- A spec that logs a console error fails, unless the test lists that error explicitly as expected.
- Wait for islands to hydrate before interacting with them.
- A test that changes content never runs against a deployed environment (`E2E_BASE_URL` pointing at it).
- Admin end-to-end tests (archetype `B-admin`) log in once in a setup project and never log out the shared session.

> Local additions go below this managed block. Content outside the block is preserved when the guidelines are synced.
<!-- esoul-guidelines:end tools -->
