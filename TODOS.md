# TODOS

**Smart Bookmark Manager — Production Readiness Plan**

This TODO list tracks the 3-month plan to transform the MVP into a production-ready, maintainable, observable system. Items are organized by priority (P0 = critical, P1 = high, P2 = medium, P3 = low, P4 = deferred) and by phase.

---

## Phase 1: Testing & Quality Foundation (Weeks 1-3)

### P0: Critical Path to Shipping

- **Refactor route handlers to use `asyncHandler` wrapper**
  - What: Eliminate duplicated try/catch in all route files by creating `utils/asyncHandler.js` that wraps handlers.
  - Why: DRY violation currently means every route has identical boilerplate. Centralizing ensures consistent error handling and makes tests cleaner.
  - Pros: Less code, single source of truth, easier to add structured logging.
  - Cons: Minimal refactor risk.
  - Context: All route files have the same try/catch pattern.
  - Effort: S
  - Priority: P0
  - Depends on: None
  - Decision: Issue #12 - A (refactor before tests)

- **Implement exportable `triggerEnrichment` for testing**
  - What: Change `triggerEnrichment` from inner function to named export so tests can import and mock it.
  - Why: Need to unit-test that bookmark creation triggers enrichment without leaking unhandled rejections.
  - Pros: Enables direct unit testing.
  - Cons: Slight API surface increase.
  - Context: Currently defined inside bookmarks.js, hard to test.
  - Effort: S
  - Priority: P0
  - Depends on: None
  - Decision: Issue #1 - A (export directly)

- **Add structured logging with Winston (JSON + rotation)**
  - What: Replace all console.* with winston. JSON format, log level from env, daily-rotate-file transport.
  - Why: Structured logs essential for debugging and alerting. Rotation prevents disk full crashes.
  - Pros: Centralized, machine-parseable, includes timestamps/levels/requestIds. Rotation adds resilience.
  - Cons: New dependency, configuration.
  - Context: Uses console.error everywhere.
  - Effort: M
  - Priority: P0
  - Depends on: None
  - Decision: Issue #13 - A (include rotation)

- **Add request ID middleware and propagate to logs**
  - What: Generate X-Request-ID UUID per request. Attach to req, include in all log entries. Propagate to async context (enrichment).
  - Why: Enables tracing request lifecycle. Essential for support.
  - Pros: Can search logs by request ID to see full path.
  - Cons: Need async context storage (cls-hooked) to propagate across async boundaries.
  - Context: Enrichment runs in background; need request ID there too.
  - Effort: M
  - Priority: P0
  - Depends on: asyncHandler refactor
  - Decision: Implement middleware + cls-hooked

- **Add health check endpoint (`/healthz`)**
  - What: GET /healthz returns 200 only if DB reachable (simple query).
  - Why: Kubernetes/load balancers need health check.
  - Pros: Simple, critical for deployment.
  - Cons: None.
  - Effort: S
  - Priority: P0
  - Depends on: None

- **Write smoke test: full auth flow**
  - What: Supertest: POST /register → 201, POST /login → 200, GET /me → 200, POST /logout → 200.
  - Why: Verify core auth cycle works.
  - Pros: Catches auth regressions early.
  - Cons: Requires test DB.
  - Effort: S
  - Priority: P0
  - Depends on: Test DB ready

### P1: High Priority

- **API test suite for all routes**
  - What: Unit/integration tests for each route handler (happy, validation errors, auth errors, DB errors). Use Supertest, mock Prisma.
  - Why: 0% coverage now. Need comprehensive suite.
  - Pros: Confidence, catch bugs.
  - Cons: Time-consuming.
  - Context: ~30 endpoints.
  - Effort: L
  - Priority: P1
  - Depends on: asyncHandler, test DB, mocks
  - Decision: All routes get tests

