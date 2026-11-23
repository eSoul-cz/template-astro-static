# Site

Static website built with Astro 7 and Tailwind 4, delivered as an atomic release by Jenkins (`deployStaticSite`, see `Jenkinsfile`).
There is no CMS and no server code: forms post to a backend that is its own repository (a small Laravel backend, for example
the `laravel-cms` template, or a shared form service). This file is about running and operating the site; the engineering
rules are in `docs/project_guidelines/`.

## Requirements

- Node.js 26 (`.nvmrc`) and the pnpm version pinned in `package.json` (`packageManager`; Node 26 ships without corepack:
  `npm install --global pnpm@<version>`).
- Playwright browsers for the e2e checks: `pnpm exec playwright install chromium`.

## Commands

```sh
pnpm install --frozen-lockfile
pnpm dev                 # dev server, http://localhost:4321
pnpm build               # static build into dist/
pnpm verify              # checks dist/: titles, canonicals, CSP, sitemap with lastmod, llms.txt, robots, internal addresses
pnpm eslint              # read-only; `pnpm eslint:fix` rewrites
pnpm format:check        # read-only; `pnpm format` rewrites
pnpm check               # astro check
pnpm test                # Vitest (helpers)
pnpm test:e2e            # Playwright smoke and SEO specs on dist/ (desktop 1440 px and mobile 390 px)
pnpm audit               # known advisories (accepted ones are in pnpm-workspace.yaml with reason and date)
```

Run the read-only commands before every push; Jenkins runs the same ones in its `Checks` stage.

## Guidelines

The rules in `docs/project_guidelines/` and the block in `AGENTS.md` are rendered by `esoul-guidelines` (`esoul-guidelines.json` holds the layers,
`esoul-guidelines.lock` what was written). The project has no PHP and no Composer dependency, so `vendor/bin/esoul-guidelines` does not exist.
**CI needs nothing from you:** the pipeline runs `esoul-guidelines check` with the version recorded in `esoul-guidelines.lock` (`package_version`, e.g. `v0.3.4`;
the `Guidelines check` stage downloads that release's PHAR, verifies its checksum and runs it), so a new guidelines release never breaks the build before you
`sync` to it. On your machine install the command in one of three ways (the same code, the commands of
[eSoul-cz/guidelines](https://github.com/eSoul-cz/guidelines#repositories-without-php)): **Composer global**, **the PHAR of the recorded version**, or
**the Docker image** (optional; its tag is the release that eSoul-cz/ci-images ships, which may differ from the recorded one, and `check` then reports outdated content).

```sh
# 1. Composer global (PHP 8.4+ and Composer); take the version of the lock (package_version without the "v")
composer global require esoul-cz/guidelines:<version>
export PATH="$(composer global config bin-dir --absolute):$PATH"   # once, e.g. in ~/.zshrc
esoul-guidelines sync        # after a new guidelines release: composer global update esoul-cz/guidelines, then sync
esoul-guidelines check       # read-only: exit 1 on drift (a generated block was edited) or outdated content

# 2. PHAR of the recorded version (PHP 8.4+, no Composer); this is what CI runs
VERSION=$(php -r 'echo json_decode(file_get_contents("esoul-guidelines.lock"))->package_version;')   # e.g. v0.3.4
BASE="https://github.com/eSoul-cz/guidelines/releases/download/${VERSION}"
curl -fsSL -O "$BASE/esoul-guidelines.phar" -O "$BASE/esoul-guidelines.phar.sha256"
sha256sum -c esoul-guidelines.phar.sha256     # macOS: shasum -a 256 -c esoul-guidelines.phar.sha256
chmod +x esoul-guidelines.phar
sudo mv esoul-guidelines.phar /usr/local/bin/esoul-guidelines   # or run it without installing: php esoul-guidelines.phar sync

# 3. Docker (optional; no PHP; log in first: docker login rg.fr-par.scw.cloud); the tag is one release line of the image, not necessarily the recorded version
docker run --rm -v "$PWD:/app" -w /app --user "$(id -u):$(id -g)" rg.fr-par.scw.cloud/testing-images/esoul-guidelines:0.3 sync
docker run --rm -v "$PWD:/app" -w /app --user "$(id -u):$(id -g)" rg.fr-par.scw.cloud/testing-images/esoul-guidelines:0.3 check
```

Run `sync` after a guidelines update and commit the result (`docs/project_guidelines/`, `AGENTS.md`, `esoul-guidelines.lock`); never edit the generated
blocks by hand. Jenkins runs `esoul-guidelines check` of the version in the lock and fails the build on drift or outdated content.

## Configuration

Values are build arguments (`.env.example` lists them); the process environment wins over `.env`, so Jenkins needs no file.

| Variable         | Meaning                                                                                                        |
| ---------------- | -------------------------------------------------------------------------------------------------------------- |
| `SITE_URL`       | Canonical origin: canonical links, `og:url`, sitemap, `llms.txt`.                                              |
| `PUBLIC_NOINDEX` | `true` while the preview is protected: `noindex` on every page, `robots.txt` disallows everything, no sitemap. |

## Pages and SEO

- Every indexable page is listed in `src/lib/site-pages.ts` (title, description, `updatedAt`). `llms.txt` and the sitemap `lastmod` are
  generated from it; `pnpm verify` fails when a page of the build is missing. Change `updatedAt` only when the content of the page changes.
- Titles are at most 60 characters and descriptions 110-155 characters (checked by `e2e/seo.spec.ts`).
- The default Open Graph image is `public/og-default.png` (1200x630); replace it with the project's image.
- A page that must not be indexed passes `noindex` to `BaseLayout` and is not listed in `site-pages.ts`.

## Preview and launch

- Preview URL: _TBD_ (HTTP basic auth in the web server; the password is a Komodo variable, never in the repository).
- Deliberate deviations from the design: _none yet_.
- Launch: remove basic auth, set `PUBLIC_NOINDEX: 'false'` in the `Jenkinsfile`, deploy, then verify headers, `robots.txt`, the sitemap and indexability.

## Delivery

`Jenkinsfile`: one call of `astroPipeline` (static mode): install, audit, lint, format, type check, tests, build, verify, the Playwright specs
and `esoul-guidelines check` (`Checks`), then `deployStaticSite` uploads `dist/` to `releases/<id>/` under `deployPath`, shares the hashed `_astro` files between releases and
switches `current` atomically; the live site is checked for the release marker and cache headers and switched back on a mismatch. NGINX serves
`current` and `shared/_astro/` (`root <deployPath>/current;` and `location ^~ /_astro/ { root <deployPath>/shared; }`).
