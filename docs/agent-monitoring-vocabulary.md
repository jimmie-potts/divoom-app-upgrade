# Agent monitoring vocabulary

Pixoo adopts the released Hub lifecycle contract as its monitoring vocabulary.
This document maps it to consumer requirements. Provider adapters, a state
reducer, browser monitoring panels and device rendering remain later work.

The canonical definitions are the
[delivered Hub lifecycle contract](https://github.com/jimmie-potts/agent-device-hub/blob/855bd3787803dad7245f29e88c758659f6e4eda4/docs/agent-lifecycle-contract.md)
and its [provider qualification record](https://github.com/jimmie-potts/agent-device-hub/blob/855bd3787803dad7245f29e88c758659f6e4eda4/docs/provider-qualification.md).
[Consumer behavior](agent-monitoring.md) defines compatibility and hosting.
[Issue #29](https://github.com/jimmie-potts/divoom-app-upgrade/issues/29) owns this source adoption.

## Contract pin

Pixoo supports `@jimmie-potts/agent-lifecycle-contracts` artifact `1.0.0`, wire
API `1.0`, Draft 2020-12 schema `schemas/lifecycle-v1.schema.json` and fixture
format `1` at `fixtures/lifecycle-v1.json`. Both come from the released package;
Pixoo maintains no second schema or provider corpus.

The [source receipt](../vendor/agent-lifecycle-contracts-1.0.0-receipt.json)
identifies the reviewed merged revision, release tag and archive SHA-256:
`669c8e3d8b2bac5255ea613eae96134c324515b4e7a767887e86fa59b87fef85`.
The committed archive, npm integrity and executable manifest/corpus checks
establish the accepted bytes. A release URL alone is not an immutable pin.

The consumer check imports the installed released validator and runs every
shared validation and deduplication case. This establishes source compatibility
on Node 24, separately from installed clients or reduced state.

## Session and task identity

A session uses the complete `{provider, client, hostId, sourceId, sessionId}`
selector. Task presentation retains that selector and available `turn` identity.
Equal project labels must not combine separate sessions or turns.

A known parent requires an attributable selector in the same
provider/client/host/source namespace and a different session ID. Children
retain their own identities. Unknown parentage differs from evidenced top-level
status. Only attributable children contribute to a parent summary. Unknown
counts remain unknown, and child completion does not complete the parent.

## Consumer mapping

| Shared observation | Pixoo dashboard and browser requirement |
| --- | --- |
| `session.started` | Represent the session without inferring success, parentage or acknowledgment. |
| `turn.started` | Represent the new turn; shared state policy governs retirement of old notices. |
| `activity.observed` | Show activity independently of questions, blocked attention and notices. |
| `question.continuing` | Show a continuing question without converting it to a blocked wait; retain attention identity. |
| `attention.input` | Show blocked input without inferring the user's response. |
| `attention.approval` | Show blocked approval without granting or denying permission. |
| `attention.resolved` | Clear only the attention shared state can correlate; unknown correlation cannot clear all waits. |
| `turn.ended` | Show a turn-ended notice; this proves neither success nor readership. |
| `turn.interrupted` | Preserve interruption evidence without treating it as successful completion. |
| `runtime.ended` | Show runtime end while retaining notices required by shared state and consumer policy. |
| `notice.acknowledged` | Acknowledge the exact notice for the configured Pixoo consumer, independently of provider read state. |
| `read.observed` | Retain optional qualified Codex Desktop read/unread evidence separately; missing evidence never means read. |
| `evidence.unavailable` | Show the named unknown dimension and unsupported, inaccessible, missing, ambiguous or lost evidence reason. |

Activity, continuing questions, blocked attention and notices can coexist.
Rendering must preserve them rather than silently clearing one for another.
The shared state owner assigns durable notice IDs. Pixoo acknowledgment uses
that exact notice and a stable configured `consumerId`. Navigation, card views,
display-mode changes and screen-on do not acknowledge notices. Provider read
evidence does not substitute for explicit monitor acknowledgment.

## Freshness and ordering

Five minutes without fresh session evidence means uncertain observation. It
proves neither failure, success, disconnection nor session end. Collector
heartbeats, snapshot reads, browser activity and process restart do not refresh
session evidence. Feed freshness and session observation freshness are separate;
a stale browser feed remains visibly stale.

`observedAtMs` and optional `occurredAtMs` are evidence timestamps, not elapsed
measurements across process or host clock domains. Consumers use the shared
state owner's interpretation rather than reconstructing order from wall time
or arrival order. Unknown turn and ordering evidence stay unknown. Late old-turn
observations must not clear newer attention or notices. Content deduplication
can collide for indistinguishable observations and does not prove exactly-once
history. Pixoo adds no second reducer.

## Labels and privacy

Display a neutral identifier unless the user explicitly chooses a label. Labels
have `origin: "user"`, at most 80 Unicode scalar values and no C0/DEL control
characters. A project ID also requires explicit assignment.

Do not copy prompts, transcripts, automatic session titles, tool content,
credentials or private paths into labels, grouping keys or monitoring data.
Encoding or hashing excluded content does not make it a neutral identifier.
These exclusions apply before transmission and to storage, errors, diagnostics
and browser output. Validation establishes shape and bounds, not string origin;
producers must construct the allowlist, and consumers must not retain rejected
payloads or provider exceptions.

## Evidence limits

The shared corpus covers turns, attention, notices, attribution, unavailable
evidence, duplicates and invalid private fields. Its results validate a source
contract. Hub #8 and Pixoo #34 own installed-provider acceptance. Device
transport and visible output need separate evidence and authority. The existing
simulator and media behavior are unchanged by this adoption.
