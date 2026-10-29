---
name: design-ccbp-in
description: Design system extracted from NxtWave (https://www.ccbp.in/). Use when building UI that should match this brand's visual identity.
triggers:
  - "NxtWave"
  - "ccbp-in"
  - "design like NxtWave"
  - "NxtWave風"
source: https://www.ccbp.in/
extractedAt: 2026-10-28T06:21:02.259Z
tags: ["light", "rounded", "accented", "sans-serif"]
---
# Design System Inspired by NxtWave

> Auto-extracted from `https://www.ccbp.in/` on 2026-10-28

## 1. Visual Theme & Atmosphere

Friendly, approachable design with rounded shapes and generous whitespace.

The hero section leads with "Designed to transform you into a highly skilled Software Professional".

**Key Characteristics:**
- sofia-pro as the heading font
- Inter as the body font for all running text
- Heading weight 600, letter-spacing -1px
- Light/white background (#f8fafc) as the primary canvas
- Primary accent `#1565d8` used for CTAs and brand highlights
- 4 shadow level(s) detected — tinted shadows
- Rounded corners (16px+) creating a friendly, approachable feel
- Tags: light, rounded, accented, sans-serif

## 2. Color Palette & Roles

### Primary
- **Primary Accent** (`#1565d8`) · `--color-primary`: Brand color, CTA backgrounds, link text, interactive highlights.
- **Secondary Accent** (`#2563eb`) · `--color-secondary`: Secondary brand, hover states, complementary highlights.
- **Background** (`#f8fafc`) · `--color-bg`: Page background, primary canvas.
- **Background Secondary** (`#dddddd`) · `--color-bg-secondary`: Cards, surfaces, alternating sections.

### Text
- **Text Primary** (`#333333`) · `--color-text`: Headings and body text.
- **Text Secondary** (`#475569`) · `--color-text-secondary`: Muted text, captions, placeholders.

### Borders & Surfaces
- **Border** (`#f9fbfe`) · `--color-border`: Dividers, outlines, input borders.

### Full Extracted Palette

| # | Hex | CSS Variable | Role | Area | Contrast |
|---|---|---|---|---|---|
| 1 | `#ffffff` | `--palette-1` | section | large | text-dark |
| 2 | `#dddddd` | `--palette-2` | section | large | text-dark |
| 3 | `#1565d8` | `--palette-3` | text-accent | medium | text-light |
| 4 | `#2563eb` | `--palette-4` | button | medium | text-light |
| 5 | `#183b56` | `--palette-5` | text-accent | medium | text-light |
| 6 | `#d1d8dd` | `--palette-6` | button | medium | text-dark |
| 7 | `#475569` | `--palette-7` | text-accent | medium | text-light |
| 8 | `#e0e7ff` | `--palette-8` | button | small | text-dark |
| 9 | `#cffafe` | `--palette-9` | button | small | text-dark |
| 10 | `#5a7184` | `--palette-10` | text-accent | small | text-light |
| 11 | `#1e293b` | `--palette-11` | text-accent | small | text-light |

## 3. Typography Rules

- **Heading Font:** `sofia-pro`, sans-serif
- **Body Font:** `Inter` (web font)

### Type Hierarchy

| Role | Font | Size | Weight | Line Height | Letter Spacing |
|---|---|---|---|---|---|
| H1 | sofia-pro | 48px | 600 | 64px | -1px |
| H2 | Inter 600 | 20px | 600 | 32px | normal |
| H3 | Inter 500 | 24px | 500 | 38px | normal |
| H4 | Inter 600 | 14px | 600 | 17px | 0.2px |
| Body | Inter 500 | 14px | 500 | 15px | normal |
| Small | Inter | 14px | 500 | 20px | normal |

### Type Scale

| Token | Size | Suggested Usage |
|---|---|---|
| Display | `48px` | headings |
| H1 | `44px` | headings |
| H2 | `40px` | headings |
| H3 | `38px` | headings |
| H4 | `32px` | headings |
| Body L | `28px` | body / supporting text |
| Body | `26px` | body / supporting text |
| Small | `24px` | body / supporting text |
| XS | `21px` | body / supporting text |
| Caption | `20px` | body / supporting text |

## 4. Component Stylings

### Primary Button

```css
.btn-primary {
  background: transparent;
  color: #0082f3;
  border-radius: 0px;
  padding: 12px 20px;
  font-size: 16px;
  font-weight: 500;
  border: none;
  cursor: pointer;
}
```

### Ghost Button

```css
.btn-ghost {
  background: transparent;
  color: #222222;
  border-radius: 0px;
  padding: 20px 20px;
  font-size: 14px;
  font-weight: 400;
  border: none;
  cursor: pointer;
}
```

### Ghost Button 2

```css
.btn-ghost-2 {
  background: transparent;
  color: #183b56;
  border-radius: 0px;
  padding: 20px 20px;
  font-size: 16px;
  font-weight: 500;
  border: none;
  cursor: pointer;
}
```

### Ghost Button 3

```css
.btn-ghost-3 {
  background: transparent;
  color: #1565d8;
  border-radius: 0px;
  padding: 12px 20px;
  font-size: 16px;
  font-weight: 600;
  border: none;
  cursor: pointer;
}
```

### Filled Button

```css
.btn-filled {
  background: #ffffff;
  color: #0000ee;
  border-radius: 12px;
  padding: 12px 32px;
  font-size: 14px;
  font-weight: 400;
  border: 1px solid rgb(203, 213, 225);
  cursor: pointer;
}
```

### Filled Button 2

```css
.btn-filled-2 {
  background: #2563eb;
  color: #0000ee;
  border-radius: 12px;
  padding: 12px 32px;
  font-size: 14px;
  font-weight: 400;
  border: none;
  cursor: pointer;
}
```

### Card

```css
.card {
  background: #ffffff;
  border-radius: 16px;
  padding: 24px;
}
```

## 5. Layout Principles

- **Base spacing unit:** `185.359px` — use multiples (370.718px, 556.077px, 741.436px, etc.)

### Spacing Scale (extracted from real elements)

| Token | Value | Role |
|---|---|---|
| spacing-1 | `185.359px` | section |
| spacing-2 | `12px` | element |
| spacing-3 | `24px` | card |
| spacing-4 | `8px` | element |
| spacing-5 | `96px` | section |
| spacing-6 | `2px` | element |
| spacing-7 | `20px` | element |
| spacing-8 | `16px` | element |

### Border Radius Scale

| Token | Value | Element |
|---|---|---|
| radius-card | `16px` | card |
| radius-subtle | `1px` | subtle |
| radius-button | `8px` | button |
| radius-button | `12px` | button |
| radius-pill | `100px` | pill |
| radius-subtle | `3px` | subtle |

## 6. Depth & Elevation

| Level | Shadow | Usage |
|---|---|---|
| Low | `rgba(96, 97, 112, 0.16) 1px 1px 2px 0px` | Cards, subtle elevation |
| Low | `rgba(0, 0, 0, 0.08) 0px 1px 0px 0px, rgba(0, 0, 0, 0.2) 0px -1px 0px 0px` | Cards, subtle elevation |
| Low | `rgba(0, 0, 0, 0.08) 0px 1px 2px 0px` | Cards, subtle elevation |
| High | `rgba(0, 0, 0, 0.08) 8px 8px 16px 0px` | Modals, floating elements |

> **Note:** This site uses chromatic (color-tinted) shadows rather than pure black — this is a deliberate brand choice that adds warmth to elevation.

## 7. Do's and Don'ts

### Do
- Use `#f8fafc` as the primary background color
- Use `sofia-pro` for all headings and `Inter` for body text
- Use `#1565d8` as the single dominant accent/CTA color
- Maintain `185.359px` as the base spacing unit — all gaps should be multiples
- Use rounded corners (`16px`+) consistently for all interactive elements
- Apply the shadow system for elevation — use the extracted shadow values
- Use weight 600 for headings to match the brand's typographic voice

### Don't
- Don't use colors outside the extracted palette without justification
- Don't substitute sofia-pro/Inter with generic alternatives
- Don't use irregular spacing — stick to 185.359px grid
- Don't use dark/black backgrounds — this is a light-themed design
- Don't use sharp corners — they feel hostile in this rounded design language
- Don't use pure black (#000000) for text — use `#333333` instead
- Don't add decorative elements not present in the original design — no badges, ribbons, banners, or ornaments unless the source site uses them
- Don't invent UI patterns the source site doesn't have — if the original has no NEW badge, don't add one just because a red is in the palette

## 8. Responsive Behavior

| Breakpoint | Width | Notes |
|---|---|---|
| Mobile | < 640px | Single column, stack sections, reduce font sizes ~80% |
| Tablet | 640–1024px | 2-column where appropriate, maintain spacing ratios |
| Desktop | 1024–1440px | Full layout as designed |
| Wide | > 1440px | Max-width container, center content |

- Touch targets: minimum 44×44px on mobile
- Maintain 185.359px base unit across breakpoints — only scale multipliers

## 9. Agent Prompt Guide

### Quick Color Reference

```
Background:  #f8fafc
Text:        #333333
Accent:      #1565d8
Secondary:   #2563eb
Border:      #f9fbfe
```

### Example Prompts

1. "Build a hero section with a `#f8fafc` background, `sofia-pro` heading in `#333333`, and a `#1565d8` CTA button with 12px radius."
2. "Create a pricing card using background `#dddddd`, border `#f9fbfe`, `Inter` for text, and 556.077px padding."
3. "Design a navigation bar — `#f8fafc` background, `#333333` links, `#1565d8` for active state."
4. "Build a feature grid with 3 columns, 556.077px gap, each card using the card component style."
5. "Create a footer with `#333333` background, `#f8fafc` text, and 370.718px padding."

### Iteration Guide

1. Start with layout structure (sections, grid, spacing)
2. Apply colors from the palette — background first, then text, then accents
3. Set typography — font families, sizes from the type scale, weights
4. Add components — buttons, cards, inputs using the specs above
5. Apply border-radius consistently across all elements
6. Add shadows for depth — use the extracted shadow values, not defaults
7. Check responsive behavior — test mobile and tablet layouts
8. Final pass — verify all colors match, spacing is consistent, fonts are correct

## 10. CSS Custom Properties

> 102 custom properties extracted from `:root` / `html` stylesheets.

### Color Variables

| Variable | Value |
|---|---|
| `--heading-blue` | `#183b56` |
| `--485ed7` | `#183b56` |
| `--black-10-11` | `#0000001a` |
| `--_apps---colors--background` | `#f7f9fc` |
| `--_apps---colors--card-foreground` | `#060606` |
| `--_apps---colors--popover` | `#ebebeb` |
| `--_apps---colors--popover-foreground` | `#060606` |
| `--_apps---colors--primary` | `#1565d8` |
| `--_apps---colors--primary-foreground` | `#f4f9ff` |
| `--_apps---colors--secondary` | `#d3f0ff` |
| `--_apps---colors--secondary-foreground` | `#0a0d13` |
| `--_apps---colors--muted` | `#f2f2f2` |
| `--_apps---colors--muted-foreground` | `#777374` |
| `--_apps---colors--accent` | `#dedede` |
| `--_apps---colors--accent-foreground` | `#0d0d0d` |
| `--_apps---colors--destructive` | `#d74843` |
| `--_apps---colors--border` | `#5a7184` |
| `--_apps---colors--input` | `#5d7487` |
| `--_apps---colors--ring` | `#346abe` |
| `--_apps---charts--chart-1` | `#1565d8` |
| `--_apps---charts--chart-2` | `#5689da` |
| `--_apps---charts--chart-3` | `#0052d1` |
| `--_apps---charts--chart-4` | `#054aa7` |
| `--_apps---charts--chart-5` | `#00288b` |
| `--_apps---sidebar--sidebar` | `#f2f2f2` |
| `--_apps---sidebar--sidebar-foreground` | `#060606` |
| `--_apps---sidebar--sidebar-primary` | `#1565d8` |
| `--_apps---sidebar--sidebar-primary-foreground` | `#f4f9ff` |
| `--_apps---sidebar--sidebar-accent` | `#dedede` |
| `--_apps---sidebar--sidebar-accent-foreground` | `#0d0d0d` |
| ... | *(51 more)* |

### Spacing Variables

| Variable | Value |
|---|---|
| `--_apps---sizes--radius` | `8px` |
| `--toastify-toast-width` | `320px` |
| `--toastify-toast-min-height` | `64px` |
| `--toastify-toast-max-height` | `800px` |
| `--toastify-z-index` | `9999` |

### Typography Variables

| Variable | Value |
|---|---|
| `--_apps---typography--heading-font` | `Satoshi,sans-serif` |
| `--_apps---typography--body-font` | `Inter,sans-serif` |
| `--_apps---typography--button-font` | `Satoshi,sans-serif` |
| `--toastify-font-family` | `sans-serif` |

### Other Variables

| Variable | Value |
|---|---|
| `--white` | `white` |
| `--black-10` | `transparent` |
| `--_apps---colors--foreground` | `var(--heading-blue)` |
| `--_apps---colors--card` | `var(--white)` |
| `--toastify-icon-color-info` | `var(--toastify-color-info)` |
| `--toastify-icon-color-success` | `var(--toastify-color-success)` |
| `--toastify-icon-color-warning` | `var(--toastify-color-warning)` |
| `--toastify-icon-color-error` | `var(--toastify-color-error)` |
| `--toastify-color-progress-info` | `var(--toastify-color-info)` |
| `--toastify-color-progress-success` | `var(--toastify-color-success)` |
| `--toastify-color-progress-warning` | `var(--toastify-color-warning)` |
| `--toastify-color-progress-error` | `var(--toastify-color-error)` |
