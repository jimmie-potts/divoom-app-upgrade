## Context

CI ran the Workflow and Application jobs on `ubuntu-latest` and `windows-latest`. Only the Windows Application job flakes; issue #86 lists the observed runs. The local-operations spec requires documentation to describe "native Windows as an alternative", which dates from #10, when WSL loopback reachability from Windows was unproven. The owner has since run the backend in WSL and reached it from Windows (docs/hardware-validation.md), and the installed backend is a WSL user service.

## Goals / Non-Goals

**Goals:** remove the flaky Windows jobs, stop presenting a runtime nobody verifies, and keep the Windows-to-WSL reachability guidance the owner uses.

**Non-Goals:** removing `win32` code branches, changing Linux/WSL behavior or tests, and qualifying other hosts such as macOS, Docker or ARM64.

## Decisions

- **Retire the runtime, not only the job.** Dropping the job while keeping native Windows documented would advertise a path nothing verifies. Raising the Vitest timeout (the original #86 plan) was rejected by the owner; it keeps paying for a host nobody runs. [ADR 0021](../../../../docs/decisions/0021-linux-wsl-only-host.md) records the decision.
- **Keep `win32` branches.** They are small, cover the same code on Linux via injected platform values in unit tests, and removing them adds churn with no current benefit. They are unsupported.
- **Keep Workflow checks on Ubuntu only.** They did not flake on Windows, but they validate the same repository tooling and the owner's agents run it from WSL.
- **Drop the job matrix.** With one host, the jobs are named "Workflow checks" and "Application checks". `main` has no branch protection bound to the old names.

## Risks / Trade-offs

- [A Windows-specific path, lock or process regression goes unnoticed] → No supported host runs native Windows. Revisit when a Windows host cannot run WSL.
- [An operator on a Windows browser cannot reach WSL loopback] → The reachability checks remain. The fix is WSL networking, not a native backend; forwarding, firewall and router changes stay out of scope.
