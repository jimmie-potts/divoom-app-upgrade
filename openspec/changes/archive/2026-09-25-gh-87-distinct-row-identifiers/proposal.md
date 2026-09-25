## Why

[Issue #87](https://github.com/jimmie-potts/divoom-app-upgrade/issues/87): every unlabeled row on the installed Pixoo monitor read `01A0D+`. An unlabeled row showed the first five characters of its session ID, and Codex session IDs are time-ordered, so sessions from the same period share that prefix. The trailing `+` is a truncation marker, but it is also a label character and the child-count prefix, so it reads as content.

## What Changes

- An unlabeled row shows the end of its session ID, the part that differs between time-ordered IDs, instead of the start.
- A long label keeps its first and last characters, so labels that differ only at the end, such as issue numbers, stay distinct.
- Truncation uses a dedicated ellipsis glyph outside the label alphabet. Its position shows which part was removed: a leading marker for an ID tail and a middle marker for a label.
- The synthetic examples gain four unlabeled sessions whose IDs share a prefix. The committed preview and the monitoring documentation describe the rule.
- Labels still come only from the owner. No title, prompt or path becomes a label, and the rendition's `label` field still carries the full label or ID.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `agent-dashboard-renderer`: adds distinct row identifiers. Short row identifiers fall back to the session ID's end, keep both ends of long labels, and mark truncation with a glyph that no label character can produce.

## Impact

Changes cover `apps/server` (the row identifier rule, the renderer's marker glyph and the synthetic examples), tests, the committed preview and `docs/agent-monitoring.md`. The rendition API keeps its shape; only `shortLabel` values change. The now-playing card, the hub, the shared vocabulary and the `pixoo-integration/1.0` contract are unchanged. Installing the updated app and checking the physical display need the owner's separate go-ahead.
