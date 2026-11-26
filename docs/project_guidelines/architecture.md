<!-- esoul-guidelines:begin architecture -->
# Project guidelines - Architecture

The project is an Astro website of one **archetype**, recorded in [CONTEXT.md](../../CONTEXT.md) (*Project profile*) and decided in the project's decision record. The archetype fixes the render mode, how content is edited and how forms are handled; changing it is a new decision, not a refactor. Versions are named only in [tools.md](tools.md#versions).

## Archetypes

The default is a **static site with a Laravel/Filament CMS** (`C-headless`). `A-static` is the same site without the CMS. `B-admin` and `D-static-api` are exceptions and each needs an ADR; `B-admin` has the `astro-ssr` template, `D-static-api` has none.

| Archetype    | Status                         | Render mode                              | Content edited by                                         | Forms                                          | Typical stack                                         |
| ------------ | ------------------------------ | ---------------------------------------- | --------------------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------- |
| `C-headless` | **default**                    | `output: 'static'`, data fetched at build | The client in the Laravel/Filament CMS (the backend)      | Posted to the CMS backend                      | Astro, Vue islands, a Zod-validated content contract, Laravel + Filament |
| `A-static`   | allowed, no CMS                | `output: 'static'`                       | Developers or agents through git ([content.md](content.md)) | Posted to a small Laravel backend started from `laravel-cms`, or to a shared form service | Astro, Tailwind, no or few islands                    |
| `B-admin`    | exception, ADR (template `astro-ssr`) | `output: 'server'` with `@astrojs/node`  | The client in the project's own admin                     | Astro Actions (the Astro server is the backend) | Astro SSR, admin islands, server services, SQLite     |
| `D-static-api` | exception, ADR (no template) | `output: 'static'` plus a **runtime API on the same origin** | Developers through git ([content.md](content.md)); the backend owns transactional data (cart, accounts) | Posted to the backend API on the same origin | Astro, islands, one API client module, a reverse proxy that routes the backend paths |

Decisions are recorded in the project's decision record. Typical topics: render mode and adapter, content editing model, form and anti-spam handling, motion stack, fonts and licences, image pipeline, hosting and preview protection, languages. A site that cannot be built statically (SSR, `B-admin`) starts from the `astro-ssr` template, whose deployment follows [deployment.md](deployment.md#exceptions-ssr-and-d-static-api); a `D-static-api` site also needs a deployment of its own, which is part of its ADR until a template exists.

## Repository layout

