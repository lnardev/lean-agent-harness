# ERD rules

Same template: a zone is a domain, a node is a table.

- **Table first.** List every physical column inside its table box, one per row: the name, then its SQL type in the mono sublabel style. Never move columns into side cards.
- **Key roles.** Mark each column `PK`, `FK`, `UQ` or a combination (a junction column is `PK FK`). Every `FK` row also names its target as `table.column`.
- **Domains.** One zone per domain, a single solid rectangle: one column, one row or a filled block, never an L shape. Tag it with an uppercase mono title.
- **Several domains:** one domain per column. A wide canvas scales down cleanly; a tall one gets cut.
- **Cardinality** (`1`, `N`, `0..1`) goes on a connector badge at each end. Orthogonal connectors only.
- **Large schemas** (over about 8 tables or 50 columns): draw a first pass with names and keys only, and add types once it still reads.
