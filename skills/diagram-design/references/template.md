# Structural SVG Template

```xml
<svg xmlns="[http://www.w3.org/2000/svg](http://www.w3.org/2000/svg)" viewBox="0 0 1200 680" width="100%" height="100%" role="img">
  <defs>
    <marker id="arrow" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="#4f5d75"/>
    </marker>
    <marker id="arrow-accent" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="#eb6c36"/>
    </marker>
  </defs>

  <!-- Canvas Background -->
  <rect width="100%" height="100%" fill="#f5f5f5"/>

  <!-- Zones (Painted first) -->
  <rect x="40" y="80" width="320" height="500" rx="8" fill="none" stroke="rgba(45,49,66,0.12)" stroke-width="1"/>
  <text x="60" y="100" fill="#4f5d75" font-family="'Geist Mono', monospace" font-size="8" letter-spacing="0.1em">COLLECTION</text>

  <!-- Connectors (Drawn before nodes to keep stroke under boxes) -->
  <path d="M 280 180 L 380 180 Q 388 180 388 188 L 388 240" fill="none" stroke="#4f5d75" stroke-width="1.2" marker-end="url(#arrow)"/>
  
  <!-- Connector Masked Badge -->
  <rect x="320" y="172" width="28" height="16" rx="2" fill="#f5f5f5"/>
  <text x="334" y="183" fill="#4f5d75" font-family="'Geist Mono', monospace" font-size="8" text-anchor="middle">CSV</text>

  <!-- Node Box Example -->
  <rect x="60" y="140" width="220" height="72" rx="6" fill="#ffffff" stroke="#2d3142" stroke-width="1"/>
  <text x="80" y="170" fill="#2d3142" font-family="'Geist', sans-serif" font-size="12" font-weight="600">Point-of-Sale Exports</text>
  <text x="80" y="190" fill="#4f5d75" font-family="'Geist Mono', monospace" font-size="9">nightly · CSV</text>
</svg>
```
