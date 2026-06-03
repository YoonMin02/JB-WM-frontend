# JB Financial Group Brand Design Reference

Extracted from the official JB Financial Group website (`www.jbfg.com`).
Use this as the source of truth for all visual design decisions in the JB AI frontend.

---

## Typography

### Font Families

| Role | Font | Notes |
|---|---|---|
| Primary (ko + en) | **SUIT Variable** | Open-source Korean variable font. Use for all body, UI, Korean headings. |
| English emphasis | **roc-grotesk** | Adobe Typekit (weights 500, 600). Use for English-only accent text, numbers. |
| Fallback | `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif` | System fonts |

Install SUIT Variable:
```html
<!-- In index.html <head> -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/sunn-us/SUIT@latest/fonts/variable/woff2/SUIT-Variable.css" />
```

### Font Settings

```css
/* Base */
font-size: clamp(16px, 0.9375vw, 24px);  /* fluid responsive */
font-weight: 600;
letter-spacing: -0.02em;
word-break: keep-all;                      /* Korean line break rule */
line-height: 1;
```

### Type Scale

| Class | rem | px (at 16px) | Usage |
|---|---|---|---|
| `headline-1` | 4.889rem | ~78px | Hero / main banner |
| `headline-2` | 3.556rem | ~57px | Section hero |
| `headline-3` | 2.667rem | ~43px | Section title |
| `title-0` | 4rem | ~64px | Special large |
| `title-1` | 2.222rem | ~36px | Page title |
| `title-2` | 1.778rem | ~28px | Card title |
| `title-3` | 1.333rem | ~21px | Sub-title |
| `title-4` | 1.222rem | ~20px | Label title |
| `body-1` | 1.111rem | ~18px | Large body |
| `body-2` | 1rem | 16px | Default body |
| `body-3` | 0.889rem | ~14px | Small / caption |
| `body-4` | 0.778rem | ~12px | Extra small |

All headings: `line-height: 1.2`, `letter-spacing: -0.02em`
Paragraphs: `line-height: 1.4` to `1.6`

---

## Color Palette

### Primary Blue

| Token | Hex | Usage |
|---|---|---|
| `blue-950` | `#0B235B` | Darkest navy, deep bg |
| `blue-900` | `#0A31A8` | **Primary brand** — body bg, filled buttons, active states |
| `blue-850` | `#0D2A8A` | Variant |
| `blue-800` | `#0D2D77` | Variant |
| `blue-750` | `#123ECC` | Variant |
| `blue-700` | `#1C56FF` | **Interactive accent** — links, highlight text, hover |
| `blue-600` | `#1850FF` | Variant |
| `blue-400` | `#598AFF` | Mid blue |
| `blue-300` | `#7AA1FF` | Light blue |
| `blue-200` | `#26A2F8` | Sky blue |
| `blue-100` | `#31B6F0` | Light sky |
| `blue-50` | `#F0F4FF` | Tinted background |

### Text

| Token | Hex | Usage |
|---|---|---|
| `text-primary` | `#333333` | Default body text |
| `text-secondary` | `#444444` | Secondary text |
| `text-muted` | `#666666` | Muted / descriptions |
| `text-light` | `#848484` | Light / captions |
| `text-disabled` | `#999999` | Disabled / placeholder |

### Gray / Neutral

| Token | Hex | Usage |
|---|---|---|
| `gray-400` | `#B2B2B2` | Language toggle, inactive |
| `gray-300` | `#D5DBE5` | Borders |
| `gray-200` | `#E5E5E5` | Dividers, button border |
| `gray-100` | `#F3F3F3` | Light bg |
| `gray-50` | `#F6F7FB` | Near-white bg |
| `gray-25` | `#FAFAFA` | Near-white |

### Accent

| Token | Hex | Usage |
|---|---|---|
| `green-400` | `#51E3A4` | Positive indicator |
| `green-200` | `#9ECFA9` | Muted green |
| `error` | `#FF0000` | Error state |

### Named Utilities

```css
.bg-white  → #FFFFFF
.bg-blue-grain  → blue textured background image
body background → #0A31A8 (full-page blue, content sections on top)
```

---

## Layout

### Container

```css
padding: 0 3.556rem;  /* ~57px at 16px base */
max-width: 2086px;

/* Boxed variants */
.__lg  → max-width: ~1390px
.__md  → max-width: ~1180px
.__sm  → max-width: ~890px
```

### Border Radius Patterns

| Pattern | Value | Usage |
|---|---|---|
| Pill / capsule | `3em` | Buttons, tags |
| Card large | `clamp(16px, 3.125vw, 1.778rem)` | Content cards |
| Card medium | `clamp(12px, 2.344vw, 1.333rem)` | UI cards |
| Rounded large | `clamp(26px, 4.297vw, 2.444rem)` | Large sections |
| Rounded header | `0 0 clamp(22px, 3.906vw, 2.222rem) clamp(22px, 3.906vw, 2.222rem)` | Header bottom |

---

## Components

### Button

```css
/* Default capsule button */
height: 3.111em;
padding: 0 2em;
border-radius: 3em;
border: 1px solid #E5E5E5;
background: #FFFFFF;
font-weight: 700;
transition: background 200ms, color 200ms;

/* Hover */
background: #0A31A8;
color: #FFFFFF;
border-color: #0A31A8;

/* Filled primary */
background: #0A31A8;
border-color: #0A31A8;
color: #FFFFFF;

/* Outline primary */
border-color: #0A31A8;
color: #0A31A8;
```

### Header

```css
height: 6.111rem;           /* ~98px desktop */
height: 62px;               /* mobile */
position: fixed;
z-index: 9999;

/* Default (light) */
--color: #333333;
--bg: #FFFFFF;

/* Dark theme (on hero images) */
--color: #FFFFFF;
--bg: rgba(0, 0, 0, 0.2);

/* Opaque (scrolled) */
--color: #333333;
--bg: #FFFFFF;
backdrop-filter: blur(50px);
```

### Language Toggle (ko / en)

```css
font-size: 0.778rem;
font-weight: 800;
color-inactive: #B2B2B2;
color-active: #0A31A8;
separator: 1px #B2B2B2;
```

---

## Responsive Breakpoints

| Breakpoint | Width | Notes |
|---|---|---|
| Desktop | > 1279px | Full navigation visible |
| Tablet | ≤ 1024px | Reduced font sizes |
| Mobile | ≤ 680px | Single column, 62px header |

---

## Tailwind Config

See `tailwind.config.ts` in the project root for the mapping of these tokens.
The CSS class names above use em/rem relative units — Tailwind values use the
pixel equivalents at the 16px base.
