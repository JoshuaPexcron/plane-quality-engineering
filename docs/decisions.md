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
