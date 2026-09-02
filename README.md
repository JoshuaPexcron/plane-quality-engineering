# plane-quality-engineering

[![CI](https://github.com/JoshuaPexcron/plane-quality-engineering/actions/workflows/ci.yml/badge.svg)](https://github.com/JoshuaPexcron/plane-quality-engineering/actions/workflows/ci.yml)
[![tests](https://img.shields.io/badge/tests-30-blue)](docs/test-list.md)
[![dashboard](https://img.shields.io/badge/quality_dashboard-live-4f46e5)](https://joshuapexcron.github.io/plane-quality-engineering/)

**[Live quality dashboard →](https://joshuapexcron.github.io/plane-quality-engineering/)**

Risk-based test automation for [Plane](https://github.com/makeplane/plane), an open-source project management platform. I test a self-hosted Plane instance with Playwright and TypeScript: UI tests, API tests, and a CI pipeline that boots the whole product in Docker before every run. A written risk analysis decides what gets tested and why, and the dashboard above traces every test back to the risk it covers.

> Work in progress. Strategy, API suite, UI suite and dashboard are in place. Next: accessibility scans and exploratory testing.