- A site with a backend is a **monorepo with two git submodules**, `frontend` (the Astro site) and `backend` (the Laravel/Filament CMS, or the small form backend of `A-static`). Each submodule is its own repository, so Jenkins builds and deploys each separately ([deployment.md](deployment.md#delivery-paths)).
- The templates mirror that layout: `astro-cms-frontend` (the `frontend` repository), `laravel-cms` (the `backend` repository) and the thin root template `astro-cms` (README, the contract between the halves, the NGINX and manifest notes, and the step that adds the two repositories as submodules). Each of the three repositories has its own `esoul-guidelines.json`. The forms of the backend live in the `laravel-cms` template, so a no-CMS static site that needs forms (`A-static`) starts its `backend` from `laravel-cms`.
- The monorepo itself holds the shared documentation and tools and exists for working convenience: nothing is built or deployed from it, and the submodule pointers are updated when a half is released.
- A change to the contract between the halves ([content.md](content.md#c-headless-edited-in-a-separate-backend)) is a pull request in each repository, linked to each other.
- A static site that posts to a shared form service has no backend of its own and is a single repository.

## Pages, layouts and components

- Public pages render inside one base layout (`src/layouts/BaseLayout.astro`) that owns the head (meta, canonical, Open Graph, JSON-LD, fonts, icons), the header and the footer ([seo.md](seo.md)). A page passes its title, description and flags; it does not write head tags.
- Static content is written in `.astro` components. A UI framework component is used only for a real interactive island.
- UI components live in `src/components/ui/`, one per design-system component or variant group ([frontend.md](frontend.md#design-to-component-map)); page sections live in `src/components/<page-or-area>/`.
- Components never hard-code user-visible text ([content.md](content.md)).
- Routes and internal links come from a single routes module ([content.md](content.md#routes-and-languages)), never from string literals scattered through components.

## Islands

- **Use the lightest hydration directive that works**: none, then `client:visible`, then `client:idle`; `client:load` only for an island that must react before the user scrolls to it. Each `client:load` is justified in the pull request.
- Island props MUST be serializable. When a component needs functions (plurals, formatters), hydrate it through a small wrapper island that builds them on the client.
- An island used on a public page keeps its JavaScript small; a library that adds weight to every page needs a decision.
- Vue is the island framework. React is used only when an ADR records why; a project never mixes the two.
- Islands do not import `astro:content` or the content-source modules; they receive view models.
- A plain `<script>` on a page that uses `<ClientRouter />` runs on `astro:page-load`, not once.

## Content must not depend on JavaScript

- Every text, link, image and heading of a public page is in the HTML that the server or the build produces. Search engines, AI crawlers, link previews and visitors without JavaScript see the whole page.
- Interactive enhancements (tabs, filters, carousels, lightboxes, instant validation) are progressive enhancement: without JavaScript all content is visible and a form without reCAPTCHA still submits. A form protected by reCAPTCHA is the stated exception ([Forms](#forms)): the page and the form's contact alternative still render without JavaScript. Use `noscript:` variants or the base layer to reveal what scripts would otherwise toggle.
- Animations never hide content that has no other way to appear ([frontend.md](frontend.md#motion)).

## Forms

Forms always post to a backend; a static page never sends mail itself. With a CMS (`C-headless`, the default) the Laravel backend owns forms: recipients, SMTP and stored submissions. Without a CMS (`A-static`) the project posts to a shared form service, or adds a small Laravel backend that holds only forms and starts from the `laravel-cms` template, because the forms live in that template and not in a layer of their own. The form posts with a plain `<form method="post">`; a script MAY enhance it with in-place results. A form protected by reCAPTCHA needs JavaScript to obtain its token, so it does not submit without it (see the reCAPTCHA rule); the page and a contact alternative (an e-mail address or a phone number next to the form) still render without JavaScript. The form endpoint of `A-static` and `C-headless` applies the following; `B-admin` and `D-static-api` follow their own sections:

1. **honeypot**: a hidden field; when filled, the robot gets a fake success and nothing is sent;
2. **rate limit**: per client address, state stored outside the webroot;
3. **reCAPTCHA v3**: the token is verified on the server with a score threshold; without a secret (local development only) verification is skipped with a logged warning. A submission **without a token** is rejected with a clear message that names the cause and the alternative (for example "Enable JavaScript or contact us at <contact>"); it is not accepted on the honeypot and the rate limit alone;
4. **delivery**: e-mail over SMTP **and** a database record as a backup;
5. **last resort**: when both fail, the submission is appended to a file outside the webroot.

The client address is stored only as a hash.

### Archetype `B-admin`

Forms submit to Astro Actions with `accept: "form"`, so a plain `<form method="post">` works without JavaScript (unless the decision adds a reCAPTCHA, which needs JavaScript as in [Forms](#forms)) and the page renders the result from `Astro.getActionResult()`. A script MAY take over for instant validation and in-place results.

- The action validates with a schema shared with the browser, **stores the submission first** and sends the notification in the background: a mail failure never fails the submission.
- Spam protection is a honeypot plus a rate limit per client; a captcha only by decision.
- Every action except login and the public form submissions starts with the session check. A server island (`server:defer`) checks the session itself, because it is fetched outside the middleware.

### Archetype `C-headless`

Forms post to the backend's form endpoint, whose URL is set at build time; the backend owns recipients, SMTP and stored submissions. Without JavaScript a reCAPTCHA-protected form gets no token, so the backend rejects it with the message of the reCAPTCHA rule and the page shows the contact alternative; otherwise the form posts normally and the backend redirects back with a result anchor. The backend lists the site in its allowed origins.

### Archetype `D-static-api`

Forms and interactive features (login, cart, account) call the backend's API on the **same origin** from islands, so no CORS setup is needed. The pages are still static HTML:

- The backend paths (for example `/api`) are listed once in `astro.config.mjs`, where they feed the dev server proxy and `connect-src` of the CSP; the production proxy routes the same paths ([deployment.md](deployment.md#reverse-proxy-and-tls)).
- Islands reach the API only through one client module; no component calls `fetch` for the backend itself.
- Everything an indexable page shows is in the build output; the API supplies only per-visitor data. Pages that exist for a signed-in visitor or a transaction (account, cart, checkout and the like) are `noindex` ([seo.md](seo.md#meta)).
- A transactional feature that cannot work without JavaScript (login, cart) is an exception to the no-script form rule, as is a reCAPTCHA-protected form; the page still renders all of its content without scripts.

## Server code

### Archetype `B-admin`

- Server code lives in `src/server/` as plain Node TypeScript with no `astro:*` imports, so scripts (migrations, seeds) run it directly. One runtime serves actions, pages, API routes and middleware.
- Migrations are numbered files registered in one place; the migration run fails when a registered migration below the latest applied one never ran. A migration from a parallel branch takes an id above everything merged.
- Seeds run once per database, in id order, in a transaction with their marker, and never again, even when the client later edits the data. Changed seeded copy gets its own seed that replaces the old value only where it is still unedited. A developer starts them by hand (`pnpm seed` locally, `node src/server/seed.ts` in the deployed container); the start entrypoint never runs them ([deployment.md](deployment.md#the-production-start-entrypoint)).
- Settings from the environment are validated when migrations and seeds run and at startup, so an invalid value fails the deploy instead of a request.
- The middleware sets security headers (CSP, `nosniff`, `Referrer-Policy`), limits request body sizes, and marks admin and action responses `Cache-Control: private, no-store`.
- Uploads are validated by decoding their content, stored outside the build, and served only as resized copies; originals (with EXIF and GPS) are served to logged-in administrators only.
- Redirects kept in the application ([public-website.md](public-website.md#redirects-from-an-old-site)) are one table (old path, target or 410, hit count) that the middleware looks up before routing, from a cache the admin invalidates on save. Only a request that would otherwise end in 404 is redirected, so a redirect never hides a live page. Saving a redirect normalises both paths to the site's canonical form and refuses a target that is itself a redirected path, a path that redirects to itself, and an external URL; renaming a slug adds the old path and points earlier redirects to the new target.

### Archetypes `A-static` and `C-headless`

The site has no server code; everything it shows is produced at build time. Forms are posted to a backend (or, for `A-static`, possibly to a shared form service), which is its own repository ([Repository layout](#repository-layout)). Where the content lives differs: on `C-headless` it is stored in the backend, on `A-static` it is in the site's own repository ([content.md](content.md)).

### Archetype `D-static-api`

The site has no server code beyond the backend API ([Forms](#forms)). Everything else is produced at build time.

> Local additions go below this managed block. Content outside the block is preserved when the guidelines are synced.
<!-- esoul-guidelines:end architecture -->
