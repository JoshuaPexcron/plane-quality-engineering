# Test list

The final list: 33 automated tests, each tagged with the risk it covers. The risks are defined in [test-strategy.md](test-strategy.md). Where Plane's actual behavior differs from the expectation below, the test documents the actual behavior with a comment, and if the behavior is defensibly wrong it becomes a bug report.

## UI tests (15), Chromium

| ID | Risk | Test |
|----|------|------|
| UI-01 | R1 | Sign up a new user, user lands in onboarding |
| UI-02 | R1 | Log in with valid credentials, workspace is visible |
| UI-03 | R1 | Log in with a wrong password, clear error, no session created |
| UI-04 | R1 | Log out, a workspace URL afterwards redirects to login |
| UI-05 | R1 | Anonymous visit to a deep workspace URL redirects to login, not to an error page |
| UI-06 | R4 | Create a project, it appears in sidebar and project list |
| UI-07 | R4 | Edit project name and settings, the change survives a page reload |
| UI-08 | R4 | Delete a project, a confirmation guard is required before anything is destroyed |
| UI-09 | R3 | Create a work item with title, priority and assignee, it appears in the list view |
| UI-10 | R3 | Edit title and priority of a work item, both persist after reload |
| UI-11 | R3 | Change the state of a work item, the board reflects it |
| UI-12 | R3 | Filter work items by state and by assignee, only matching items show |
| UI-13 | R7 | Create a work item with an empty title, blocked with a validation message |
| UI-14 | R6 | Add a comment to a work item, it shows with correct author and timestamp |
| UI-15 | R2 | Log in as guest, create and delete controls are absent or disabled |

## API tests (15), Playwright request context

| ID | Risk | Test |
|----|------|------|
| API-01 | R5 | POST project returns 201 and echoes name and identifier correctly |
| API-02 | R5 | GET projects contains the created project, response shape and pagination are sane |
| API-03 | R5 | PATCH project, change persists on the next GET |
| API-04 | R5 | DELETE project succeeds, next GET returns 404 |
| API-05 | R5 | POST work item returns 201, fields match what was sent |
| API-06 | R5 | PATCH work item state and priority, both persist |
| API-07 | R5 | GET work items with a state filter returns only matching items |
| API-08 | R5 | DELETE work item, it is gone from the next list |
| API-09 | R1 | Any endpoint without an API key returns 401 |
| API-10 | R1 | Any endpoint with an invalid API key returns 401 |
| API-11 | R2 | Member token tries to delete a project, 403 |
| API-12 | R2 | Token from workspace A requests a workspace B resource, 403 or 404, never data |
| API-13 | R7 | POST project with a missing or empty name returns 400 with a usable error message |
| API-14 | R7 | POST work item with an invalid priority value returns 400, not silent acceptance |
| API-15 | R6 | POST a comment on a work item, GET shows it present and correctly attributed |

## Accessibility scans (3), axe-core

| ID | Risk | Test |
|----|------|------|
| A11Y-01 | R8 | Login page: record violations, no critical regressions against the baseline |
| A11Y-02 | R8 | Project board view: same |
| A11Y-03 | R8 | Work item detail panel: same |

The scans report to the dashboard. Only a growing count of critical violations against the recorded baseline fails the run.

## Notes on the finalization

I kept the list at 33 after exploring the product. Two things I learned along the way strengthened the negative tests rather than adding new ones: the API accepts unknown field names without an error in some places, and one input crashed the server where a validation message should be. API-13 and API-14 target exactly this class of problem. Findings that don't fit an automated test go to the exploratory sessions and to bug reports.
