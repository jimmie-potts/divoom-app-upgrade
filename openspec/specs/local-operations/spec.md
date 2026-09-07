# Local operations specification

## Purpose

Keep a local Pixoo library recoverable and make native backend startup and
runtime problems diagnosable without exposing private data.

## Requirements

### Requirement: Offline recovery bundle
The system SHALL provide an offline backup command that requires exclusive
library ownership and captures a SQLite-consistent catalog, every cataloged
original and rendition, playlists, retained sessions, checkpoint and saved
device settings together. It SHALL verify catalog/media integrity and record
file sizes and hashes in a versioned bundle. Trace: issue #10 recovery criterion.

#### Scenario: Recover committed data including WAL content
- **WHEN** a stopped library with playlists and saved playback context is backed up
- **THEN** the bundle contains the committed catalog and all its media references, excluding locks, staging, logs and unrelated files

#### Scenario: Active backend owns the library
- **WHEN** backup is requested while another library owner holds the data
- **THEN** backup fails with a busy error and leaves the library intact

### Requirement: Restore into fresh private storage
Restore SHALL accept only a complete supported bundle, verify its inventory,
hashes, database and media relationships, and require a new absolute destination
outside source control and outside the source bundle. It SHALL reject missing,
altered, duplicate, unsafe or unexpected entries and never replace existing data.
Interrupted output SHALL remain visibly incomplete and unusable as application
data. Trace: issue #10 recovery criterion.

#### Scenario: Fresh restore and paused recovery
- **WHEN** a valid bundle is restored into a new directory and the simulator starts there
- **THEN** the catalog, assets, playlist revisions, device settings and saved context are available, with playback recovering paused under the existing contract

#### Scenario: Invalid bundle or occupied destination
- **WHEN** restore receives a corrupt or incomplete bundle, a symlink entry, an unsafe path or an existing destination
- **THEN** it fails without changing the source or replacing the destination's existing contents

### Requirement: Local diagnostics and bounded transient state
The backend SHALL expose loopback diagnostics for uptime, selected mode,
library readiness and player/device availability without private paths, IPs,
media names or raw errors. Transient request, event and playback caches SHALL
remain bounded; routine requests SHALL NOT create persistent logs. Durable user
media SHALL NOT be discarded as a cache. Trace: issue #10 startup criterion and issue #42 criteria 5-6.

#### Scenario: Diagnose a running simulator
- **WHEN** a local client reads diagnostics after startup
- **THEN** it can distinguish a ready backend and simulator availability from an actual device connection, without receiving private runtime details

### Requirement: Backend lifetime is independent of the browser
Documented native startup SHALL serve production UI and API from one loopback
origin, retain external data across graceful shutdown, and keep orchestration
running after all browser pages close while the host and process remain awake.
Documentation SHALL describe Windows/WSL reachability checks and native Windows
as an alternative, without installing services or changing networking policy.
Trace: issue #10 startup, browser lifetime and platform criteria.

#### Scenario: Browser closes during playback
- **WHEN** a browser starts a bounded playlist and closes before it finishes
- **THEN** the backend continues advancing the playlist and reports the resulting state to a later client

### Requirement: Bounded physical operation runbook
Documentation SHALL provide placeholder-based configuration, explicit device start, graceful stop, simulator rollback and troubleshooting instructions. It SHALL require a separately authorized target and permission to replace content before physical operation, one writer for the target, and the dated smoke limits. The physical acceptance runbook SHALL bound operations, stop on uncertain or unacceptable results and separate source checks, transport receipts and user observations for issues #12 and #26. Private addresses, media and receipts SHALL stay outside Git. Trace: issue #42 criteria 6-8.

#### Scenario: Configure and return to simulator
- **WHEN** an operator follows the documented mode-selection and rollback sequence
- **THEN** settings are saved in private runtime storage, device activation requires an explicit restart in device mode, and a simulator restart preserves media with playback paused

#### Scenario: Physical acceptance remains pending
- **WHEN** source tests pass without an authorized display session
- **THEN** delivery records source completion without claiming visible output, exact finite loops, phone connectivity or closure of physical acceptance
