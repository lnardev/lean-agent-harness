# Diagram kinds and Mermaid input

| Question | Draw | Layout |
| :--- | :--- | :--- |
| What is it made of? | Architecture | Zones as columns, ordered left to right by data flow |
| How does a process run? | Flow | One main path; each branch sits beside the step that owns it |
| Where does data go? | Pipeline | Sources, transforms, sinks; badges name the format or protocol |
| Who calls whom, in order? | Sequence | Participants as columns, time downward, returns dashed |

One diagram answers one question. If two kinds are needed, make two files.

## Mermaid input

Read the topology and meaning, then redraw with this skill's template. Never copy Mermaid styling.

- `flowchart` / `graph`: Flow, or Architecture for a component map.
- `sequenceDiagram`: Sequence.
- `erDiagram`: see `references/erd.md`.
- `stateDiagram` / `classDiagram`: no template here. Draw states or types as nodes and transitions or relations as labeled connectors, and say the kind was approximated.
