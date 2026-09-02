# Decisions

A short log of the technical decisions in this project: what I decided, and why. Newest entries at the bottom.

## Test self-hosted Plane, pinned to v1.4.2

I test a self-hosted instance instead of Plane Cloud. It gives me admin access, API tokens, full seeding control and a stable UI. The version pin matters most: when a test fails, I want it to mean the product or the test changed, never that the environment drifted underneath me. Upgrading Plane is a deliberate pull request that reruns the whole suite.

## Playwright with TypeScript

One tool covers UI tests, API tests and trace-based debugging, so I can master a small surface deeply instead of stitching tools together. Strict TypeScript catches test bugs at compile time. Cypress would have been weaker on API testing and multi-role auth, and Selenium adds nothing here.

## Chromium only

Cross-browser runs add CI time and flake but little insight for this suite. Plane's users sit on Chromium-based browsers for the most part, and none of my risks are browser-specific. I documented this as a known trade-off instead of pretending the coverage exists.

## Small page object model, no framework

Four page objects, only for screens that several tests share. Everything else uses Playwright locators inline. A screen that two tests touch does not earn an abstraction. I would rather have 25 files I fully understand than a framework I have to defend.

## No BDD, no Cucumber

Gherkin adds a translation layer between the test and the code. That layer pays off when business people read the tests. Nobody but me reads these tests, so the layer would only cost maintenance and hide detail.

## Own dashboard instead of Allure

The dashboard is one script and one HTML template that read Playwright's JSON report. Allure would look generic, add configuration surface, and could not show the one thing I care about: the risk coverage matrix.

## Risk tags in test titles

Every test carries its risk ID as plain text in the title, like `@R3`. The dashboard script parses the tags from the JSON report. No custom annotation system, nothing that breaks on a Playwright upgrade.

## Accessibility scans stay informational

I don't control Plane's code, so failing my build on their violations would force me to either ignore red builds or fake the results. Reporting the violations honestly against a recorded baseline is the useful part.

## No email server in the stack

Plane invites workspace members by email, which looked like a hard dependency at first. It is not: the invitation is a database record, and a logged-in user with the matching address can accept it through the same endpoint the pending-invites screen uses. So the member and guest roles get created fully scripted, and the stack stays at 13 containers. I had Mailpit as a fallback plan and dropped it.

## Verify state, not status codes, in setup scripts

Plane's auth endpoints redirect on success and on failure alike, with the error hidden in the redirect URL. My setup scripts therefore check the state they care about after the call, for example whether the instance reports its setup as done. The scripts are also safe to run twice: every step tolerates finding its work already done.

## Retries once in CI, never locally

A flaky test that passes on retry is still a flaky test. Locally it fails loudly so I fix it. In CI one retry avoids losing a full run to a transient hiccup, and the recorded trace from the retry gives me the evidence to investigate.

## One seed script prepares any instance

CI starts from an empty database on every run, so everything the tests need has to come from a script: the workspace, a second workspace for the cross-workspace test, the member and guest accounts, and the API tokens. `scripts/seed.ts` does all of that and writes the results into `.env`, the same file the tests read locally. Every step checks whether its work already exists, so I can run the script as often as I want.

## Playwright's request context is the API client

I planned a small client class and then didn't need one. A Playwright request context with the `X-API-Key` header set once does the job, and the fixtures hand one context per role to the tests. `lib/api-client.ts` only holds the URL prefix, the response types the tests assert on, and four setup helpers that several tests share.

## Tests pin what the product does, with a comment where it differs from the plan

Two API tests came out different from the test list. An invalid API key gets a 403, not the 401 I expected, and the work item list ignores a state filter without an error. Both are defensible, so the tests assert the real behavior and say in a comment why the plan said something else. A test that encodes my expectation instead of the product's behavior would fail forever and teach nothing.

## Random suffix in test data names

My first version named test projects with a timestamp. Two parallel workers created a project in the same millisecond and one of them got a 409. Names and identifiers now carry a random suffix. Small lesson, but a real one: a timestamp is not unique once tests run in parallel.

## No automatic retry on rate limits

Plane's public API allows 60 requests per minute per token. A full run of the API suite uses about 45, so one run fits and two runs inside the same minute don't. I could catch the 429 and wait, but I'd rather see the failure: it tells me the suite got too chatty and needs a second token or fewer setup calls, not a hidden sleep.

## Storage states instead of logging in per test

A setup project signs in each role once through the real login form and saves the browser state to a file. The UI tests load the admin state by default, and single files override it with the guest state or with none. The logout test signs in fresh instead, because signing out would invalidate the shared session for every test after it.

