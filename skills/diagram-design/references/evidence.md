# Source-backed diagrams

When the diagram describes a real codebase or deployment:

1. Read the entry points and the files that implement the behavior before placing a node. Trace the requested path end to end.
2. Draw the main path first, then only the branches that change behavior (conditions, retries, auth, fallbacks). Name each condition on its connector badge.
3. Put the source in each node's sublabel (a file or module name). Never invent a component.
4. State what was left out: the abstraction level, merged parts, and any value that is illustrative rather than measured.
5. Check every claim the diagram makes against the code before delivering. A label you cannot back is removed, not softened.

The template teaches shape, not facts: never reuse its names or numbers.
