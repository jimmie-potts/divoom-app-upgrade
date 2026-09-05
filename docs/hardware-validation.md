# Hardware validation

Status on September 5, 2026: **Not run**. No application or device integration exists.
No IP has been configured; model variant and firmware are unknown. No requests
were sent to a display during repository setup.

M1 and M6 issues own hardware acceptance. Before testing, obtain the explicit IP
and approval to replace the display. Record read-only versus display-changing
commands separately, along with model/firmware, host/network path, dated results,
source revision, measured upload and visible timing, and the user's observations.
Do not commit private device identifiers or media; use redacted identifiers.

Use pass, fail, or blocked for every check. Include the tested capability profile,
observed loading artifacts and play-count error, agreed tolerances, soak duration
and transition count, recoveries, and actual phone access. Handoff sections 9-10
own the proposed test procedure. Simulator and HTTP success cannot establish
visible output. Hardware-unavailable work remains explicitly unverified.
