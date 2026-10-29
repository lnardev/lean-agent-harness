---
name: diagram-design
description: Generates publication-grade editorial architecture, system flow, data pipeline, and sequence diagrams as standalone HTML files with inline SVG and CSS.
---

# Editorial Diagram Design

Generate clean, publication-grade diagrams as single, self-contained HTML files (inline SVG + CSS). Never use generic dark-cyan glows, default Mermaid layouts, or diagonal connector lines.

## Visual DNA & Color Palette

- **Paper (Background):** `#f5f5f5` (flat canvas).
- **Ink (Text & Dominant Strokes):** `#2d3142`.
- **Muted (Secondary Text & Standard Lines):** `#4f5d75`.
- **Borders & Dividers:** `rgba(45, 49, 66, 0.12)`.
- **Accent (Bottlenecks / Critical Focus):** `#eb6c36` (coral/terracotta; max 1–2 focal nodes per diagram).
- **External / Loose Boundaries:** Dashed stroke (`stroke-dasharray="4,4"`).

## Typography (Google Fonts)

Embed in HTML header:
`<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500;600&display=swap" rel="stylesheet">`

- **Diagram Title:** `Instrument Serif`, 28px, normal weight.
- **Node Names:** `Geist` (sans), 12px, weight 600.
- **Sublabels & Metadata:** `Geist Mono`, 9px (ports, protocols, batch intervals).
- **Connector Badges / Eyebrows:** `Geist Mono`, 7–8px, uppercase, tracked (`letter-spacing: 0.08em`).

## SVG Geometry & Layout Standards

1. **4px Grid Discipline:** All coordinates (`x`, `y`), dimensions (`width`, `height`), paddings, and gaps must be multiples of 4.
2. **Orthogonal Connectors Only:** Never draw diagonal slanted lines between off-axis nodes. Every bend must be a right-angle elbow with rounded corner (`r=8`). Reserve straight `<line>` strictly for nodes sharing identical axes.
3. **Masked Connector Badges:** Place protocol/data labels (e.g., `CSV`, `XLSX`, `LOAD`) inside an opaque `<rect>` filled with `#f5f5f5` (`rx=2`). Maintain a 6px–10px visible gap from the line stroke so the label never cuts through the arrow.
4. **Zones & Functional Containers:** Group steps into broad columns/areas (e.g., `COLLECTION`, `PROCESSING`, `DISSEMINATION`). Use a 1px border (`rgba(45,49,66,0.12)`), rounded corners (`rx=8`), and an uppercase mono title tab at the top-left.
5. **Node Hierarchy:**
   - *Standard:* `#ffffff` fill, 1px `#2d3142` stroke, 6px radius (`rx=6`).
   - *Bottleneck / Pain-point:* `#fbeee8` fill (`rgba(235,108,54,0.08)`), `#eb6c36` stroke.
   - *External:* Transparent or white fill, dashed border (`stroke-dasharray="4,4"`).
6. **Horizontal Bottom Legend:** Position a horizontal legend strip below the diagram nodes, separated by a full-width hairline rule.

## Structural SVG Template

Load `references/template.md` before writing the SVG (markers, zones, connectors, masked badge, node box).
