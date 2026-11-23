<!-- esoul-guidelines:begin frontend -->
# Project guidelines - Frontend

The project's design file (Pencil; its location is named in [CONTEXT.md](../../CONTEXT.md)) is the source of truth for how the site looks. It is read only through the Pencil MCP tools, never as a plain file, and never modified by the implementation. Code follows the design; a deliberate deviation is recorded with its reason in `README.md` and approved by the client. Colours, fonts and spacing are never changed "to make it nicer". When the design changes, the design file MUST be saved before the implementation is compared against it.

## Design tokens

- Tokens come from the design and are defined once, in `src/styles/global.css`, in a plain **`@theme`** block under **the same names as the design variables**. They live only there: no `@theme inline`, no `:root` layer of raw values and no `--color-*: initial` resets of Tailwind's defaults. When a design variable changes, the token changes in the same pull request.
- Tailwind runs through the `@tailwindcss/vite` plugin; there is no `tailwind.config.js` and no legacy `@astrojs/tailwind` integration.
- **No arbitrary values** for anything a token expresses (`text-[15px]`, `bg-[#1E5B48]`, `rounded-[12px]`). Tailwind cannot block them, so review does. If the design needs a value without a token, add the token.
- Sizes are in **rem**, never px. Type sizes MAY be fluid (`clamp()`) between the design's mobile (390 px) and desktop (1440 px) values, so they need no breakpoint variants.
- Markup repeated many times per page (rows, list items, icons) uses component classes in `@layer components` instead of long utility strings, to keep the HTML small.

## Scoped styles

- Astro scoped styles apply only to elements rendered by the component that declares them. A class passed into another component ends up on that component's element, which has its own scope, so the rule does not match and Astro drops it as unused.
- Styles for a wrapper component's inner elements (for example an image component that renders `<Picture>`) live in a shared stylesheet (`src/styles/*.css`) or in the wrapper itself, and the **parent element** controls the size; the wrapper fills 100 % of it.
- Use `:global()` sparingly and only under a scoped parent selector.

## Design to component map

Every reusable design-system component has one component in `src/components/ui/`. The map from design node to component and its variants is kept in the project documentation and updated with every new or renamed component.

- Frames used only as design aids (brand manual, export templates) are not built.
- A dev-only preview page renders every UI component at both widths; it returns 404 in production.
- Checking against the design is done with screenshots next to the design frame at 1440 and 390 px, not by eye.

## Fonts

- Fonts load through the **Astro Fonts API** (`fonts` in `astro.config.mjs`), self-hosted at build. Only the weights and styles the design uses are loaded.
- The subsets follow the project's language: `latin` is enough for English or German; a language with more diacritics (Czech, Slovak, Polish) also needs **`latin-ext`**, with explicit `unicodeRange` values for self-supplied files. A preloaded font preloads every subset the page text uses, because preloading only `latin` makes letters with diacritics flash in the fallback font.
- The font component is rendered in the head of every page. Licences of non-Google fonts are recorded in a decision.

## Images

- Images go through `astro:assets` (`<Image>` or `<Picture>`) with **AVIF and WebP**, explicit `width` and `height`, a meaningful `alt` (empty for decoration) and `loading="lazy"` below the fold. The hero image gets `fetchpriority="high"` and is never lazy.
- `srcset` widths come from **one shared helper** that covers common mobile widths times device pixel ratio with enough intermediate steps. The browser takes the smallest variant that is at least as wide as needed; a gap in the ladder (for example nothing between 800 and 1200 px) makes it jump to a much larger file. New image usages call the helper, not their own width arrays.
- Encoder quality stays at the default unless a measured reason says otherwise (AVIF quality does not follow the JPEG scale). Hero images under a dark overlay MAY use a lower quality, measured.
- Source photos live in `assets/` (Git LFS) or `src/assets/`. A glob import marks every file in its folder as used, so a post-build cleanup step removes files from `dist/_astro` that no HTML, CSS or JS references; it is part of `pnpm build`.
- The logo is an image (SVG or PNG), never typeset.

## Motion

- One animation library per project, recorded in a decision; no hand-rolled keyframes and no second library for carousels, drag and drop or gestures.
- Animations are subtle: short fades and slides, gentle easing, nothing bounce-heavy.
- **Every animation respects `prefers-reduced-motion`**: with reduced motion, elements appear in their final state without movement.
- Animations never block LCP: hero text renders immediately, animations start after load, and content that is on screen at load stays put.
- Drag-to-reorder is always paired with keyboard-accessible move controls.

## Accessibility

- Semantic HTML first: one `h1` per page, headings in order, landmarks, buttons for actions and links for navigation.
- Every form control has a bound label and a `name`; errors are attached to their control and announced.
- Visible focus on every interactive element; colour is never the only carrier of a state; contrast meets WCAG AA in every theme the design defines.
- Icon-only controls have an accessible name; decorative icons are hidden from assistive technology.
- The mobile width (390 px) has no horizontal scroll; a browser test checks it.

## Responsive layout

- Build mobile-first. The design's two frames (390 and 1440 px) are the reference widths, and the layout holds between them and beyond 1440 px.
- Breakpoints come from tokens that match the design's frames, not from Tailwind's defaults.

## Third-party scripts

- Analytics, tag managers and marketing pixels load only after the cookie consent allows them, from one place in the base layout, and only when their public id is configured ([deployment.md](deployment.md#build-arguments)).
- Embeds (maps, video) load on interaction or below the fold, with a static placeholder.

> Local additions go below this managed block. Content outside the block is preserved when the guidelines are synced.
<!-- esoul-guidelines:end frontend -->