- **Enrichment service unit tests**
  - What: Test fetchMetadata (200, 404, timeout, malformed HTML, redirects, huge page). Test generateSummary (valid, empty, error, 429, 5xx, malformed JSON).
  - Why: External API calls need failure mode validation.
  - Pros: Fast, isolated, simulate hard-to-trigger failures.
  - Cons: Need careful fetch mocking.
  - Effort: M
  - Priority: P1
  - Depends on: Mock setup
  - Decision: Full success/failure coverage

- **Enrichment integration test**
  - What: Create bookmark → wait for enrichment → verify DB updated. Mock external calls.
  - Why: Prove fire-and-forget pipeline works and never throws to caller.
  - Pros: Tests entire async flow.
  - Cons: Need async timing control.
  - Effort: M
  - Priority: P1
  - Depends on: Test DB, mocks, wait mechanism
  - Decision: Use real DB but mock HTTP

- **Frontend component/page tests**
  - What: RTL tests for BookmarkCard, AddForm, FilterBar, BookmarksPage.
  - Why: Frontend bugs currently untested.
  - Pros: Fast feedback on UI logic.
  - Effort: M
  - Priority: P1
  - Depends on: Jest + RTL
  - Decision: Test core interactions

- **Jest coverage thresholds (≥80% statements, ≥70% branches)**
  - What: Configure coverageThresholds, fail if below.
  - Why: Maintain high coverage, prevent erosion.
  - Pros: Quantitative quality gate.
  - Cons: May need file exemptions.
  - Effort: S
  - Priority: P1
  - Depends on: Baseline tests exist
  - Decision: Set after initial suite, enforce thereafter

- **Pre-commit hook (lint + typecheck) + pre-push (tests)**
  - What: husky + lint-staged. Pre-commit: lint + typecheck. Pre-push: tests. Or rely on CI for tests.
  - Why: Local quality gates.
  - Pros: Catch early.
  - Cons: Test speed may impede.
  - Effort: S
  - Priority: P1
  - Decision: Pre-commit lint+typecheck; tests in CI/pre-push

- **GitHub Actions CI with branch protection**
  - What: .github/workflows/ci.yml running typecheck, lint, test. Require green before merge.
  - Why: Automated gate on every push.
  - Pros: Consistent, central.
  - Cons: CI time ~5-10min.
  - Effort: M
  - Priority: P1
  - Depends on: Reliable tests
  - Decision: CI on PRs, require passing

- **Database test isolation strategy**
  - What: Dedicated test DB (DATABASE_URL_TEST). Reset between runs with prisma migrate reset or truncate. Configure Jest.
  - Why: Prevent cross-contamination, production parity (Postgres not SQLite).
  - Pros: Clean isolation, realistic.
  - Cons: Slower, need separate DB.
  - Effort: M
  - Priority: P1
  - Depends on: Postgres locally/CI
  - Decision: A (dedicated test DB, truncate)

- **Add Playwright E2E tests (2-3 journeys)**
  - What: (1) Register → login → create bookmark, (2) Search/tag filtering, (3) Edit/delete. Run in CI.
  - Why: Catch full-stack integration issues.
  - Pros: High confidence.
  - Cons: Slow, brittle, maintenance.
  - Effort: L
  - Priority: P1
  - Depends on: App runnable in test env
  - Decision: Issue #14 - A (3 smoke tests)

- **Test that `enrichBookmark` never throws/rejects**
  - What: Integration test: POST /bookmarks with mocked external services that throw. Assert POST is 201 and no unhandledRejection event fires.
  - Why: Critical guarantee: enrichment fire-and-forget must never crash request or process.
  - Pros: Proves resilience.
  - Cons: Complex setup.
  - Effort: M
  - Priority: P1
  - Depends on: Test DB, mocks, event monitoring
  - Decision: Issue #11 - A (integration test with unhandledRejection listener)

---

## Phase 2: Security, Error Handling & Observability (Weeks 4-6)

### P0: Critical Security

