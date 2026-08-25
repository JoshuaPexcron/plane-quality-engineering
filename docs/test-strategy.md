# Test strategy

This document describes how I test Plane, a self-hosted open source project management platform, and why I test it this way. I treat this like a client engagement: the risk analysis comes first, and the test list follows from it.

Version under test: Plane v1.4.2, self-hosted with Docker Compose, image tags pinned. Test framework: Playwright with TypeScript.

## Risk analysis

For each product area I asked what could go wrong, scored likelihood and impact, and let the score decide how much testing the area gets. The scores are my assessment after exploring the product manually and reading its API behavior.

| ID | Risk | Likelihood | Impact | Priority |
|----|------|-----------|--------|----------|
| R1 | Access control fails: users can't log in, or sessions leak into protected areas | Med | High | High |
| R2 | Role permissions fail: a guest or member can do admin-only actions, or data crosses workspace boundaries | Med | High | High |
| R3 | Work item lifecycle breaks: creating, editing or moving items fails or loses data | High | High | High |
| R4 | Project management breaks: projects can't be created or configured, or deletion is too easy | Low | High | Med |
| R5 | API contract breaks: integrations that depend on the REST API fail silently | Med | High | High |
| R6 | Collaboration breaks: comments get lost or attributed wrongly | Low | Med | Low |
| R7 | Input validation gaps: invalid data gets accepted and corrupts projects | Med | Med | Med |
| R8 | Accessibility barriers: keyboard or screen reader users are blocked from core flows | Med | Med | Med |

R3 scores highest because work items are Plane's core value and its most actively changed code. R5 is high because my own API exploration already surfaced silent failures: fields that get ignored without an error, and one endpoint that reports success while storing nothing. R7 is confirmed relevant for the same reason, including one crash on malformed input where a validation error should be.

## Test approach

- Every automated test carries the ID of the risk it covers in its title, for example `@R3`. A script reads these tags from the test results and builds a coverage matrix, so the link between risk and test stays visible.
- UI tests run in Chromium against three user roles: admin, member and guest. Permissions get tested on both layers, because a hidden button in the UI means nothing if the API still accepts the request.
- API tests use Playwright request contexts with per-role tokens. They cover CRUD, auth negatives, permission boundaries and input validation.
- Test data: each test creates its own uniquely named data through the API and cleans up after itself. Setup happens through the API, verification through the UI. That keeps tests fast and independent.
- Accessibility: axe-core scans on three key pages, measured against a recorded baseline. The scans are informational. Plane's code is not mine to fix, so failing my build on their violations would only produce noise. What I can do is report the state honestly.
- Exploratory testing: timeboxed sessions with written charters, notes and bug reports. The automated suite covers the known risks. The sessions cover what nobody thought of yet.

The full test list with risk tags is in [test-list.md](test-list.md). The exploratory charters are in [exploratory/charters.md](exploratory/charters.md).

## Flakiness policy

- Web-first assertions only, no fixed waits.
- Retries: 1 in CI, 0 locally. A test that needs a retry gets investigated, not tolerated.
- Traces are recorded on first retry and uploaded as CI artifacts on failure.

## Environment

The whole stack runs from one Compose file, locally and in CI. Every CI run boots Plane v1.4.2 from an empty database, creates the admin account and the two test roles through scripts, and then runs the suite. No manual steps, no shared state between runs. Upgrading Plane is a deliberate pull request that reruns the whole suite.

## Out of scope

I decided against testing the following areas, so the suite stays focused on the highest risks:

- Cycles, modules and epics beyond what the listed tests touch: lower risk than the core work item flow.
- File attachments and uploads: needs storage-specific test setup, low value at this depth.
- Real-time multi-user sync: needs multi-session orchestration, out of proportion for this suite.
- Email notification content: no email server in the stack, and the invitation flow works without one.
- Performance and load testing: a different discipline with different tooling.
- Mobile and responsive layouts, Firefox and WebKit: cross-browser adds runtime and flake but little insight at this risk level. Chromium covers the dominant engine.
- A full WCAG audit: the three axe scans are awareness, not an audit, and I label them as such.
- Plane's integrations with GitHub and Slack: external dependencies I don't control.