## Two page objects, not four

The plan budgeted four page objects. My own rule says a screen earns one at three or more tests, and only the login form and the work item list reached that bar. The sidebar, the settings page and the detail panel stay as inline locators. The rule decided, not the plan.

## API setup, UI verification

Every work item test creates its data through the API and checks the result in the UI. That keeps tests fast, and when one fails, it points at the screen under test instead of at setup steps.

## A second API token instead of a raised rate limit

The full suite blew through the 60 requests per minute that one token allows. Raising the limit in my own instance would make the suite pass by changing the product, so the seed script now creates a second token and the UI tests run on their own budget.

## Tuned parallelism instead of retries

When the full suite got flaky, the container logs showed why, not Playwright: the pinned compose file runs one gunicorn worker, and my machine froze all requests for 40 seconds when four browsers ran at once. I raised gunicorn to four workers, capped Playwright at two, and gave tests more room than the defaults, 60 seconds per test and 10 per assertion. Plane in Docker is slower than those defaults assume, and pretending otherwise produces flaky tests.

## Assert what the user sees, not the dialog wrapper

Plane's modal wrapper has no size of its own, so Playwright reports it hidden while the modal is clearly on screen. The tests assert the modal's content instead: the validation message, the form fields. One red test taught me to distrust visibility checks on containers.

## The dashboard is built, not served

A build script reads Playwright's JSON report, joins the risk tags against a small risk table, and bakes everything into one static HTML page. The page ships zero JavaScript, because the data is already final when CI writes it. Anything that fetches at view time can break in the visitor's browser; a static page can't.

## The dashboard publishes on red runs too

The publish job runs whether the tests passed or failed. A dashboard that only updates on green is an advertisement, not a report. This cost me one lesson: a GitHub Actions `if:` condition without a status function gets an implicit `success()` added, which silently skipped my publish job on the first red run. `!cancelled()` in the condition fixed it.

## Setup logins don't count as tests

The three role sign-ins from the setup project appear in Playwright's report like any other test. The dashboard skips them: counting infrastructure would turn 30 tests into 33 without a single new check. Flaky tests get their own number for the same reason. A test that passed on retry did fail once, and folding it into "passed" would hide exactly the signal my flakiness policy cares about.

## The dashboard reads the version from the pin

The Plane version on the page comes from the `APP_RELEASE` line in the Compose environment file, not from a string I typed. The dashboard can't claim a version the stack doesn't run.

## Coverage gaps are printed, not hidden

The accessibility risk has no automated tests yet, so its matrix row says "no automated coverage yet" instead of showing an empty cell. An empty cell looks like an oversight. A named gap shows the coverage state is known and deliberate.

## Static badge for the test count

The README badge says 33 because a computed badge needs an endpoint or a gist to write into, which is machinery for a number that changes maybe twice more in this project. The cost is manual honesty: when the test count changes, I bump the badge by hand.

## Accessibility scans stay informational, with a recorded baseline

The three axe-core scans report their violation counts to the dashboard and never fail the build on Plane's existing problems. Plane's code is not mine to fix, so a build that goes red on their violations would only teach me to ignore red builds. The one thing the scans do enforce is a recorded baseline per page: a critical rule that is new against the baseline fails the run. That way the scans catch a regression I introduce or an upgrade brings, without me owning every issue Plane already ships.

## The a11y summary rides in the test report, not a side file

Each scan attaches its counts to its own test result with `testInfo.attach`. The dashboard build script reads them straight out of Playwright's JSON report, the same file it already parses for the risk matrix. I thought about writing a separate results file, but that would mean a second artifact to pass between the CI test job and the publish job. One report in, one page out.

## The UI-07 flake was a shared rate limit, not a slow test

A rename test failed on and off, in CI and locally, always with Plane's "didn't start up correctly" error screen instead of the settings form. The temptation was to add a wait or a retry. The container logs told the real story: Plane's frontend calls `/api/instances/` on every page load, the server allows 30 of those per minute per IP for anonymous callers, and my full run from one IP burned through the budget. Page loads then stalled on the throttled call or died on the error screen. The fix serves that one bootstrap call from a cached copy in the test fixtures, so the browsers stop spending a shared budget on a response that never changes. After the fix a full run drops from a dozen-plus 429s to zero, and the rename test passes even when I exhaust the budget on purpose first. The throttle itself is a real product issue for anyone behind a shared IP, so it also became a bug report. The lesson is the same one the earlier gunicorn flake taught: when a UI test flakes, read the server logs before touching the test.
