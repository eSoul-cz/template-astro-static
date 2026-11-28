// Static site WITHOUT a CMS (archetype A-static): one call of `astroPipeline` in static mode from the eSoul Jenkins libraries
// (`pipelines/vars/astroPipeline.txt`). It runs the checks of the Astro guideline in disposable containers (install, audit, lint,
// format, type check, unit tests, build, `pnpm verify`, Playwright, `esoul-guidelines check`), then on the deploy branches `deployStaticSite`: an atomic release
// into `releases/<id>` and the `current` link, checked on the live site and switched back on a mismatch (framework/astro/deployment.md,
// "Site without a CMS"). The build that is deployed is the one that was verified and tested.
// `esoul-guidelines check` runs by itself with the version recorded in `esoul-guidelines.lock` (stage `Guidelines check`; README, "Guidelines"):
// nothing to configure here.
//
// Replace the example values. Credentials (Jenkins): `scaleway_secret_key` (registry login for the test images) and `deploy_ssh`
// (SSH key of the deploy user).
@Library(['dockerHelpers', 'testing', 'deploy', 'pipelines']) _

astroPipeline(
    mode: 'static',
    nodeImage: 'node:26',
    env: [
        // Canonical origin baked into the build.
        SITE_URL: 'https://example-project.example.com',
        // `true` while the site is a protected preview (noindex everywhere, no sitemap); the launch step sets it to `false`.
        PUBLIC_NOINDEX: 'true',
    ],
    checks: [
        test: true,
        // Playwright specs against the built dist/ (desktop 1440 px and mobile 390 px). The image has to be the one whose Playwright
        // version equals `@playwright/test` in package.json (the browser builds must match): change both together.
        smoke: [enabled: true, image: 'mcr.microsoft.com/playwright:v1.65.1-noble'],
    ],
    deployBranches: ['main'],
    // Release root on the server (current/, releases/, shared/) and the SSH host.
    deployPath: '/data/apps/example-project/web',
    deployServer: 'localhost',
    sharedDirs: ['_astro'],
    // Switches back and fails the build when the live site does not serve the new release marker.
    verify: [url: 'https://example-project.example.com', cacheHeaders: true],

    // Addons add options of the pipeline here (a slot of the template; keep this line).
    // @esoul-slot pipeline-options
)
