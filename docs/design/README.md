# Tacit design language — "Liquid Glass"

One visual system for every Tacit surface (Landing, Capture, Debrief, Teach, Work Map, Company Map, Role Memory, Ontology), derived from the *Tacit Desktop Redesign* mockups. It is built so the **look**, the **task** and the **companion's state** can change independently.

| File | What it is |
|---|---|
| `tokens.css` | Reference palette → semantic tokens → themes, task modes, companion states. **The source of truth.** |
| `components.css` | `tc-*` component classes. Reads semantic tokens only. |
| `gallery.html` | Living reference. Open it in a browser (`?theme=dark&mode=teach`), or serve `docs/design/`. |

Not yet wired into the app: `app/globals.css` and `components/ui/**` are lane D's. See [Adopting](#adopting-lane-d).

## 1. Principles (the "why" behind every rule)

1. **The work stays solid; Tacit floats.** The ERP / the form / the map is opaque and familiar. Only things that sit *above* the work (companion, panels, toolbars) are glass. Never put blur on the thing the user is working in.
2. **Light is the signal, never the only signal.** The companion tells its state by glow; every glow is paired with a text label (`aria-live="polite"`). Colour alone never carries meaning.
3. **Quiet by default.** Pearl, hairlines, low contrast chrome. Colour is spent on *meaning* (state, status, provenance), not decoration.
4. **Honest badges.** Anything shown must say where it came from: *said by the expert*, *seen on screen*, *inferred*. Fallback modes are labelled as fallback. (Mirrors AGENTS.md §4.5.)
5. **One accent at a time.** Each surface serves one task; the task owns the accent. Status colours are separate and never change with the task.
6. **Motion is ambient, never a pop-up.** The companion breathes and changes light; it doesn't slide in or steal focus. Off-the-record is *still* — stillness is its signal.

## 2. Three independent axes

Set as attributes on `<html>` or any section. They compose freely.

```html
<html data-theme="dark" data-mode="teach">
  …
  <div class="tc-companion tc-float tc-rim" data-state="stepsin">…</div>
```

| Axis | Values | Changes | Doesn't change |
|---|---|---|---|
| `data-theme` | `light` (default) · `dark` · `contrast` | surfaces, text, lines, shadows, ink lightness | meaning of any colour |
| `data-mode` | `capture` amber · `debrief` violet · `teach` green · `map` blue · `neutral` | `--tc-accent*`, `--tc-on-accent` (primary button, eyebrow, selected row, quote bar, focus halo) | status colours, provenance, state glow |
| `data-state` | `quiet` · `listening` · `asking` · `understood` · `offrecord` · `stepsin` | companion orb, glow, halo, rim, cadence | everything outside the companion |

Mode ↔ product phase matches the mocks' session colours: capture `#f5a623`, debrief `#8f7bff`, teach `#22b45e`.

**Companion states**

| State | Light | Meaning | Cadence |
|---|---|---|---|
| quiet | pearl | watching, saying nothing while you type, read or talk | 4.4 s |
| listening | green | mic open; your words become the reason on the map | 1 s |
| asking | amber | a pause was found; one question about what's on screen | 1.8 s |
| understood | violet | zero open slots **and** the expert's explicit yes | 2 s |
| offrecord | red-striped | struck; nothing sent; last exchange and its frames gone | none |
| stepsin | ember | Teach only: a guardrail is about to be broken | 1.6 s |

## 3. Foundations

**Colour roles** — always use roles, never hexes.

| Role | Token | Use |
|---|---|---|
| Text | `--tc-text`, `-2`, `-3` | primary / secondary / tertiary (all ≥ 4.5:1 on their surface) |
| Accent | `--tc-accent` (fill/glow), `--tc-accent-ink` (text), `-soft` (tint), `-grad` + `--tc-on-accent` (primary button) | task identity |
| Status | `--tc-{ok,warn,risk,danger,info}-{ink,fill,soft}` | ink = text, fill = dot/meter/glow, soft = background |
| Provenance | `--tc-src-{said,seen,inferred}` | amber / grey / violet dots, always with words |
| Surface | `--tc-surface` (glass) · `-strong` · `-solid` · `-sunken` | float / emphasis / ground / well |

**Contrast rule (measured, not assumed).** The mocks' `#8e8e93` (used ~30× for secondary text) is **3.26:1 on white and fails AA**; likewise `#1b8a4b` green (4.39) and `#8f7bff` violet (3.26) as text. These hues are kept for fills and glows (`*-glow`, `--tc-ref-ink-500`) but text uses the separate `*-ink` tokens (`#6e6e73` 5.07 · `#17703d` 6.14 · `#5a46c9` 6.66 · `#a35f00` 5.01 amber). Rule: **fills may be pastel; text may not.**

**Type** — system UI stack (SF Pro → IBM Plex Sans fallback, as in the mocks); mono for IDs, timestamps, amounts (`tc-mono`). Scale 11 · 12 · 14 · 15 · 18 · 22 · 32 · display(40–72). Display is tight (`-0.035em`, weight 700); eyebrows are 12 px uppercase `+0.1em` in accent-ink. Roles: `tc-display / title / heading / body / small / meta / eyebrow / label`.

