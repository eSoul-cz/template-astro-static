<!-- esoul-guidelines:begin content -->
# Project guidelines - Content

Every text a visitor reads has exactly one home, and the client's approved copy reaches it without being retyped by hand. The approved copy, the page tree and the meta texts are kept in the project's content documents (see [CONTEXT.md](../../CONTEXT.md)); the code does not invent copy.

## Components never hard-code user-visible text

- A component in `src/components/` MUST NOT contain user-visible text: labels, headings, button text, `alt` and `aria-label` values, placeholders, pluralised counts, error messages. Everything comes in through props; a component with many strings takes one typed `labels` object.
- The site's copy lives at page level or in the content source of the archetype (below). Fixed shell copy (navigation labels, footer headings, form messages) lives in one module per area, for example `src/lib/site-labels.ts`.
- The same fact (phone, e-mail, address, opening hours, company id) is defined once and read everywhere it appears, including JSON-LD ([seo.md](seo.md)).
- Legal texts (privacy policy, terms) are structured content with an effective date, changed deliberately, never edited ad hoc in a component.
- Copy uses the client's vocabulary from the approved content document. When a text is missing, write `TBD` in the content source and list it among the items the client still has to deliver; never invent marketing copy, prices, references or credentials.
- Prices, availability and similar commercial facts appear on the site only when the project's decisions say so; where a decision hides them, a build check verifies that none leak into the output.

## Routes and languages

- All URLs are built through **one routes module** (for example `src/i18n/routes.ts` fed by a `routes.json`): a record per page with its path in every language and an `index: false` flag for pages that must not be indexed. A new page is a new record, a thin file in `src/pages/` and a shared view; components and layouts never concatenate paths.
- Visible texts of a multilingual site live in **dictionary files per language** (`src/i18n/<lang>.ts`) with the same keys: the default-language dictionary defines the type, the others are typed against it, so a missing key fails the type check.
- The default language lives at the root (`prefixDefaultLocale: false`), other languages under their prefix. `hreflang` alternates and the language switcher derive from the routes module ([seo.md](seo.md)).
- Content coming from a source with several languages is selected through one `localize()` helper, not per-component conditionals.
- When the backend of a headless site also needs the route table, it is copied from the routes module through a pull request in the backend repository, linked to the pull request in the frontend repository that changes the routes ([Repository layout](architecture.md#repository-layout)).

## Content editing model per archetype

The archetype decides who edits content and how it reaches the site ([architecture.md](architecture.md#archetypes)).

### A: static, edited through git

- Content is in **content collections** (`src/content/`, Markdown or data files) or in typed data modules (`src/data/*.ts`). Developers or agents edit it in a pull request.
- Every collection has a Zod schema in `src/content.config.ts` (Zod comes from `astro/zod`). A missing or invalid field fails the build; optional fields are optional on purpose.
- Repeated entries (news, products, references) are collection entries, never copies of a page. Adding one is documented in `README.md` for the person who does it.
- Images referenced by content go through `astro:assets` ([frontend.md](frontend.md#images)).

### B: edited by the client in the project's admin

- Every editable section is declared once in a **registry** of sections and fields (in web order, with layout, required flag and maximum length). The admin form, the stored keys and the page rendering all come from it; a field that is not in the registry is not editable.
- Text is stored per section and key; images are stored as references to uploaded images, never as URLs typed by hand.
- The approved copy and photos enter the database through a **run-once seed**, started by hand (`pnpm seed`, or `node src/server/seed.ts` in the deployed container), never by typing them into the admin and never by the start entrypoint. Later corrections to seeded copy use a new seed that replaces a value only while it is unedited.
- Structured data the client manages (price lists, galleries, references) has its own tables with an explicit `position` for ordering and ids that are never reused.
- Admin copy (labels of the admin itself) lives in one labels module, not in the database.
- The admin is designed like the public site, and its screens follow the admin frames of the design.

### C: headless, edited in a separate backend

- The backend exports content through one versioned endpoint. The site fetches it **once per build** for all collections, through a content loader in `src/content.config.ts`.
- The export is validated by a **Zod schema that is the contract** with the backend's exporter. Changing the contract changes both sides together, with a pull request in each repository (linked to each other), the schema, the fixture and the contract document. An invalid export fails the build, and the previous version stays live.
- The schema enforces the invariants the backend also enforces: **exactly one home page**, **unique page ids and slugs**, a slug pattern (`^[a-z0-9]+(-[a-z0-9]+)*$`, because the slug is a path segment), file URLs of the form `/_cms/<hash>.<ext>` and a content hash for every file.
- **Golden-file contract test on both sides.** The backend has a test that writes the real output of its exporter over test data to a golden JSON file; the frontend fixture is generated from that file, and a frontend check fails when the fixture differs from it (except `generatedAt`, `contentHash` and file URLs). The contract is therefore tested against the exporter's real output, never against a hand-written sample.
- **The fixture is refused in CI.** `CMS_SOURCE=fixture` (data from the committed fixture, no backend) is for local and pull-request builds. In CI the build throws when it would use the fixture without `CMS_SOURCE=fixture` set explicitly in the environment, and `CMS_SOURCE=api` without `CMS_API_URL` and `CMS_API_TOKEN` fails.
- **Build provenance.** The build writes the export it was made from next to the build output; `pnpm verify` compares `dist/` with it: every page of the export exists as HTML, no other page exists, and every media file the HTML references is in the export ([tools.md](tools.md#jenkins-checks-stage)).
- Media are named by their content hash and verified at build time (a missing file fails the build). Their bytes are not copied into `dist/`: NGINX serves them under `/_cms/` from the backend's bind-mounted public directory on the same host, so the site makes **no runtime call to the backend**, but it needs that directory on the host, and a changed photo is not visible before publication.
- Publication is a button in the backend that triggers the site's Jenkins job; the job reports the result back to the backend, and a publish without a result times out (`CMS_PUBLISH_TIMEOUT`) ([deployment.md](deployment.md#publish-flow-archetype-c-headless)).
- A local snapshot of the last export is not used: **CI and local builds either stand on current data from the backend or on the fixture, never on a stale copy**. A build that cannot reach the backend fails.
- View models map the export to the props islands receive, so the export shape does not leak into components. API calls from islands go through one client module.
- What stays hard-coded in the site (per-slug exceptions, special pages) is listed in `README.md`; a slug change in the backend that would break it fails the build or logs a warning by design.

### D: static, with a runtime API on the same origin

Site copy is edited as in archetype A (through git). Runtime data that belongs to the visitor (cart, account, orders) is not content: it comes from the backend's API through one client module ([architecture.md](architecture.md#archetype-d-static-api)), and no indexable page depends on it.

## Content and SEO fields

- Every indexable page has a title, a description and an Open Graph image from its content source, checked against the limits in [seo.md](seo.md).
- `noindex` is a content flag where the archetype supports it, and the sitemap respects it. Pages without a content source (account, cart, checkout and the like) are marked `index: false` in the routes module.

> Local additions go below this managed block. Content outside the block is preserved when the guidelines are synced.
<!-- esoul-guidelines:end content -->
