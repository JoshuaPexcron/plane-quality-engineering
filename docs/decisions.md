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
