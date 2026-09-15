# Changelog

All notable changes to Revue are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/):

- **Major** — an operator has to do something to upgrade: new required environment
  variables, users must re-authorize, a migration that cannot be rolled back, or a
  change to the GitHub integration itself.
- **Minor** — new features that upgrade in place.
- **Patch** — fixes only.

Each release corresponds to a development phase and is tagged in git. The tag,
the GitHub Release, and the Elastic Beanstalk version label share the same name.

## [Unreleased]

### Planned
- Post findings to the pull request on GitHub as `revue[bot]` review comments.
- Drop the unused `repositories.webhook_id` column.

## [2.0.0] — 2026-09-14

Migration from a classic OAuth App to a GitHub App with installation tokens.

### Changed
- **Revue is now a GitHub App.** Repository reads use short-lived installation
  tokens minted from the App's private key and scoped to *Contents: read*,
  *Pull requests: read*, *Metadata: read* — replacing the classic OAuth `repo`
  scope, which granted read/write on code, issues, wikis, and settings for every
  repository the user could access. The user's OAuth token is now identity-only.
- Webhooks are app-level. Every installed repository delivers `pull_request` events
  to one endpoint; nothing is registered per repository.
- Webhook-triggered reviews act as the bot rather than borrowing a matching user's
  token, so a pull request from any collaborator is reviewed. Previously a PR whose
  author had never signed into Revue was silently ignored.
- Webhook-triggered runs are rate-limited per repository; manual runs remain
  per user (five per 24 hours each).
- The agent loop answers every tool call the model requests in a turn. It
  previously answered only the first and left the model to re-request the rest,
  which wasted the five-iteration budget; a single-file review now completes in
  roughly five seconds instead of a minute and a half.
- Connecting a repository the App is not installed on returns
  `409 app_not_installed` with an install URL, rendered in the UI as an
  *Install Revue on GitHub* button. The same applies to reading any repository
  whose installation has been removed.

### Added
- `app/services/github_app.py` — App JWT, cached installation tokens,
  repository→installation lookup.
- `repositories.installation_id`, kept in sync by the App's `installation` and
  `installation_repositories` webhook events.
- Test suite (`pytest`, in-memory SQLite, `respx`-mocked GitHub) covering App JWT
  claims, token caching, webhook signature rejection, installation lifecycle events,
  the webhook-triggered review path, and the connect flow. Runs in about five
  seconds with no Docker or network.
- GitHub Actions CI running the test suite and the frontend lint and build on every
  push.

### Fixed
- ISO-8601 timestamps from GitHub are parsed before being assigned to `DateTime`
  columns rather than relying on the database driver to coerce strings.
- A debug print of the raw model response could crash a review on Windows when the
  model emitted characters outside the console code page.

### Upgrade notes
- Register a GitHub App (permissions above, *Pull request* event, expiring user
  tokens enabled) and set `GITHUB_APP_ID`, `GITHUB_APP_SLUG`, and
  `GITHUB_APP_PRIVATE_KEY` (base64 PEM). `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`
  become the App's.
- Run migration `c7a2e58f4b19`.
- Users must sign in again. Repositories connected under the OAuth App are relinked
  automatically when the App is installed on them, or on the next *Connect*.
- `agent_runs.triggered_by_user_id` is now nullable.

## [1.1.0] — 2026-09-06

Frontend overhaul and the fixes it surfaced.

### Added
- A token-based design system: CSS custom properties for surfaces, text, accent,
  status colours, radii, and shadows, consumed through CSS Modules. No CSS framework
  or component library.
- Shared application shell with navigation and the signed-in user.
- Metrics charts with a validated palette (colorblind separation and contrast
  checked against the actual surface); severity is never encoded by colour alone.
- Per-file timeline view of the agent's tool-call trace.
- `GET /user/me`, returning the signed-in user's username and avatar.
- Project README with architecture, data-model, and agent-loop diagrams.

### Changed
- Every authenticated fetch goes through one `apiFetch` helper and a `useApiQuery`
  hook; the `401 → sign-in` redirect lives in one place.
- Findings on the pull request page are sorted by severity and grouped with their
  suggestions; the changed-files list is a sidebar.

### Fixed
- All timestamp columns are timezone-aware and all writes use UTC. Previously the
  API emitted timestamps with no offset, which browsers interpret as local time, so
  every relative time in the UI rendered in the future ("connected in 7 hours").
  Migration `b4f1c9d27a30`.
- The trend chart no longer renders an empty plot for a single data point.

## [1.0.0] — 2026-09-06

First production deployment. Everything in the original specification is shipped.

### Added
- Agent review loop: per changed file, a Gemini tool-use loop over `get_diff`,
  `get_file_history`, `check_security_patterns`, and `get_repo_memory`, followed by a
  schema-constrained final call producing findings (line, severity, category, text,
  suggestion) and an updated per-file memory summary.
- Persistent memory: `repo_memory` holds one evolving summary per `(repo, file)`,
  read at the start of each review and rewritten at the end.
- GitHub OAuth sign-in with a session JWT in an `httpOnly` cookie, separate from the
  stored GitHub access and refresh tokens.
- Connect repositories, list pull requests and changed files, trigger reviews,
  poll run status, view findings.
- Rate limit of five reviews per user per 24 hours.
- Per-repository `pull_request` webhooks with HMAC signature verification,
  auto-registered on connect.
- Metrics: findings by severity, over time, by file, by author.
- Agent run history with the full per-file tool-call trace, retry counts, and
  duration.
- Retry with server-suggested backoff for Gemini rate limiting.
- Deployment: Docker on Elastic Beanstalk behind CloudFront, RDS PostgreSQL,
  React SPA on S3 + CloudFront.

[Unreleased]: https://github.com/nairadi0/Revue/compare/v2.0.0...HEAD
[2.0.0]: https://github.com/nairadi0/Revue/compare/v1.1.0...v2.0.0
[1.1.0]: https://github.com/nairadi0/Revue/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/nairadi0/Revue/releases/tag/v1.0.0
