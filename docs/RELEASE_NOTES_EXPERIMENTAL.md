# UPSE experimental release

This GitHub Release is experimental. It provides the Chromium extension ZIP and its SHA-256 checksum for manual installation in Microsoft Edge or Chrome.

Verified in this release:

- Session verification uses the browser's native Platzi session without reading or storing cookies, tokens, or credentials.
- TXT individual, combined TXT, ZIP, and Clipboard exporters pass isolated tests with original synthetic subtitle fixtures and explicit test-only authorization context.
- The package check rejects test-only authorization markers and fixtures from the distributable ZIP.

Browser evidence recorded on 11 October 2026 is separated by provider and profile:

- **Chrome for Testing, fresh profile:** The production MV3 extension `1.0.10` loaded with its service worker, opened its `chrome-extension:` page, and completed onboarding and Settings inspection through **Volver a verificar**. With no authenticated Platzi session, the expected fail-closed result was observed: `GET /api/v1/components/headerv2/user/` returned HTTP `401`, the diagnostic state remained `UNKNOWN`, Network recorded one `401`, and the console recorded one error and zero warnings. No credentials, cookies, tokens, or raw profile data were read or stored.
- **Chrome for Testing CI harness (run 38154638437):** The same production exporter path passed the revoked-proof guard and four isolated effects with synthetic fixtures: individual TXT, combined TXT, ZIP with two UTF-8 entries, and Clipboard. The runner recorded 305 clipboard characters with SHA-256 `8486a497b01ac4ef1af86c5528eae55f592bcaa664362761bbbb7e1e3a42dc12`; the harness authorization was `AUTH_SIMULATED_TEST_ONLY` and never represented Platzi authorization.
- **Microsoft Edge Extensions MCP, independent profile:** UPSE `1.0.10` was installed and enabled, then reloaded and opened through the real extension action. A real **Volver a verificar** interaction showed the spinner and ended with native `headerv2/user` HTTP `200` JSON and an authenticated enterprise-session result (`OK`); the run recorded zero console errors and zero warnings. This proves session verification in that profile only; it does not grant class or export permission.
- **Microsoft Edge browser export harness:** Four production exporter effects passed with original synthetic fixtures: individual TXT, combined TXT, ZIP with two entries, and Clipboard. The files had UTF-8 content; the operating-system clipboard read returned the fixture text (319 characters), whose sanitized expected SHA-256 was `c27f4fac967834043e50c6197e789f74b25609da0447feedabdee236cd4e303c`. The harness authorization is mock/test-only and is not evidence of Platzi authorization.

The browser harness at `tests/browser-export-harness/index.html` is a separate loopback page for Edge/Chrome for Testing. It imports the production exporter functions, writes only synthetic fixture data, and is never packaged into the extension.

Still blocked:

- Direct extraction from restricted Platzi classes remains fail-closed until a class-bound, provider-supported access signal is available.
- Reproduction access is not treated as permission to copy or export subtitles.
- The sanitized class probe found two candidate records (`classId` `78353` and `78354`, `courseId` `12061`) with `class_is_free: true`; class entitlements remain unknown and export permission remains `UNKNOWN`. These observations do not authorize reproduction or export.
- This release does not include Platzi content, user profiles, cookies, tokens, or a simulated authorization switch.

Install from the ZIP using [the manual extension guide](EXTENSION_GUIDE.md). Do not install this experimental build as evidence that Platzi has authorized subtitle export.
