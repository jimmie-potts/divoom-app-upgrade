# Using the controller UI

Build and start with `npm run simulator`, then open the printed loopback URL.
The default mode controls the simulator. Explicit device startup is described in
[device operations](device-application.md). Saving an IP address never enables
hardware or retargets a running backend. Phone viewport tests do not enable phone access.

## Media and playlists

In Library, upload a PNG, JPEG or GIF up to 10 MiB. Select a file to see its
64 × 64 effective preview, frame count and normalized timing warnings. Animate
preview uses the saved frame order and delays; browser timing is illustrative.
Fit, scaling and padding color create an immutable rendition when you select
Render preview. Existing playlist entries keep their prior rendition.

Choose Use in playlist, then create or open a named playlist. Add selected media
can be used repeatedly, and each entry has its own duration or total-play policy.
Stills start at 30 seconds; animations start at three total plays. A single-frame
GIF uses a still duration. Repeat starts on and shuffle starts off.

Edit timing inline and use Move up/down with a keyboard or touch. Save items
commits the draft. Naming and repeat/shuffle controls save through their dedicated
operations. Duplicate playlist copies saved entries. If another window changes
the revision, your draft remains visible; Reload saved playlist explicitly
replaces it with current saved data. Unsaved item edits require confirmation
before switching playlists or reloading.

## Player and recovery

Choose Player and Play playlist for the selected saved playlist. Saved edits do
not change a running snapshot. Restart with changes explicitly captures the
latest saved revision. The player shows session/item, intent, availability,
loading and estimated remaining time.

Pause playlist stops advancement; a physical GIF could keep looping. Resume
restarts the current item from its beginning. Stop leaves the last content.
Screen off pauses orchestration, and screen on does not resume. Clear session
releases the saved context and its media references.

Refresh status checks readiness without discarding local drafts or uncertain command identities. Closing or refreshing the page does not stop the backend. EventSource reconnects
and reads current state. When a command response is interrupted, Retry command
uses the original identity. Reconcile and discard reads current state before
letting you choose a new action. Neither option silently repeats a command with
a new identity.

A device operation with possible prior effects pauses playback and retains the
error. The UI explains that explicit resume restarts the current item from its
beginning. Check the outcome before resuming. This device pause is distinct from
a lost browser response, which keeps its original command identity.

## Settings

Save an explicit private IPv4 address, supported profile and optional model or
firmware observations. Settings shows the active profile and, in device mode,
the active target separately from the saved fields. A changed device configuration
shows that restart is required. The active device limits are one or two complete
64×64 frames with exactly 500 ms animation delays; incompatible GIFs are rejected.

Probe simulator checks fake-adapter availability. Probe device makes an explicit
transport request through the player. Device transport starts unknown and reports
observed availability; visible output remains unverified. Brightness and screen controls
share the backend's serialized writer with playback. Requested values are not
physical telemetry. Authenticated HTTPS LAN deployment is separate work.
