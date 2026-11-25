<!-- esoul-guidelines:begin deployment -->
# Project guidelines - Deployment

People and agents working on a project do not control deployment. This file is a **reference** for how eSoul applications are built and run, so that the code, the Dockerfile and the pull request fit the scheme. Only people with devops access deploy and change stacks, manifests and servers; what is written here about them is a fact of the scheme, not a task for project developers. Framework files add runtime detail to the sections of this file and MUST NOT contradict it. MUST, MUST NOT, SHOULD and MAY are used as in RFC 2119. **Target.** marks a rule the infrastructure does not yet meet; the gap is named.

<!-- from: framework/astro -->
Astro runtime detail added to the deployment scheme. The `Jenkinsfile` is one call of the shared `astroPipeline` step ([Pipeline steps](#pipeline-steps)), which runs the checks of [tools.md](tools.md#jenkins-checks-stage) first and then delivers on the deploy branches. A site is **static**: what is deployed is the built `dist/` directory and the host NGINX serves it.

## How an application reaches production

- A **change to code or to a stack's configuration** reaches production only through a merged pull request and the project's CI pipeline in Jenkins. Publishing content from a CMS is not such a change: the editor's publish action starts the site's Jenkins job, which builds and deploys the already merged code with the new content, without a pull request (the publish flow in the stack's deployment guideline describes it). Deploying and changing stacks is done by people with devops access, through Jenkins and the manifest, never by hand in Komodo, on the server or with `docker` commands. The one exception is the rollback in an incident, which devops MAY do in Komodo ([Rollback](#environments-and-releases)). Agents never deploy outside Jenkins ([security-and-data.md](security-and-data.md#production-access)).
- A pull request runs the checks and tests (and, where the pipeline has it, a test build of the images); nothing is pushed or deployed.
- **The push build is fixed.** A new stage or check in it (a pipeline option that adds one, a script a pipeline step starts) needs an accepted ADR and a human's approval before it is added; no project, branch or agent batch adds one on its own authority. A check that needs the production database engine runs in the project's scheduled job ([testing.md](testing.md#test-groups)), never in the push build. The test stage stays within the [suite time budget](testing.md#suite-time-budget).
- A branch with a deploy rule builds multi-architecture images and pushes them to the company registry under `<registry>/app-images/`, tagged as the rule says (`latest` for `main`, [Environments and releases](#environments-and-releases)) and with every Git tag on the commit except `latest`, which only `main` pushes.
- A pipeline MAY smoke-test the pushed image before deploying (Jenkins capacity is limited, so it is not the default); where it does, a failed smoke test MUST stop the deploy that the pipeline starts. The image is then already in the registry, so a stack that Komodo redeploys on every new `latest` image is not protected by it (see the **Target.** in [Environments and releases](#environments-and-releases)).
- The deploy redeploys the project's Komodo stack, which pulls the tag and runs the stack's hooks. Which branch deploys to which stack is part of the project's pipeline configuration ([Environments and releases](#environments-and-releases)).
- A static site is released as a new directory and switched by one atomic link (`releases/<id>`, `current`). The previous releases stay on the server, so a rollback re-points the link.

## Stacks and manifests

- Every deployed stack is defined by one manifest, `apps/<client>/<name>.yaml`, in the infrastructure repository. A change to a stack is a change to its manifest.
- Applying a manifest writes the compose file, the Komodo stack definition and the NGINX site. **Applying is not a deploy:** it does not recreate running containers. Starting or updating containers is done only by a Komodo deploy, which Jenkins runs.
- A stack's difference from its shape goes into the manifest (`compose_extra`, `nginx.extra`, `env`) or into the project's own override (`project`). Nobody edits a rendered file or a Komodo setting that the manifest describes; the next apply replaces it.
- A manifest uses one of the shapes it offers (`laravel-fpm`, `lsr-roadrunner`, `node-http`, `static-release`). `custom` is used only when no shape fits, and the project records why.
- A second deployment of an application is a second manifest named `<name>-<environment>`. Stack names and domains are unique across servers.
- **Target.** Stacks still outside manifests are migrated one file at a time; until then their Komodo settings are changed in Komodo and recorded in the migration plan.

## Environments and releases

- A project starts with only the `main` branch, which is deployed during development to a **staging** environment. After the release `main` becomes **production**. A `staging` branch, deployed to the staging stack, MAY be added afterwards; it is project-specific and depends on the client's requirements (some clients do not pay for two deployments). The same lifecycle is in [workflow.md](workflow.md#branches).
- Every environment has its own stack, database, Komodo variables, buckets and secrets. Staging that holds real data is protected like production. A development stack MAY exist; it is not a release environment and holds no production data.
- The pipeline's deploy rules say which branch goes where, for example `main` to the staging stack before the release and to the production stack after it, and `staging` to the staging stack.
- Production runs the image built from `main`, tagged `latest`. Only `main` pushes `latest`; a second deploy branch pushes its own tag (for example `staging`), so a stack that Komodo redeploys on every new `latest` never runs staging code. No release-tag step is required.
- **Rollback.** The pipeline records what runs: after every successful `Deploy` it tags each image of the stack `deployed-<stack>` (the image that runs now) and moves the image that ran before to `previous-<stack>`. A rollback deploys `previous-<stack>` and is the one named exception to "never by hand in Komodo" ([How an application reaches production](#how-an-application-reaches-production)): in an incident, devops (the people with Komodo access) set the stack's `image_tag` to `previous-<stack>` and deploy the stack in Komodo. Afterwards the state is brought back in line: the hotfix issue records the rollback (when, which image, who), and the stack goes back to the manifest's `image_tag` with the next deploy of the fix through Jenkins. An `apply` resets `image_tag` to the manifest value but is not a deploy, so the rolled-back containers keep running until that deploy; until then `latest` still points at the broken image, so nobody redeploys the stack by hand at `latest`. Images pushed by a build whose `Deploy` failed are never `deployed-` or `previous-`, so they are never a rollback target; the tags move only in the pipeline, so a manual rollback leaves them as they were. A stack has the tags from its first deployment after the pipeline began to record them (`jenkins-libraries`, 2026-11-25); before that, the previous release is the image of the Git tag of the previous successful `main` build, or the digest the registry lists for the push before the current one, skipping builds that did not deploy. Do not rerun the old Jenkins build to roll back; it rebuilds the code and moves `latest` again. A static site is rolled back with `rollbackStaticSite`, which re-points `current` to the previous release without a build.
- Migrations run once per deployment, forward-only, and are safe while the previous release still serves requests. Only one container per stack runs them ([The production start entrypoint](#the-production-start-entrypoint) says how they run and what a failure does).
- **Target.** Some stacks are still redeployed by Komodo on every new `latest` image (auto-update); the pipeline deploys them instead once their stacks are managed.

## Monitoring a deployment

- A deployment to a real production environment MUST be monitored by the person who pushed or started it (merged the pull request that deploys, or started the Jenkins job). They stay with it until the new release serves, and check that the application still works in production: the health endpoint and the state of the stack's containers, the feature the change touched, the logs and the error alerts for new errors, and the output of the migrations from the start entrypoint, which is the only signal of a migration that failed ([The production start entrypoint](#the-production-start-entrypoint)).
- They are ready to roll back ([Rollback](#environments-and-releases)) or to ship a hotfix ([Hotfix](workflow.md#hotfix)), and decide which; the incident goes in the hotfix issue. Nobody starts a production deployment and walks away.
- A deployment to staging SHOULD be monitored the same way. It is recommended there, not required.

## The production start entrypoint

The production image starts through a `start` entrypoint, the script the container runs before it hands over to the server (Laravel `docker/production/start`, LSR `docker/startProd.sh`, the Node image's start script). Its stack detail is in the framework's deployment guideline; the rules are these.

- **It SHOULD be quick.** It starts the server (php-fpm, RoadRunner, Node) promptly. A heavy data task (a recalculation, a sync, a data cache warm-up, an import) runs in the background, as a one-shot Supervisor program or a background process (`&`), and never before the server starts. Migrations are the exception: they run before the application starts. Other steps the application needs before it can serve MAY stay in front of the server, for example caching configuration and routes, linking storage, preparing writable directories and the LSR `/prepare-runtime`.
- **Migrations run forward-only and non-destructively** (`php artisan migrate --force`, the LSR `app:install`; never a fresh, reset, rollback or wipe option), only in the container whose switch is on. **A failing migration MUST NOT block the deployment.** The container starts anyway and the entrypoint logs the failure loudly on standard error, naming the step and saying that the schema may be behind the code. The person who monitors the deployment ([Monitoring a deployment](#monitoring-a-deployment)) reads that output and reacts.
- **The start entrypoint MUST NOT run any seeder**: no `db:seed`, `migrate --seed`, install command that seeds, or seed step in a Dockerfile or a Komodo hook. Seeding is a deliberate act of a developer, done by hand in the container's terminal (`docker exec <container> php artisan db:seed --class=ProductionSeeder`, the stack's equivalent), where the output is in front of them.
- **In staging and production only a specialised set of seeders MAY run, and only by hand**: idempotent, create-only, the data every environment needs (the production seeder; the framework's deployment guideline gives the detail). A general seeder that relies on Faker or other synthetic data is for local development only. It MUST NOT run in staging or production, and it refuses to run there.

## Local development

- Local development runs in Docker. The project's `docker-compose.yml` MUST list every service the application needs: the database engine the application uses in production, a Valkey service when it uses a cache, a search node when it searches, and so on. Nothing the application needs is installed on the developer's host.
- Helper containers belong in the same file: `mailpit` to catch e-mail, and an S3-compatible container (a maintained MinIO image or an alternative) in place of object storage. Deployed applications use the company's Scaleway Object Storage, never a self-hosted object store.
- A web server container (NGINX) is allowed locally. It is not part of a deployed stack ([Reverse proxy and TLS](#reverse-proxy-and-tls)).
- The ports of support services MAY be bound to `127.0.0.1`; it is not required.
- Local credentials come from `.env`, copied from `.env.example`. Tests never use the development database ([testing.md](testing.md)).

## Shared services

The servers run a few shared services, each applied from the infrastructure repository. An application uses them through its manifest and never adds a server of the same kind to its own stack.

### Database

- Application data is kept in a shared database server of the host. **MariaDB is the default.** **PostgreSQL** is for applications whose framework or libraries require it. A new application that needs PostgreSQL gets a login and a database on the shared server. Applications reach the server at `host.docker.internal`.
- Each application has its own database and its own login, declared in its manifest. A login owns only its database and never receives a superuser password.
- The password of a login is generated and kept in 1Password (vault `DevOps`, category Database); the stack receives it through a Komodo variable. It is never in a manifest, a rendered file or the repository.
- Schema changes go through migrations ([Environments and releases](#environments-and-releases)); no manual SQL in any real environment ([security-and-data.md](security-and-data.md#production-access)).
- **Target.** Several stacks still run their own PostgreSQL container; migrating them to the shared server is open.

### Cache

- A Redis-compatible cache is a Valkey service in the application's own stack (`valkey: {profile: cache}` or `{profile: kept}`), reachable only from that stack. No Redis-compatible server is shared between applications.
- `cache` holds caches and locks and MAY be emptied by a restart. `kept` holds sessions and queues and writes to disk. Code MUST NOT assume that a `cache` profile survives a restart.
- The application reads its host from `REDIS_HOST=valkey` (the `redis` alias also resolves).
- **Target.** Some stacks still use a KeyDB server (shared on the host, or a sidecar) and move to Valkey with their manifests.

### Search

- Full-text search uses the shared Elasticsearch node, and only when the application needs it. Each application has a user that can reach only the indices starting with its prefix.
- Indices MUST be rebuildable from the application's own database. An index that cannot be rebuilt does not go into the shared node.
- A different search engine needs an ADR first.

### Object storage

- Deployed applications store files in Scaleway Object Storage (S3 API, region `fr-par`). Buckets are per application and environment, named `esoul-<app>-<env>-<purpose>`.
- Public and private files use separate buckets. A private file is never served from a public bucket.
- The storage key is limited to Object Storage and kept in Komodo.
- **Target.** Buckets are created by hand before the first deploy and are not yet part of the backup.

## Reverse proxy and TLS

- Public traffic enters through the load balancer, which ends TLS and speaks HTTP to the host NGINX. NGINX runs only on the host; a deployed stack contains no web server container, and the application image contains no web server.
- Every PHP application, RoadRunner included, is reached from NGINX through FastCGI. Plain HTTP is proxied only in specific cases (some JavaScript-based projects, certain RoadRunner cases), and the manifest says so.
- Every public name of an application is listed in its manifest (`domains`, `redirects`) and resolves to the load balancer. The apply issues the certificates on the load balancer.
- The application trusts forwarded headers only from the proxy's addresses, never from `*`. The proxy sets the host, the scheme and the client address itself (as FastCGI parameters or `X-Forwarded-*` headers) and drops what a client sent.
- Production sites redirect plain HTTP to HTTPS and send HSTS.
- Metrics and status ports (RoadRunner's `2112` and `2114`, and the like) are never routed. Application admin interfaces are application routes behind authentication. The application's health endpoint ([Health endpoint](#health-endpoint)) is the one service endpoint that MAY be public.

<!-- from: framework/astro -->
- TLS ends at the load balancer; the site is HTTPS-only with HSTS, and `www` and non-`www` redirect to the canonical host. A static site has no upstream: the host NGINX serves `current` itself. An SSR site on Node is one of the specific cases the host NGINX reaches over plain HTTP (the `node-http` shape).
- **One NGINX site definition serves the frontend and the backend.** The backend is on a subdomain (**RECOMMENDED** and the default of the templates, for example `admin.<domain>`) or under a path of the site's domain (such as `/admin`, the documented exception); the project decides per application and records it in `CONTEXT.md`. The backend is reached over FastCGI like every PHP application; on a path, only the backend's own paths are routed to it (`/admin`, `/cms-api`, `/livewire*`, `/up`) and everything else is the static site.
- The backend's session cookie is host-only: it is never scoped to the parent domain. On a **subdomain** that keeps the admin session away from the public site. Under a **path** of the site's domain a host-only cookie is still sent with every request to that host, so the cookie MUST be scoped to the backend's path (`Path=/admin`) or the backend moves to a subdomain.
- The proxy sends `X-Forwarded-Host`, `X-Forwarded-Proto: https` and an `X-Forwarded-For` that it **replaces**, not appends; an SSR site trusts forwarded headers only for its own domains (`security.allowedDomains`). Rate limits depend on the client address being right.
- The **Content-Security-Policy of a static site comes from Astro's `security.csp`** at build time (a `<meta>` tag per page; the build computes the hashes of inline scripts and styles, so no `unsafe-inline` is needed). `frame-ancestors` does not work in `<meta>`.
- nginx sets the other response headers on every response, static files included: `X-Frame-Options` (or `frame-ancestors` in a header CSP), `X-Content-Type-Options: nosniff`, `Referrer-Policy` and HSTS. In nginx, a `location` with its own `add_header` repeats the shared header snippet, because nginx drops inherited headers. HTML is served `no-cache`; hashed assets (`/_astro/*` and the media path) get a long, immutable cache.
- On `D-static-api`, a runtime API call from the browser needs the backend paths in `connect-src` of `security.csp`.
- On `C-headless`, NGINX serves the media under `/_cms/` from the backend's bind-mounted public directory on the same host (under the backend's run directory). The site makes no runtime call to the backend, but its media depend on that directory being readable by NGINX.
- Redirects from an old site live in this NGINX site, handed over in the pull request's deploy notes ([public-website.md](public-website.md#redirects-from-an-old-site)).

## Health endpoint

- An application served from a container exposes `GET /up`: `200` when it is ready and `503` when it is not. It does not depend on the session or on CSRF protection. The endpoint reveals only whether the application is up, so it MAY be public; the external check uses it.
- The image has a Docker `HEALTHCHECK` that requests it from inside the container. A crashed process is restarted by the container's supervisor; the healthcheck reports one that stays down.

## Configuration and secrets

- Plain settings are `env` in the manifest. Secrets are listed under `secrets` and become Komodo variables named `<STACK>_<NAME>`. Values MUST NOT appear in manifests, rendered files, Git or Komodo exports.
- Secrets have one home each: Komodo variables for a stack, 1Password for database logins and service accounts, the Ansible vault only for host-level secrets. A secret shared by several stacks is one Komodo variable that each stack references.
- **A new configuration variable:** the developer adds it to `.env.example` with a placeholder and names it in the pull request's deploy notes ([workflow.md](workflow.md#pull-requests)); devops add it to the manifest or to Komodo before the deploy.
- Secrets never go into build arguments, image layers or logs.
- Files on the server that hold secrets are readable only by root and by the container user. **Target.** Several `.env` files are currently readable by everyone.

## Observability

- Every application exports traces, logs and metrics over OpenTelemetry OTLP to the host collector (gRPC on `host.docker.internal:4317`), with the standard `OTEL_*` variables.
- Logs go to standard output and error. A log line names records by id and carries no personal data, amounts or file content ([security-and-data.md](security-and-data.md#personal-and-client-data)).
- Every production stack has an alert when its health check fails. **Target.** Coverage is not verified per stack.

## Backups

- The infrastructure backs up every application database and the application directories daily, away from the production host. Restores are tested.
- Data that must survive a container lives in the stack's run directory (a bind mount) or in a shared service, never only in a Docker volume ([Networks and access](#networks-and-access)).
- **Target.** Object-storage buckets are included in the backup; restore tests cover application directories and PostgreSQL.

## Networks and access

- Containers deployed by Komodo publish **no ports**. The containers of a stack talk on the stack's own network; shared containers (the search node, …) are on the server's shared network (`apps`).
- The host NGINX proxies to a container directly by name: the `hoster` service writes the containers' addresses and aliases into `/etc/hosts`. Docker-published ports bypass the host firewall, which is why none are published.
- Persistent state is a **bind mount** under the stack's run directory, `/data/apps/<client>/<app>`, and is covered by the backups. A named Docker volume is only for disposable data (caches, build output), which no restore depends on.
- Server access is by SSH key, from allowed addresses or over the tailnet. The tailnet access policy is kept in the infrastructure repository. **Target.** It is not yet applied.

## What not to introduce

- Laravel Cloud, Laravel Forge, Vapor or any hosted platform for production. Sail is not a production deployment.
- A Redis or KeyDB server shared between applications. A Redis-compatible store is a Valkey service in the application's own stack.
- A self-hosted object store in a deployed stack. Use Scaleway Object Storage through the S3 API; for local development any S3-compatible dev container is fine.
- A database server or a search engine owned by one application.
- A second reverse proxy (Traefik, Caddy) in front of or beside the host NGINX, without an ADR.
- A web server container in a deployed stack. (Locally it is allowed.)
- Hand edits in Komodo, on the server or in rendered files that the manifest manages. The only exception is the incident rollback ([Rollback](#environments-and-releases)).
- `docker system prune`, `docker volume prune`, `docker image prune -a` or `docker container prune` on a server: they remove data of stopped stacks.
- Production secrets or `.env` files with real values in Git, tickets, pull requests, logs or chat.

## Delivery paths

<!-- from: framework/astro -->
Two paths, chosen by whether the site has a CMS. Both end in the same server layout: `/data/apps/<client>/<app>/releases/<id>/` holds the complete build and `current` is a link that is switched atomically, so the previous version stays live until the new one is complete. No path puts a web server container or a shared volume between the build and NGINX.

### Site with a CMS: image to Komodo

The default (`C-headless`): a static Astro site and a Laravel/Filament backend that publishes it. The two halves come from the templates `astro-cms-frontend` and `laravel-cms`, tied together by the root template `astro-cms` ([Repository layout](architecture.md#repository-layout)).

```text
push to a branch with a deploy rule, or Publish in the backend
  └─ Jenkins (the frontend repository)
       ├─ Checks stage
       ├─ dockerBuildMultiArch → rg.fr-par.scw.cloud/app-images/<app>:latest (+ Git tags), an image FROM scratch holding only dist/
       └─ deployKomodoStack    → the site's Komodo stack
            └─ deploy hook: docker create the image, copy the assets into releases/<id>, switch current
```

- The `Dockerfile` is multi-stage. The build stage runs `pnpm install --frozen-lockfile`, `pnpm build` and then `pnpm verify` (it needs network: the Fonts API downloads fonts), so the image never holds a `dist/` that the checks of the [`Checks` stage](tools.md#jenkins-checks-stage) did not see, even when the CMS export changed between the two builds. The final stage is `FROM scratch` and copies in that verified `dist/` and nothing else: no operating system, no server, no source, no `.env`, no secrets. The image is only the container the assets travel in.
- `.dockerignore` keeps host `node_modules`, `.env`, runtime data, `docs/`, source photos and tests out of the build context. Native modules are installed inside the build, for the target platform.
- The deploy hook of the stack creates (does not start) a container from the image, copies the assets into a new `releases/<id>/` directory, switches `current` atomically and prunes old releases. A new image therefore never leaves the old site behind, and a failed copy leaves the previous release live.
- **Rollback is redeploying the previous image** (`previous-<stack>`, [Environments and releases](#environments-and-releases)): the hook turns it into a new release and switches `current`.
- **Hashed `_astro` files.** A page opened before the switch may request a lazy chunk from `/_astro/` that the new release no longer holds. The hook SHOULD share the hashed `_astro` files between releases as `deployStaticSite` does ([Site without a CMS](#site-without-a-cms-static-release)): it runs the same release script (`static-site-release.sh`, action `install`), which hardlinks them into `shared/`. **Target.** A hook that still copies the assets by hand does not share them, and such a page gets a `404` for that chunk and works again after a reload; which hook a stack runs is recorded in its manifest in the infrastructure repository.
- The site holds no persistent state. The CMS media are the backend's bind-mounted public directory ([Reverse proxy and TLS](#reverse-proxy-and-tls)); the backend is a separate repository with its own pipeline, image and stack ([architecture.md](architecture.md#repository-layout)).

### Site without a CMS: static release

For `A-static`, a truly static site. There is no image and no Komodo stack.

A push to a branch with a deploy rule starts the Jenkins job: install, the checks (which include `pnpm build` and `pnpm verify`), then `deployStaticSite` uploads `dist/` to a new `releases/<id>/` directory of the server, shares the hashed `_astro` files between releases, switches the `current` link atomically and prunes old releases. A failed build leaves the previous version live; `rollbackStaticSite` re-points `current` to the previous or a named release. The manifest uses the `static-release` shape.

### Exceptions: SSR and `D-static-api`

`B-admin` (SSR on Node) has the `astro-ssr` template and `D-static-api` has none; the ADR of either names how it is delivered. An SSR image follows the scheme like any application image, and the `astro-ssr` template implements it:

- It is built with `dockerBuildMultiArch` and deployed with `deployKomodoStack`; the image holds only what runs, runs as an unprivileged user under an init process, has a healthcheck and stops gracefully on `SIGTERM`.
- Where the host NGINX serves client files, the deploy hook copies them out of the image into the run directory (`./client`) on **every** deploy, so a new image never leaves the old site behind.
- Settings validation runs before the server listens, and an invalid setting exits the container. Migrations run next and a failing migration does not stop the container ([production start entrypoint](#the-production-start-entrypoint)): the start logs `MIGRATION FAILED` on standard error and the server listens anyway. The start never runs the seeds; a developer runs them by hand in the container (`node src/server/seed.ts`; the image holds no pnpm).
- Persistent state (database, uploads, form backups, logs) is bind-mounted from the stack's run directory (`./data` in the `node-http` shape) and listed in `README.md`; the infrastructure's backups cover it.

### Pipeline steps

The steps live in the shared Jenkins libraries (eSoul-cz/jenkins-libraries); each has a `.txt` with its parameters, stage names and validation.

- `astroPipeline` (`pipelines` library): the whole `Jenkinsfile`, in one call. Mode `static` runs the checks and then `deployStaticSite` for a site without a CMS; mode `image` verifies the build, builds the `FROM scratch` image from the verified `dist/` (`dockerBuildMultiArch`) and redeploys the stack (`deployKomodoStack`), with an optional report of a CMS publish back to the backend (the `cms` callback). A site configures only what differs from its defaults.
- `Guidelines check`: a stage of `astroPipeline`, on by default when the project has `esoul-guidelines.lock` (`guidelinesCheck: false` opts out); it runs `esoul-guidelines check` with the installer version the lock records, so a Node-only repository needs no PHP project around it.
- `deployStaticSite` (`deploy` library): the atomic release of the path without a CMS. With `verify` it checks the live site after the switch (the release marker of the new release, the HTML and hashed-asset cache headers: HTML `no-cache`, hashed assets immutable) and switches back to the previous release when the check fails.
- `rollbackStaticSite` (`deploy` library): re-points `current` atomically to the previous release or a named one, on a site of either path; nothing is deleted.
- One server layout and one release script (`static-site-release.sh`) for both paths: `deployStaticSite`, `rollbackStaticSite` and the Komodo copy hook of an image run the same file.
- `astroCmsPipeline` is not a step: the image path of a CMS site is `astroPipeline` in mode `image`.

### Publish flow (archetype `C-headless`)

- The build agent fetches the export from the backend over its public URL, so **`CMS_API_ALLOWED_IPS` of the backend MUST contain the address of the build agent**. A changed agent address makes the export answer 403 and blocks every publish until the list is updated; record the address in `README.md`.
- A publish is not a code change: the editor's publish action starts the site's Jenkins job on the already merged code and needs no pull request ([How an application reaches production](#how-an-application-reaches-production)).
- The backend is reached on a subdomain (RECOMMENDED) or under a path such as `/admin`; the project records which in `CONTEXT.md` ([Reverse proxy and TLS](#reverse-proxy-and-tls)). The static build fetches the export server-side in both modes, and `CMS_API_ALLOWED_IPS` applies in both.
- A publish that has no result after **`CMS_PUBLISH_TIMEOUT`** minutes (default 30) is marked failed in the backend, so the publish button cannot stay blocked. The Jenkins callback to the backend is best effort and never fails the build; a late callback is still recorded.
- Concurrent builds are disabled: two publishes would overwrite each other's release.
- In CI the build fails when the export is unreachable or invalid; it never falls back to a fixture or to old data ([content.md](content.md#c-headless-edited-in-a-separate-backend)).

## Build arguments

<!-- from: framework/astro -->
A static build bakes public values in at build time, so they are passed as build arguments from the `Jenkinsfile`, never read from a runtime `.env`. The process environment wins over a local `.env`, so Jenkins needs no file:

| Build argument      | Source        | Meaning                                                       |
| ------------------- | ------------- | ------------------------------------------------------------- |
| `SITE_URL`          | `Jenkinsfile` | Canonical origin (feeds `site` in `astro.config.mjs`)         |
| `PUBLIC_NOINDEX`    | `Jenkinsfile` | `true` while the preview is protected                         |
| `PUBLIC_<NAME>`     | `Jenkinsfile` | Any other public value (analytics id, form endpoint URL); documented in `.env.example` |

- An empty analytics or consent id means the script is not included at all.
- Secrets (SMTP, database, captcha secret, API tokens) are **never** build arguments and never baked into an image or the build output. They belong to the backend's stack at runtime ([security-and-data.md](security-and-data.md#secrets)); a token the build itself needs, such as the export token, is a Jenkins credential.
- `.env.example` lists every variable with a placeholder.

## Preview protection

<!-- from: framework/astro -->
Until launch, the deployed site is a protected preview, as [public-website.md](public-website.md#preview-gate) requires. The Astro implementation:

- **HTTP basic auth** in the web server. The password is a secret: its home is a manifest secret, that is a Komodo variable ([Configuration and secrets](#configuration-and-secrets)), never the repository, the manifest or a rendered file; the NGINX site only enforces the authentication. It is a barrier against accidental visitors, but it is still a credential. `robots.txt` stays reachable without auth.
- **`PUBLIC_NOINDEX=true`** is the one switch: it puts `noindex` on every page, makes `robots.txt` disallow everything and builds no sitemap.
- The preview URL is recorded in `README.md`.

Switching protection off is the launch step in the project's launch checklist: remove basic auth, set `PUBLIC_NOINDEX=false`, deploy, then verify headers, sitemap and indexability. Nothing else changes in the same deploy.

## Forms in production

<!-- from: framework/astro -->
- The form's captcha keys are registered for the production domain, SMTP is configured from the backend's stack, and a test submission is sent and received after every launch-relevant deploy.
- The retention period for stored submissions is recorded in the project's decisions ([security-and-data.md](security-and-data.md#personal-and-client-data)); submissions kept in the database, the backup table or the last-resort file are all covered by it.

> Local additions go below this managed block. Content outside the block is preserved when the guidelines are synced.
<!-- esoul-guidelines:end deployment -->