**Shape** — radii 8 (field) · 18 (card) · 22 (float) · pill (buttons, chips, segmented). Spacing 4-pt (`--tc-ref-space-*`). Control heights 28 / 34 / 44 (44 = touch + primary side controls).

**Elevation** — never a flat drop shadow. Each level = *inner 1 px top highlight* + *0.5 px hairline* + *soft ambient*. `shadow-1` chip/button · `-2` card · `-3` floating companion. Lines are 0.5 px on glass, 1 px on solid.

**The rim** — an animated conic pastel hairline (`.tc-rim`) is the one "this is Tacit" signature. Use it on the companion, the primary card of a view, and nowhere else more than once per screen. It recolours with `data-state` and is removed in the contrast theme.

**Motion** — 120 / 200 / 420 ms, `cubic-bezier(.22,1,.36,1)`. Ambient loops (rim hue, breathing, ripple) stop under `prefers-reduced-motion`; state is still conveyed by colour + label.

## 4. Components

`tc-card / tc-float / tc-glass / tc-solid / tc-sunken` · `tc-rim` · `tc-btn` (`data-variant` primary/ghost/danger, `data-size` sm/md/lg) · `tc-badge` (`data-tone`, `data-dot`, `data-live`) · `tc-src` (provenance) · `tc-field` + `tc-input` · `tc-seg` · `tc-row` · `tc-quote` · `tc-banner` · `tc-meter` · `tc-ring` · `tc-orb` · `tc-companion`.

Usage rules that aren't obvious from the CSS:

- **One primary button per surface**, and it takes the task accent. "Scratch that" is `danger` (soft until hover), never loud.
- **A quote is the expert's literal words.** `tc-quote` is only for verbatim text; paraphrases use normal body text. (AGENTS.md §4.2.)
- **Every claim, step and relationship carries a `tc-src`.** Don't render a rule without saying whether it was said, seen or inferred.
- **Degraded/fallback → `tc-banner data-tone="warn"`**, stating what the fallback is.
- **Struck / off-the-record content** uses `data-tone="danger"` plus the striped companion; never silently hide it.
- **Dark glass needs the highlight.** Don't override `--tc-highlight`; it's what separates glass from a dark rectangle.

## 5. Extending (without touching components)

| You want | Do this |
|---|---|
| A new **task** (e.g. *audit*) | Add one `[data-mode="audit"]` block in `tokens.css` defining the 5 accent values (+ a dark-theme override for `-ink/-soft/-grad/--tc-on-accent`). Check ink contrast ≥ 4.5:1. |
| A new **theme** (e.g. brand/partner) | Add one `[data-theme="x"]` block re-pointing the semantic tokens listed under `light`. Components don't change. Verify with `gallery.html?theme=x`. |
| A new **companion state** | Add one `[data-state="x"]` block (orb, glow, halo, rim, cadence, ink) **and** a text label in the UI. Add it to the table above. |
| A new **component** | Read only `--tc-*` semantic tokens; expose variants as `data-*` attributes; add it to `gallery.html` and verify in all three themes. |

Gotcha: a `var()` alias resolves where it is *declared*, so never build composite tokens at `:root` from theme-dependent values (that's why there is no `--tc-focus-ring`). When nesting a dark section in a light page, put `data-theme` **and** `data-mode` on the same element.

## 6. Adopting (lane D)

Nothing here replaces existing code. Suggested path, in order, each independently shippable:

1. `import` `docs/design/tokens.css` + `components.css` (copy to `app/` or `styles/`) next to `globals.css`; set `data-theme="dark"` on `<html>` to keep today's look.
2. Map today's tokens: `--color-bg → --tc-bg`, `--color-panel → --tc-surface-solid`, `--color-line → --tc-line-solid`, `--color-ink → --tc-text`, `--color-muted → --tc-text-3`, `--color-amber → --tc-accent`, `--color-green/red/blue → --tc-ok/danger/info-ink`.
3. Replace `presence-mark-*` with `.tc-orb[data-state]` (`quiet/asking/listening/offrecord` map 1:1; `stepsin` and `understood` are new).
4. Move `.btn/.tag/.banner/.panel` to `tc-btn/tc-badge/tc-banner/tc-card` per view; set `data-mode` per route (`/capture` capture, debrief in `/map`, `/teach` teach).

The mock's `tacit-ui.js` `Orb` also tracks the cursor with a specular highlight; that is optional polish and not part of the token system.

## 7. What was verified / not

- Verified: gallery renders without console errors in light, dark, contrast and across modes (headless Chromium screenshots); text-ink contrast ratios computed against their surfaces.
- Not verified: Safari/Firefox (relies on `backdrop-filter`, `@property`, `mask-composite`; graceful fallbacks to solid surface / static rim are in place but untested), real-device touch targets, and any integration with the live Next.js app.
