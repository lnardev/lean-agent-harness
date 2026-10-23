---
name: impeccable
description: High-craft frontend UI/UX design, layout, spacing, typography, and visual polish across web and mobile interfaces.
---

# Impeccable UI Craft

Produce production-ready, distinct, and high-fidelity interfaces. Avoid generic placeholder designs, timid component library defaults, and visual clutter.

## Craft Principles

1. **Visual Hierarchy & Typography:**
   - Intentional typographic scale: distinct contrast between display, headers, and body text.
   - Generous line-height for readability (`1.5` - `1.6` on body), tight tracking on large headings.
   - Avoid washed-out low-contrast gray text; strictly maintain WCAG AA contrast ratios.

2. **Spacing & Layout Rhythm:**
   - Strict 4px/8px spatial grid for all margins, padding, and gaps.
   - Purposeful whitespace: group related elements tightly, separate distinct sections generously.
   - Mobile-first responsiveness: fluid flex/grid layouts, no horizontal scroll overflows.

3. **Color & Surface Depth:**
   - Cohesive palette: 1 dominant background tone, subtle border/surface elevations, and 1 sharp accent color for key actions.
   - Avoid flat grey boxes: use subtle borders (`1px solid rgba(...)`), soft layered shadows, or subtle gradients.

4. **Interaction & Micro-details:**
   - Polish interactive states on every control: hover, active, focus-visible, disabled, and loading.
   - Smooth micro-interactions: quick transitions (150ms-250ms ease-out) for state changes.
   - Complete states: always design empty states, error boundaries, and skeleton loaders.

## Banned Patterns

- Pure `#000000` text on pure `#ffffff` backgrounds (use rich slate/zinc tones).
- Default browser focus rings (style distinct `:focus-visible`).
- Giant walls of unchunked text or cluttered dashboard cards.
- Centered body text longer than two lines.