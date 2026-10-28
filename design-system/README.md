Modulate helps people find their next job by showing which roles their skills already connect to, and what the job market says about each one. The interface is a calm, light page wrapped around one dark "console": a subway-style route map with the numbers beside it. Build every screen from that pairing: friendly and readable on the outside, precise and data-led in the middle.

## Content fundamentals

- **Talk to one person, as "you".** "Pick where you are today." "Skills you already have." Modulate is "we" only in short brand lines ("We pull out the skills that travel").
- **Sentence case everywhere**: buttons, headings, labels. Uppercase is reserved for `eyebrow` labels ("ROUTES FROM TEACHER", "SKILL OVERLAP").
- **Buttons start with a verb and say what happens**: "Build my career map", "Plan this route", "Explore an example". One primary action per view.
- **The transit metaphor is the vocabulary.** A career change is a *route*; skills or credentials to pick up are *stops*; the current role is *you are here*; target roles are *destinations*. Use these words consistently, and don't stretch the metaphor further (no "tickets", "fares" or "delays").
- **Data words are plain.** Demand is *Rising*, *Steady* or *Cooling*. Skill overlap is *Very high*, *High*, *Good* or *Moderate*. Prefer a level word over a bare percentage in UI copy.
- **Never invent statistics.** Every number shown must come from the data source. In designs, mark missing facts as bracketed placeholders: `[PAY RANGE]`, `[TIME]`, `[DATA SOURCES]`. Label example or generated charts "Illustrative".
- **No emoji.** Icons are simple stroke glyphs drawn in the component code.

## Visual foundations

### Colour

- The page ground is `surface-page`; cards, tiles and full-width bands are `surface-raised`. Text is `ink` for headings and `ink-muted` for body; captions and sources are `ink-subtle`.
- `blue` is the brand colour: primary buttons, selected chips, route 1, and the italic serif accent words in headings. Links use `blue-text`.
- `coral` is the second brand colour, used in large amounts only once per page: the closing call-to-action band. Text on coral is `ink` or `coral-ink-deep`, never white.
- `surface-inverse` (navy) is a **surface, not a dark mode**. It holds the route map console and nothing else at that scale. On it, text is `on-inverse`, `on-inverse-soft` or `on-inverse-muted`, and inner tiles are `surface-inverse-raised`.
- **Routes always have the same three identities**, in this order:

  | Route | On light | On navy | Text on navy | Marker shape |
  | --- | --- | --- | --- | --- |
  | 1 | `blue` | `blue-light` | `blue-on-inverse` | circle |
  | 2 | `ink` | `on-inverse` | `on-inverse` | square |
  | 3 | `coral-strong` | `coral` | `coral-on-inverse` | diamond |

  Never tell routes apart by colour alone: pair the colour with the route's marker shape in charts and legends, and with its name everywhere else.
- **Trend states** are pills with a word and an arrow: Rising (`blue-tint` / `blue-ink`), Steady (`neutral-tint` / `ink-muted`), Cooling (`coral-tint` / `coral-ink`).
- **Contrast**: every text pair in this system is 4.5:1 or better, and chart marks are 3:1 or better against their ground. `coral-strong` is for marks, not body text. `border-control`, `border` and `border-inverse` fall below 3:1, so they may only frame things that also carry a text label.

### Type

- Two families from Google Fonts: **Instrument Sans** (`sans`) for everything, and **Instrument Serif** (`serif`) for accents and console titles.
- One `display` headline per page, with two to four words switched to `display-accent` (serif italic, `blue`). Section headings use `heading` with the same accent trick at most once each.
- Console and card titles use `panel-title` and `route-title` (serif, regular). Chart titles use `card-title`.
- Body text is `body`; the paragraph under a headline is `lead` in `ink-muted`, max 580px wide.
- Stats use `stat`. Labels above stats and titles use `eyebrow`. Axes, sources and "Illustrative" tags use `meta` in `ink-subtle`.
- Headlines scale fluidly on phones: `display` down to 44px, `heading` down to 32px.

### Layout and spacing

- Content sits in a `content-max` container with a `space-xl` side gutter.
- Lay out siblings with flex or grid and `gap` from the spacing scale; stat tiles use `space-md` (light) or `space-sm` (in the console).
- Rows wrap: cards use `flex: 1 1 <min>px` and grids use `repeat(auto-fit, minmax(min(<min>px, 100%), 1fr))` so everything stacks to one column at phone width.
- The navy console is full width, padded `space-3xl` at desktop, with `radius-2xl` and `shadow-console`. Cards use `radius-xl` and no shadow by default.
- Buttons, chips and pills are fully rounded (`radius-pill`); controls inside a segmented control use `radius-sm`.

### Motion

- Motion supports the data story: lines draw in, bars grow, the selected route's dot travels the map, the ticker scrolls.
- Anything that moves for more than five seconds must stop when the user presses the ticker's **Pause animations** button, and must not start when the user has reduced motion turned on. `Ticker` and `RouteMap` do this already.
- Changing a selection animates values in place (meter width, ring arc, bar heights); don't re-run entrance animations.

### Focus and accessibility

- Every control shows a 3px solid ring, 3px offset: `focus` on light grounds, `focus-on-inverse` inside the console, `focus-on-coral` inside the coral band. Wrap navy areas in `.md-on-inverse` and coral areas in `.md-on-coral` to switch it.
- Selections use real buttons with `aria-pressed`, grouped in a labelled `role="group"`.
- Every chart and the route map has a text alternative that states the trend in words; generated charts say "Illustrative".
- Announce selection changes in a polite live region ("Route 1 selected: Instructional Designer, demand rising").
- Touch targets are at least 44px.

## Iconography

- No icon font or library. The few glyphs (trend arrows, check, pause and play, route marker shapes) are inline stroke SVGs drawn in the components, coloured with `currentColor` or a token, and hidden from screen readers next to visible text.
- The logo mark is `assets/Logos/modulate-mark.svg`: a `blue` disc with a white wave. Set the word "modulate" beside it in Instrument Sans 700, lowercase, `ink`.

## Building pages

Load `tokens.css`, `components/bundle.css`, React 18 and `components/bundle.js`; components are on `window.Modulate`. A typical home page, top to bottom: header (mark, nav, primary button) → `Ticker` → hero (`display`, `lead`, primary and secondary `Button`, role `Chip`s) → navy console (`panel-title`, `SegmentedControl` tone inverse, `RouteMap`, four inverse `StatTile`s) → trend section (`TrendChart` beside a column of `RouteOption`s) → detail card (`route-title`, `OverlapRing`, `SkillList`) beside `OpeningsChart` → data band → coral call to action with an inverse `Button` → footer.
