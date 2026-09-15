# Revue

[![CI](https://github.com/nairadi0/Revue/actions/workflows/ci.yml/badge.svg)](https://github.com/nairadi0/Revue/actions/workflows/ci.yml)

**An autonomous GitHub pull request review agent with persistent memory.**

Revue connects to your GitHub repositories and reviews pull requests using an LLM
agent that decides for itself which tools to call — reading the diff, pulling the
file's commit history, running security heuristics, and recalling what it learned
about that file in previous reviews. Every finding is classified by severity and
category and comes with a suggested fix.

The "persistent memory" part is the point: after each review the agent writes a
summary of the recurring patterns it saw in a file, and reads that summary back on
the next review of the same file. Reviews get sharper as a repository accumulates
history.

**Live:** [d1w4vdxnj7tj3o.cloudfront.net](https://d1w4vdxnj7tj3o.cloudfront.net) ·
sign in with GitHub to connect a repository.

---

## Contents

- [Screenshots](#screenshots)
- [How the agent works](#how-the-agent-works)
- [Architecture](#architecture)
- [Data model](#data-model)
- [Tech stack](#tech-stack)
- [Running locally](#running-locally)
- [Deployment](#deployment)
- [Engineering decisions](#engineering-decisions)
- [Known limitations](#known-limitations)

---

## Screenshots

| | |
|---|---|
| ![Dashboard](screenshots/dashboard.png) | ![PR review findings](screenshots/pr-detail.png) |
| **Dashboard** — connected repositories | **Findings** — severity-sorted, with suggested fixes |
| ![Metrics](screenshots/metrics.png) | ![Agent run trace](screenshots/run-trace.png) |
| **Metrics** — findings over time, by severity, by file | **Run trace** — the agent's tool calls, grouped by file |

---

## How the agent works

Each changed file in a pull request gets its own agent loop. The model is given the
file path and a set of tool declarations, then runs a tool-use loop for up to five
iterations, choosing what it needs. When it stops requesting tools, a final call
returns a structured review under a Pydantic schema.

```mermaid
flowchart TD
    A["PR file"] --> B["Tool-use loop &middot; max 5 iterations"]
    B -->|"model requests a tool"| C{"Which tool?"}
    C -->|"get_diff"| D["Raw patch text"]
    C -->|"get_file_history"| E["GitHub commit history for this file"]
    C -->|"check_security_patterns"| F["Regex heuristics<br/>eval, hardcoded secrets,<br/>shell=True, f-string SQL"]
    C -->|"get_repo_memory"| G[("repo_memory<br/>what past reviews<br/>learned about this file")]
    D --> B
    E --> B
    F --> B
    G --> B
    B -->|"model stops calling tools"| H["Final structured call<br/>response_schema = ReviewOutput"]
    H --> I["Findings<br/>line, severity, category,<br/>text, suggestion"]
    H --> J["Updated memory summary"]
    J --> G
    I --> K[("review_findings")]
```

Two details worth calling out:

**The final call is schema-constrained, the loop is not.** During the loop the model
is free to call tools in any order. The last call sets `response_mime_type` to JSON
with a `response_schema`, so findings come back as validated objects rather than
prose that needs parsing. Severity and category are Python enums shared between the
schema and the database, so an invalid value fails at the boundary instead of
landing in a row.

**The memory loop closes on itself.** `get_repo_memory` reads the previous summary
for `(repo, file_path)`; the final call is asked to produce an updated summary
incorporating both the prior one and what it just found. That summary is upserted
back to `repo_memory`, so the next review of that file starts with context.

Every tool call is recorded to `agent_runs.tool_calls_log` — tool name, iteration,
a preview of the result, and how many times the call had to be retried. The UI
renders that log as a per-file timeline, which makes the agent's actual control flow
inspectable rather than a black box.

### Retry handling

Gemini returns a `RetryInfo` detail with a server-suggested `retryDelay` when it
rate-limits. `generate_with_retry` parses that value and honours it, falling back to
exponential backoff (`2 ** attempt`) when the field is absent, with a cap of three
attempts. The retry count is written into the run log, so a slow review is
attributable to upstream throttling rather than looking like a hang.

---

## Architecture

```mermaid
flowchart LR
    U["Browser"] -->|"static bundle"| CF1["CloudFront + S3<br/>React SPA"]
    U -->|"API calls with<br/>httpOnly JWT cookie"| CF2["CloudFront"]
    CF2 --> EB["Elastic Beanstalk<br/>Docker + FastAPI"]
    EB --> RDS[("RDS Postgres")]
    EB -->|"tool-use loop"| GEM["Gemini API"]
    EB -->|"OAuth + REST"| GH["GitHub API"]
    GH -->|"pull_request events"| EB
```

CloudFront sits in front of Elastic Beanstalk purely to terminate real HTTPS — the
cross-origin `httpOnly` cookie requires `Secure` + `SameSite=None`, which browsers
will not accept over plain HTTP.

### Review triggers

A review starts one of two ways:

1. **Manually**, from the PR detail page. `POST /repos/{id}/prs/{n}/review` creates
   an `agent_runs` row as `PENDING`, schedules the work as a FastAPI background task,
   and returns the run id immediately. The frontend polls `GET /agent_runs/{id}`
   every 3s (capped at ~100 attempts) until `SUCCESS` or `FAILED`.
2. **Automatically**, by webhook. Revue is a GitHub App, so every repository it is
   installed on delivers `pull_request` events to one app-level webhook — nothing is
   registered per repository. `POST /webhooks/github` verifies the HMAC signature,
   mints an installation token for the repository, and starts a run. The PR author
   does not need a Revue account; a collaborator's PR is reviewed the same way.

Manual runs are rate-limited per user, webhook runs per repository — five per 24
hours in each case, enforced by counting `agent_runs` rows.

### Auth and GitHub access

Revue is a **GitHub App**, and keeps three credentials deliberately separate:

- A **session JWT** in an `httpOnly` cookie — who is logged into Revue.
- A **user access token** (`ghu_`), from the App's OAuth flow, stored server-side
  with its refresh token — used only to identify the user and list the repositories
  they can see.
- **Installation access tokens** (`ghs_`), minted on demand by signing an RS256 JWT
  with the App's private key and exchanging it at
  `POST /app/installations/{id}/access_tokens`. These act as `revue[bot]`, are
  scoped to exactly the permissions the App declares — *Contents: read*, *Pull
  requests: read*, *Metadata: read* — and are what every repository read actually
  uses. They live an hour and are cached per installation.

`repositories.installation_id` records which installation covers each repo, kept in
sync by the App's `installation` and `installation_repositories` webhook events.
Connecting a repository the App is not installed on returns `409 app_not_installed`
with an install URL, which the UI turns into an *Install Revue on GitHub* button.

The session JWT and the GitHub tokens have independent lifetimes.
`get_valid_access_token` refreshes the user token on demand; the session is
unaffected. The OAuth redirect chain is a real browser navigation rather than
`fetch`, because `Set-Cookie` on a cross-origin redirect has to happen outside JS.

---

## Data model

```mermaid
erDiagram
    users ||--o{ user_repositories : connects
    repositories ||--o{ user_repositories : "connected by"
    repositories ||--o{ pull_requests : has
    repositories ||--o{ repo_memory : accumulates
    pull_requests ||--o{ pr_files : contains
    pull_requests ||--o{ agent_runs : "reviewed by"
    pr_files ||--o{ review_findings : flagged_in
    users ||--o{ agent_runs : triggers
```

`user_repositories` is a join table with a composite unique constraint on
`(user_id, repo_id)`. This matters more than it looks: the first version of the
schema had `repositories.user_id` as a direct foreign key, which made
`github_repo_id` globally unique across the table — so once one collaborator
connected a shared or org repository, nobody else could ever connect it. The
many-to-many model fixes that.

`repo_memory` is keyed on `(repo_id, file_path)` and holds one evolving
`pattern_summary` per file — the agent's long-term memory.

---

## Tech stack

**Backend** — Python, FastAPI, SQLAlchemy 2.0 (typed `Mapped` / `mapped_column`),
Alembic, PostgreSQL, `google-genai` for the Gemini tool-use loop, `python-jose` for
JWTs, `httpx` for async GitHub calls.

**Frontend** — React 19, TypeScript, Vite, `react-router`. No CSS framework and no
component library: the design system is ~30 CSS custom properties plus CSS Modules,
and the charts are hand-built SVG.

**Infrastructure** — Docker on Elastic Beanstalk, RDS Postgres, S3 + CloudFront for
the SPA, a second CloudFront distribution in front of the API for HTTPS.

---

## Running locally

**Requirements:** Python 3.12+, Node 20+, Docker.

```bash
# 1. Database
docker run -d --name revue-db \
  -e POSTGRES_PASSWORD=devpass -e POSTGRES_DB=revue \
  -p 5432:5432 postgres:18

# 2. Backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload    # localhost:8000

# 3. Frontend
cd frontend
npm install
npm run dev                      # localhost:5173
```

Create a `.env` in the project root:

```ini
DATABASE_URL=postgresql+psycopg://postgres:devpass@localhost:5432/revue
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
GITHUB_REDIRECT_URI=http://localhost:8000/auth/callback
GITHUB_WEBHOOK_SECRET=...
GITHUB_APP_ID=...
GITHUB_APP_SLUG=...
GITHUB_APP_PRIVATE_KEY=<base64 of the .pem>
SESSION_SECRET=...
GEMINI_API_KEY=...
```

The GitHub values come from a **GitHub App** (Settings → Developer settings →
GitHub Apps) with repository permissions *Contents: read* and *Pull requests: read*,
subscribed to the *Pull request* event, with *Expire user authorization tokens*
enabled and a callback URL matching `GITHUB_REDIRECT_URI`. The private key is stored
base64-encoded so the same value works in `.env` and in single-line environment
stores like Elastic Beanstalk. For local webhook delivery, point the App's webhook
at a [smee.io](https://smee.io) channel and run `npx smee-client --url <channel>
--target http://localhost:8000/webhooks/github`.

`ENVIRONMENT` defaults to `development`, which sends the session cookie without
`Secure` so it works over plain HTTP locally.

### Tests

```bash
pip install -r requirements-dev.txt
python -m pytest
```

The suite runs against an in-memory SQLite database and mocks GitHub with `respx`,
so it needs neither Docker nor network. It covers App JWT claims, installation-token
caching, webhook signature rejection, the installation lifecycle events, the
webhook-triggered review path, and the connect flow's installed / not-installed
branches. CI runs it plus the frontend lint and build on every push.

---

## Deployment

The frontend is a static bundle on S3 behind CloudFront:

```bash
cd frontend
npm run build
aws s3 sync dist/ s3://<bucket>/ --delete
aws cloudfront create-invalidation --distribution-id <id> --paths "/*"
```

The invalidation is not optional — without it CloudFront keeps serving the previous
JS bundle.

The backend deploys with `eb deploy`. **Migrations are a deliberate manual step** —
nothing in the Dockerfile runs `alembic upgrade head`, so schema changes are applied
by pointing `DATABASE_URL` at RDS and running Alembic directly, immediately before
the code deploy. See [Engineering decisions](#engineering-decisions) for why that
ordering matters.

---

## Engineering decisions

**Structured output instead of prompt-and-parse.** Findings come back through a
`response_schema` bound to Pydantic models whose `severity` and `category` fields
are the same enums the database columns use. There is no parsing layer and no
"model returned something weird" branch — a malformed response fails at the API
boundary.

**Tool results are fed back as content, not concatenated into the prompt.** Each
tool response is appended as a `function_response` part, so the model sees a real
conversation and can chain calls (read the diff, then decide it wants history). The
loop is capped at five iterations to bound cost and latency.

**Background task plus polling, not a queue.** Reviews run in a FastAPI background
task and the client polls the run's status. A proper worker (Celery, SQS) would be
the right call at scale, but for a single-instance app it adds infrastructure
without changing the user-visible behaviour. The tradeoff is explicit: a deploy
mid-review loses that run, which is why every run's terminal state is persisted
rather than held in memory.

**Timezone-aware timestamps, learned the hard way.** The schema originally used
naive `DateTime` columns written with `datetime.now()`, so the API emitted
timestamps with no offset. JavaScript parses a timezone-less ISO string as *local*
time, so every relative timestamp in the UI rendered in the future — "connected in
7 hours". Fixed on both sides: all columns are now `timestamptz`, all writes use
`datetime.now(timezone.utc)`, and the frontend defensively normalises any timestamp
that arrives without an offset.

That fix is also a small two-phase deploy problem, which is why migrations run
before the code deploy. `get_valid_access_token` compares
`datetime.now(timezone.utc)` against a stored expiry; mixing an aware and a naive
datetime raises `TypeError`, so either half deployed alone breaks every
authenticated request. Migrate, then deploy, close together.

**A token-based design system rather than a component library.** The UI is built on
CSS custom properties (surfaces, a three-step text ramp, accent, status colors,
radii) consumed through CSS Modules. Chart colors were validated rather than chosen
by eye — checked for colorblind separation and contrast against the actual dark
surface they render on — and severity is never encoded by color alone, always
color plus a text label.

**Installation tokens, not user tokens, for repository reads.** The first version
was a classic OAuth App with the `repo` scope, which grants write access to code,
issues, wikis, and settings on every repository the user can touch — far more than
a reviewer needs — and its webhook handler had to borrow a token from a Revue user
matching the PR author, so a collaborator's PR was silently ignored. Moving to a
GitHub App made the permission grant *Contents: read* + *Pull requests: read*, made
webhooks app-level instead of per-repository, and let the agent act as `revue[bot]`
regardless of who opened the PR. The user's OAuth token is now identity-only.

**Answer every tool call in the turn.** Gemini will request several tools in a
single response — in practice it asks for the diff, the history, the security scan,
and the repo memory all at once. An early version of the loop read only the first
part of the response, answered that one call, and left the model to re-request the
others on the next iteration, burning the five-iteration budget on repeats. The loop
now collects every `function_call` part, runs them all, and returns all the
`function_response` parts in one user turn. A single-file review went from roughly a
minute and a half to about five seconds.

**One place for fetch behaviour.** Every authenticated request needs
`credentials: 'include'` (for the cross-origin cookie) and a redirect to the login
page on `401`. That lives in a single `apiFetch` helper and a `useApiQuery` hook
rather than being repeated per page.

---

## Known limitations

Honest list of what this does not do yet:

- **Findings are not posted back to GitHub.** Reviews live in the Revue UI. Writing
  them as PR review comments is the obvious next step.
- **No background worker.** Reviews run in-process; a deploy during a review loses
  that run.
- **The security tool is regex heuristics**, not real static analysis. It exists to
  give the agent a cheap signal to corroborate, not to be authoritative.
- **`repo_memory` grows without bound and is never compacted.** Each review rewrites
  a file's summary, so quality depends on the model's summarisation holding up over
  many generations.
- **Rate limiting is a row count, not a token budget.** Five reviews per user per
  day regardless of how large those pull requests are.
- **RDS is publicly accessible**, locked down by security group rather than living
  in a private subnet behind a bastion — a deliberate simplification for a solo
  project.
- **The PR detail page fetches the repository's full PR list** to resolve one pull
  request's title, because there is no single-PR endpoint.
