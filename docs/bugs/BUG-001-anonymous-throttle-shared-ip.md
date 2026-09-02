# BUG-001: Shared anonymous rate limit can degrade Plane for every user behind one IP

## Summary

Plane's web frontend starts every full page load with an unauthenticated request to `/api/instances/`. The server throttles anonymous requests at 30 per minute per IP address, and the throttle counts this bootstrap call even when the user has a valid session. All users behind one shared IP, for example an office behind NAT, draw from the same budget of 30. Once the budget is spent, page loads stall for 20 to 30 seconds on retries, and under sustained load the app replaces the page with the error screen "Looks like Plane didn't start up correctly!", which points users at their container logs for a problem that is neither theirs nor a startup problem.

## Steps to reproduce

1. Run Plane CE v1.4.2 with the standard Docker Compose setup.
2. From one machine, send 31 unauthenticated requests within a minute: `for i in $(seq 31); do curl -s -o /dev/null -w "%{http_code}\n" http://localhost/api/instances/; done`
3. While the budget is exhausted, load or reload any Plane page in a logged-in browser session from the same IP.

## Expected

A logged-in user's page load works regardless of how much anonymous traffic came from the same IP. The bootstrap call of an authenticated app session should either send credentials, be excluded from the anonymous throttle, or fail without taking the whole page down.

## Actual

- Requests 20 to 31 in step 2 return `429` (the budget was partly consumed by earlier page loads in the same minute).
- The page load in step 3 takes about three times as long as normal while the frontend retries the throttled call. In my measurement the same test flow went from 9.4 to 30.9 seconds.
- Under sustained load the frontend gives up and renders the full-page error "Looks like Plane didn't start up correctly!" with a support link, on an instance that is healthy.

## Evidence

- Server config, `plane/settings/common.py` in the `plane-backend` image: `DEFAULT_THROTTLE_CLASSES` is `AnonRateThrottle` with `"anon": "30/minute"`.
- API log excerpt during a burst of page loads from one IP (all entries carry `"user_id": null`, including loads from sessions that were logged in):

```text
2026-09-02 12:37:48,977  GET /api/instances/ 200
2026-09-02 12:37:49,369  GET /api/instances/ 429
2026-09-02 12:37:54,392  GET /api/instances/ 429
2026-09-02 12:38:00,817  GET /api/instances/ 429
```

- Accessibility-tree snapshot of the resulting page: a level 1 heading "🚧 Looks like Plane didn't start up correctly!" instead of the project settings form.

I found this through a flaky UI test: a rename test failed in CI and locally with the error screen where the settings form should be, and the container logs showed the 429s. My test suite's 30 page loads per minute from one runner IP hit exactly the budget one small office shares.

## Severity

Medium. No data is lost and a single user on a private IP never notices. But the affected setup, several users behind one egress IP, is the normal case for the self-hosted office deployments Plane CE targets, and the error screen misdirects the debugging effort toward container logs.

## Environment

Plane CE v1.4.2 (Docker Compose, image tags pinned), default configuration, Chromium 151. Reproduced on Windows 11 with Docker Desktop and on a GitHub Actions Ubuntu runner.
