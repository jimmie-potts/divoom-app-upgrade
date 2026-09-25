## Context

A row has six 3×5 glyph cells for its identifier, at x=12 to 35, before the child count at x=40. The shared 3×5 alphabet includes `+`, which the child count also uses. The now-playing card maps characters outside that alphabet to `-`, so adding a character to the alphabet would change card output. [Hub #364](https://github.com/jimmie-potts/agent-device-hub/issues/364) proposes a shared neutral alias but is in the backlog. [Issue #98](https://github.com/jimmie-potts/divoom-app-upgrade/issues/98) will redesign the layout and choose its own identifier width.

## Goals / Non-Goals

**Goals:** distinct identifiers for unlabeled sessions from the same period, a truncation marker that cannot be read as content, and a rule that #98 can reuse at another width.

**Non-Goals:** automatic labels, a renderer-assigned alias, row layout changes, and changes to the now-playing card.

## Decisions

- **The ID fallback is the ID's end.** Codex IDs are time-ordered UUIDs, whose final characters are random; Claude IDs are random throughout. A renderer ordinal was rejected: it changes when sessions come and go, differs after a restart, and does not match anything shown in the Monitor tab. A shared alias belongs to the hub through Hub #364. When that alias lands, it can replace this fallback.
- **Long labels keep both ends.** With width `w`, a label keeps its first `ceil((w-1)/2)` and last `floor((w-1)/2)` display characters, 3 and 2 in a six-cell row. Labels chosen per task often differ only in a trailing number, which head-only truncation hides. Head-only truncation was rejected for that reason.
- **The marker is a dedicated glyph.** `…` (two dots on the baseline) is drawn by the shared text renderer but is not in the label alphabet, so a label or ID character maps to `?` instead of producing it. It stays out of the now-playing card's alphabet, so card output is unchanged. Its position tells which part was removed. Shortening without a marker was rejected because a six-character prefix of an ID would look like a complete label.
- **The width is one constant.** #98 changes the width; the head, tail and marker rules stay.

## Risks / Trade-offs

- [Two different IDs share their last five characters] → For four visible time-ordered UUIDs this is about one chance in 175,000. The Monitor tab shows the full IDs, and Hub #364 would give unique aliases.
- [Two different labels share their first three and last two characters] → The owner chooses labels, sees them in full in the Monitor tab, and can pick a label of six characters or fewer, which is shown whole.
- [The two-dot marker is small at native size] → Its shape differs from `.`, `_` and `,`. Physical readability is unverified, as for every glyph, and needs the owner's separate physical check.