- **Rate limiting on auth endpoints (5/min per IP)**
  - What: express-rate-limit on /api/auth/*. 5 req/min per IP.
  - Why: Prevent brute force.
  - Effort: S
  - Priority: P0
  - Decision: Issue #7 - A (rate limit auth)

- **Rate limiting on bookmark creation (30/min per userId)**
  - What: Rate limit POST /api/bookmaps based on userId. 30/min.
  - Why: Prevent abuse/flood/enrichment overload.
  - Effort: S
  - Priority: P0
  - Depends on: Auth middleware
  - Decision: Issue #7 - A (rate limit creation)

- **Request validation with Zod schemas**
  - What: Zod schemas for all POST/PATCH bodies. Validate in middleware. Return 400 with details.
  - Why: Input currently trusted. Need types, lengths, formats.
  - Pros: Centralized, declarative, derive TS types.
  - Cons: New dep, maintenance.
  - Effort: M
  - Priority: P0
  - Decision: Issue #2 (Context) - Use Zod, cover register/login/bookmark

- **Add Helmet middleware**
  - What: app.use(helmet()). Adjust CSP for Tailwind.
  - Why: Security headers (HSTS, XSS, clickjacking).
  - Effort: S
  - Priority: P0
  - Decision: Install, apply globally, tune CSP

- **CSRF protection (double-submit cookie)**
  - What: Generate CSRF token on session, set readable cookie + require X-CSRF-Token header for state-changing requests. Validate.
  - Why: SameSite=Lax insufficient.
  - Pros: Industry standard.
  - Cons: Need frontend changes.
  - Effort: M
  - Priority: P0
  - Depends on: Frontend mod to read cookie and send header
  - Decision: Issue #2 (Context) - double-submit, readable cookie

- **Input sanitization (trim, normalize)**
  - What: In Zod schemas: trim strings, lowercase email, lowercase+trim tag names.
  - Why: Prevent inconsistencies, duplicate tags, duplicate accounts.
  - Effort: S
  - Priority: P0
  - Depends on: Zod schemas
  - Decision: Issue #2 (Context) - add transforms

- **Validate URL protocol and length + SSRF protection**
  - What: Reject non-http(s) protocols, max 2048 chars. In metadata fetch: block private IP ranges (127.0.0.1, 10/8, 172.16/12, 192.168/16, ::1).
  - Why: Prevent SSRF attacks probing internal network.
  - Pros: Critical security.
  - Cons: Need ipaddr.js package, IP resolution.
  - Effort: M
  - Priority: P0
  - Decision: Issue #2 (Context) - protocol check in route, IP block in metadata.js

- **Centralized error middleware with custom error classes**
  - What: Create error classes (ValidationError, AuthError, NotFoundError, RateLimitError, ExternalServiceError, DatabaseError). Error middleware maps to status codes/json. asyncHandler passes errors to it. Refactor routes to throw errors instead of responding directly for errors.
  - Why: Replace generic 500s with specific, user-friendly, debuggable errors.
  - Pros: Consistent, debuggable, frontend can react.
  - Cons: Significant route refactor (change return patterns to throws).
  - Effort: L
  - Priority: P0
  - Depends on: asyncHandler
  - Decision: Issue #2 (Context) - full refactor

### P1: Observability & Resilience

- **Concurrency control for enrichment (semaphore)**
  - What: async-sema with limit 10. Wrap enrichBookmark core.
  - Why: Prevent unlimited concurrent jobs from exhausting DB pool/Claude.
  - Effort: S
  - Priority: P1
  - Decision: Issue #4 - A (semaphore in Phase 2)

- **Global unhandledRejection/uncaughtException handlers**
  - What: In index.js: process.on('unhandledRejection', logger.error + exit(1)); same for uncaughtException.
  - Why: Fail fast, avoid corrupt state. Let process manager restart.
  - Pros: Clear crash with logs.
  - Cons: In-flight requests dropped.
  - Effort: S
  - Priority: P1
  - Depends on: Logger initialized first
  - Decision: Standard pattern

- **Prometheus metrics endpoint (`/metrics`)**
  - What: Use prom-client. Expose: request counts by (method, route pattern, status), latency histograms, enrichment active count, Claude call count.
  - Why: Quantitative visibility, alerting.
  - Pros: Industry standard.
  - Cons: Cardinality management needed.
  - Effort: M
  - Priority: P1
  - Depends on: Route instrumentation middleware
  - Decision: Implement with careful labels

- **Configure Sentry (backend + frontend)**
  - What: Add @sentry/node and @sentry/react. Initialize with DSN. Capture unhandled errors, performance traces (10%). Configure beforeSend to scrub PII.
  - Why: Centralized error aggregation with rich context.
  - Pros: Debugging goldmine.
  - Cons: Cost after free tier, vendor lock-in.
  - Effort: M
  - Priority: P1
  - Decision: Issue #2 (Context) - both backend and frontend

- **Detailed enrichment lifecycle logging**
  - What: Log at key stages: start, metadata result, Claude result, update complete, failures. Include bookmarkId, userId, url, durationMs. Also log scheduling with requestId.
  - Why: Diagnose enrichment issues, measure performance.
  - Effort: S
  - Priority: P1
  - Depends on: Logger, requestId propagation
  - Decision: Add structured logs with timing

- **Dead-letter queue for enrichment failures**
  - What: Prisma model EnrichmentFailure (bookmarkId, userId, url, error, attempts, lastAttemptAt). After 3 attempts, move to DLQ. Admin endpoint to retry/clear.
  - Why: Permanent failures shouldn't retry forever. Track failure patterns.
  - Pros: Resource savings, admin control.
  - Cons: Extra DB table, logic.
  - Effort: M
  - Priority: P1
  - Decision: Issue #2 (Context) - 3-retry limit with exponential backoff

- **Alerting rules (Sentry + Prometheus)**
  - What: Sentry error rate alerts. Prometheus Alertmanager: error rate >5% (5min), enrichment failure rate >10%, Claude error >5%, DB pool >80%, /metrics down. Notify Slack.
  - Why: Proactive incident response.
  - Pros: Know before users complain.
  - Cons: Alert fatigue risk.
  - Effort: M
  - Priority: P1
  - Depends on: Metrics + Sentry
  - Decision: Issue #2 (Context) - basic alerts to Slack, tune after 2 weeks

- **Implement structured logging (replace all console.*)**
  - What: Install winston. logger.js with transports (console JSON, daily-rotate-file). Replace all console.*. Ensure logs include requestId, userId, route, method via cls-hooked.
  - Why: Unstructured logs unparseable.
  - Pros: Consistent, parseable, contextual.
  - Cons: Update many files, need context propagation.
  - Effort: L
  - Priority: P1
  - Depends on: Request ID mechanism
  - Decision: Issue #13 - A (winston + rotation)

---

## Phase 3: Performance & Scalability (Weeks 7-9)

### P1

- **Add database indexes via Prisma migrations**
  - What: Migration with indexes: Bookmark(userId, createdAt) DESC, Bookmark(userId, enrichedAt), Tag(name) separate. Use CONCURRENTLY in prod.
  - Why: Pagination and tag lookups will be slow without composite indexes.
  - Pros: Scales to thousands.
  - Cons: Write overhead minimal.
  - Effort: S
  - Priority: P1
  - Decision: Add three indexes, use expand-contract if needed

- **Implement cursor-based pagination**
  - What: Replace page/skip with cursor (bookmark ID). Query: `where: { id: { lt: cursor } }` with `orderBy: { id: desc }`. Return nextCursor.
  - Why: Offset pagination slow on large skips. Cursor is constant-time.
  - Pros: Scales infinitely.
  - Cons: Frontend needs update (infinite scroll or Load More).
  - Effort: M
  - Priority: P1
  - Decision: Switch fully, update frontend

- **Add response compression (gzip)**
  - What: app.use(compression()).
  - Why: Reduce bandwidth, faster responses.
  - Pros: One line, free win.
  - Cons: Minor CPU.
  - Effort: S
  - Priority: P1
  - Decision: Enable globally

- **Add maxLimit safeguard (100)**
  - What: Clamp limit param: `limit = Math.min(Number(limit), MAX_LIMIT)` where MAX_LIMIT=100.
  - Why: Prevent resource exhaustion via huge limit.
  - Pros: Security, stability.
  - Cons: None.
  - Effort: S
  - Priority: P1
  - Depends on: Pagination code
  - Decision: Issue #16 - A (clamp to 100)

### P2

- **Redis caching (optional, metrics-driven)**
  - What: If needed, cache per-user tag lists (TTL 5min) and Claude summaries by URL hash.
  - Why: Reduce DB load and Claude costs.
  - Pros: Performance + cost savings.
  - Cons: Infrastructure dep, invalidation complexity.
  - Effort: M
  - Priority: P2
  - Decision: Issue #17 - Defer until metrics indicate need; consider in-memory LRU interim

- **Batch tag operations (bulk upsert)**
  - What: In bookmark create/update, use bulk upsert for tags instead of individual upserts. Could use Prisma's `createMany` or raw query.
  - Why: N tag operations = N queries. Bulk reduces DB round trips.
  - Pros: Faster for users with many tags.
  - Cons: Need to handle conflicts/duplicates manually.
  - Effort: M
  - Priority: P2
  - Decision: Implement if profiling shows tag ops slow

---

## Phase 4: Feature Expansion & Polish (Weeks 10-12)

### P1: High-Value User Features

- **Bulk operations (multi-select, bulk delete, bulk tag edit)**
  - What: Checkboxes on bookmark cards, bulk actions toolbar, optimistic UI updates with rollback on error.
  - Why: Power users need to manage many bookmarks efficiently.
  - Pros: Major UX improvement.
  - Cons: UI complexity, edge cases (selection state, conflicts).
  - Effort: L
  - Priority: P1

- **Import/Export (JSON + HTML/Netscape)**
  - What: Export: download bookmarks as JSON (full data) and HTML (browser import format). Import: upload file, validate, preview, import with deduplication (URL match). Async job with progress indicator.
  - Why: Users bring existing bookmarks from other services; backup/portability.
  - Pros: Essential for adoption.
  - Cons: Complex parsing (HTML format varies), large imports need async.
  - Effort: L
  - Priority: P1
  - Decision: Implement both formats, async with progress

- **Advanced search (full-text + date ranges + query syntax)**
  - What: PostgreSQL tsvector for full-text on title/description. Date range filters (createdAt, enrichedAt). Query syntax: `tag:work url:example.com "meeting notes"`. Highlight results with ts_highlight.
  - Why: Powerful search is core bookmarking use case.
  - Pros: Differentiates from competitors.
  - Cons: tsvector maintenance (trigger on update), query parsing complexity.
  - Effort: L
  - Priority: P1
  - Decision: Build with tsvector and simple parser; highlight with ts_headline

- **Tag management UI (list, rename, merge, delete)**
  - What: Dedicated page: list all tags with counts, rename, merge (consolidate bookmarks), delete unused tags. Tag color coding optional.
  - Why: Users need to organize tags; messy tag sprawl is common.
  - Pros: Improves organization.
  - Cons: Merge operation needs careful DB transaction.
  - Effort: M
  - Priority: P1
  - Decision: Implement with atomic merge transaction

### P2: UX Polish

- **Skeleton loaders instead of spinners**
  - What: Replace "Loading bookmarks..." pulse with skeleton UI mimicking bookmark cards.
  - Why: Better perceived performance.
  - Effort: S
  - Priority: P2

- **Empty states with illustrations/CTAs**
  - What: Design nice empty states for no bookmarks, no search results, no tags.
  - Why: First-time user experience.
  - Effort: S
  - Priority: P2

- **Toast notifications for actions**
  - What: Toast system (success/error) for bookmark create/edit/delete/enrichment status.
  - Why: Immediate feedback, better than inline errors only.
  - Effort: M
  - Priority: P2
  - Decision: Use simple toast library (react-hot-toast)

- **Keyboard shortcuts**
  - What: k/j for navigation, / for search focus, c for create, Escape to close modal.
  - Why: Power users expect keyboard efficiency.
  - Pros: Delightful.
  - Cons: Need to manage focus, conflict with browser shortcuts.
  - Effort: M
  - Priority: P2

- **Bookmark preview on hover**
  - What: Lightweight API call on hover to fetch title/description (maybe cached). Show tooltip.
  - Why: Quick peek without opening.
  - Pros: Nice UX.
  - Cons: Network overhead, could be abused (hundreds of hovers).
  - Effort: M
  - Priority: P2
  - Decision: Debounce hover, cache aggressively, rate limit per user

- **Dark mode toggle**
  - What: Theme switcher using Tailwind dark mode. Persist preference in localStorage.
  - Why: Standard expectation.
  - Effort: S
  - Priority: P2

### P2: AI Enhancements

- **Auto-tagging with Claude**
  - What: After metadata fetch, call Claude to suggest 3-5 tags. User can accept/edit before save? Or auto-apply with opt-out.
  - Why: Reduces manual tagging.
  - Pros: Clever AI feature.
  - Cons: Cost, accuracy issues.
  - Effort: M
  - Priority: P2
  - Decision: Suggest tags in UI after create, let user confirm

- **Editable AI summaries**
  - What: Allow user to edit aiSummary field. Save as user custom summary. Maybe distinguish AI vs custom?
  - Why: AI not perfect; user should override.
  - Effort: S
  - Priority: P2

- **Weekly digest email**
  - What: Cron job (weekly) to email user list of bookmarks added that week with summaries. Use Resend or SendGrid.
  - Why: Re-engagement, remind users of saved content.
  - Pros: Retention.
  - Cons: Cost, email deliverability, Claude token costs for many bookmarks.
  - Effort: L
  - Priority: P2
  - Decision: Opt-in only; batch Claude calls with caching

- **Related bookmarks (semantic similarity)**
  - What: Use Claude embeddings or simple tag overlap to find similar bookmarks. Show "Related" section on bookmark detail.
  - Why: Discoverability.
  - Pros: Smart feature.
  - Cons: Complex, expensive (embeddings API), may not add much value.
  - Effort: XL
  - Priority: P3
  - Decision: Defer to post-3-months; use simple tag overlap first as MVP

---

## Phase 5: Infrastructure & DevOps (Parallel throughout)

### P1

- **CI/CD pipeline (GitHub Actions)**
  - What: Workflow: on PR: typecheck, lint, test; on merge to main: build Docker images, deploy to staging; manual approval for prod. Automate DB migrations before deploy.
  - Why: Automated quality gates and deployment.
  - Pros: Consistent, fast.
  - Cons: Setup complexity.
  - Effort: M
  - Priority: P1
  - Decision: Implement full pipeline with manual prod approval

- **Containerization**
  - What: Multi-stage Dockerfile for API (node:alpine). For web: next build, then nginx or node:alpine. docker-compose for local dev (replace npm run dev).
  - Why: Consistent environments, easier deployment.
  - Pros: Portability.
  - Cons: Docker learn curve.
  - Effort: M
  - Priority: P1
  - Decision: Both images, docker-compose local

- **Environment configuration validation**
  - What: Use envalid or zod to validate required env vars on startup (DATABASE_URL, JWT_SECRET, etc.). Provide defaults where safe. Fail fast if missing.
  - Why: Prevent runtime errors from missing config.
  - Pros: Catch misconfiguration early.
  - Cons: Boilerplate.
  - Effort: S
  - Priority: P1
  - Decision: Validate at app start, log parsed config

- **Monitoring & Alerting setup**
  - What: Set up Sentry project (done earlier). Set up Prometheus + Grafana (or use managed). Configure alerts (already defined). Uptime monitoring (UptimeRobot) for /healthz.
  - Why: Production visibility.
  - Pros: Know when things break.
  - Cons: Ops overhead.
  - Effort: M
  - Priority: P1
  - Decision: Use managed where possible (Sentry, Grafana Cloud), self-host if needed

### P2

- **Documentation**
  - What: Update README with deployment steps per provider. Contributing guide (code standards, commit conventions). Architecture diagram (ASCII). Runbooks for common tasks (rollback, reprocess enrichment, clear cache, restart services). OpenAPI/Swagger spec for API. Maintain CHANGELOG.
  - Why: Onboarding, operational stability.
  - Pros: Reduces bus factor, faster incident response.
  - Cons: Documentation rot.
  - Effort: L
  - Priority: P2
  - Decision: Write comprehensive docs, keep updated as part of PR checklist

---

## Cross-Cutting Concerns (All Phases)

- **Accessibility (WCAG 2.1 AA)**
  - What: Keyboard navigation, ARIA labels, color contrast checks. Use Lighthouse CI with minimum scores.
  - Priority: P1
  - Decision: Build accessibility into components from start, audit before Phase 4

- **Performance budgets**
  - What: LCP < 2.5s, TTI < 3s, API p95 < 200ms. Measure in CI (Lighthouse).
  - Priority: P1
  - Decision: Track and enforce

- **Mobile responsiveness**
  - What: Test on mobile viewports, touch interactions.
  - Priority: P1
  - Decision: Tailwind already mobile-first; verify

- **Internationalization framework**
  - What: Extract strings to JSON, set up i18n (next-i18next). Even if EN only, prepares for future.
  - Priority: P2
  - Decision: Add i18n infrastructure in Phase 4, no translations yet

- **Dependency management**
  - What: Enable Dependabot alerts, weekly security scans, license compliance check.
  - Priority: P2
  - Decision: Use GitHub native security features

---

## Phases 1-5 Summary

- **Phase 1 (Weeks 1-3):** Foundation: refactor asyncHandler, export trigger, structured logging, request ID, health check, auth smoke test, then comprehensive test suite (API unit/integration, enrichment unit/integration, frontend components, E2E). Also: centralized errors, semaphore, global error handlers, metrics, Sentry, DLQ, alerts.
- **Phase 2 (Weeks 4-6):** Security & Observability: rate limiting (auth + creation), validation (Zod), Helmet, CSRF, sanitization, SSRF protection, DB indexes, cursor pagination, compression, maxLimit. Also complete structured logging roll-out.
- **Phase 3 (Weeks 7-9):** Performance: indexes, cursor pagination (frontend update), compression, maxLimit, optional Redis caching if needed, bulk tag ops.
- **Phase 4 (Weeks 10-12):** Features: bulk ops, import/export, advanced search, tag management, UX polish (skeletons, toasts, shortcuts, dark mode), AI enhancements (auto-tagging, editable summaries, weekly digest).
- **Phase 5 (Parallel):** DevOps: CI/CD, containerization, env validation, monitoring, documentation.

---

## Notes

- All decisions reference the CEO plan review issues (1-21).
- P0 items must be completed before shipping Phase 4 features.
- Testing targets: ≥80% statement coverage, ≥70% branch coverage after Phase 1.
- Security hardening is non-negotiable; implement all P0 security items in Phase 2 before production deploy.
- Observability (logs, metrics, alerts) must be in place before Phase 4 features ship to monitor their behavior.
- Re-evaluate priorities monthly based on emerging risks and user feedback.
