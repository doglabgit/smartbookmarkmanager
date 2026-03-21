# Runbook: Smart Bookmark Manager API

This runbook covers common operational tasks for the API service.

## Prerequisites

- Node.js 18+
- PostgreSQL database
- Access to server/container where the app is running

## Quick Start (Local Development)

1. **Clone and install**
   ```bash
   git clone <repo>
   cd smartbookmarkmanager
   npm install
   ```

2. **Configure environment**
   ```bash
   cp apps/api/.env.example apps/api/.env
   # Edit .env with your DATABASE_URL and JWT_SECRET
   ```

3. **Set up database**
   ```bash
   cd apps/api
   npx prisma migrate dev
   npx prisma generate
   ```

4. **Run development servers**
   ```bash
   # From project root
   npm run dev
   ```

   - API: http://localhost:3000
   - Web (Next.js): http://localhost:3001

## Deployment

### Using Docker

```bash
# Build image
docker build -t smartbookmark-api -f apps/api/Dockerfile .

# Run container
docker run -d \
  -p 3000:3000 \
  -e DATABASE_URL=postgresql://... \
  -e JWT_SECRET=... \
  -e CLAUDE_API_KEY=... \
  -e NODE_ENV=production \
  --name bookmark-api \
  smartbookmark-api
```

### Using Node.js (bare metal / VM)

```bash
# Install dependencies
cd apps/api
npm ci --only=production

# Build Prisma client
npx prisma generate

# Set environment variables (in .env or systemd service file)

# Start with PM2 (recommended)
pm2 start index.js --name bookmark-api

# Or start manually
NODE_ENV=production node index.js
```

**Systemd service example** (`/etc/systemd/system/bookmark-api.service`):
```ini
[Unit]
Description=Smart Bookmark API
After=network.target postgresql.service

[Service]
Type=simple
User=bookmark
WorkingDirectory=/opt/bookmark-api
EnvironmentFile=/opt/bookmark-api/.env
ExecStart=/usr/bin/node index.js
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

## Database Migrations

### Apply new migrations
```bash
cd apps/api
npx prisma migrate deploy
```

### Reset database (WARNING: destroys data)
```bash
cd apps/api
npm run test:reset  # Uses TRUNCATE, safer than drop
# Or for full reset:
npx prisma migrate reset
```

## Health Checks

- **Liveness**: `GET /healthz`
  - Returns 200 if database is reachable
  - Returns 503 if database connection fails

- **Readiness**: Same as liveness (no separate readiness endpoint)

- **Metrics**: `GET /metrics` (Prometheus format)

## Logging

Logs are written to:
- Console (stdout/stderr) — captured by Docker/PM2
- Daily rotated files in `logs/` directory (JSON format, 14-day retention)
- Separate error log in production: `logs/error-YYYY-MM-DD.log`

**Log levels**:
- `debug` — development only
- `info` — general events (startup, enrichment complete)
- `warn` — recoverable issues (metadata fetch failure, Claude skip)
- `error` — failures requiring attention

**Request tracing**: Each request gets a `X-Request-ID` header. Use this to search logs for a complete request lifecycle.

## Monitoring

### Key Metrics (from `/metrics`)

- `http_requests_total` — request count by method, route, status
- `http_request_duration_seconds` — latency histogram
- `enrichment_active` — currently running enrichment jobs
- `enrichment_success_total` — completed enrichments
- `enrichment_failure_total` — failed enrichments
- `claude_api_calls_total` — Claude API usage

### Alerts to Consider

Set up alerts (Sentry, Prometheus Alertmanager, etc.) for:

- **Error rate**: 5xx responses > 5% over 5 minutes
- **Enrichment failures**: Failure rate > 10% over 10 minutes
- **Database connectivity**: /healthz returns 503
- **High latency**: p95 > 200ms for API endpoints
- **Claude API errors**: 429 or 5xx from Anthropic

## Common Tasks

### View logs

```bash
# Docker
docker logs -f bookmark-api

# PM2
pm2 logs bookmark-api

# Systemd
journalctl -u bookmark-api -f

# File logs (if not containerized)
tail -f logs/application-$(date +%Y-%m-%d).log
```

### Restart service

```bash
# Docker
docker restart bookmark-api

# PM2
pm2 restart bookmark-api
pm2 save

# Systemd
sudo systemctl restart bookmark-api
```

### Manually re-enrich a bookmark

If a bookmark failed enrichment (e.g., Claude API was down), you can trigger it manually:

```bash
# Enter running container or interactive node shell
docker exec -it bookmark-api node
> const { enrichBookmark } = require('./src/services/enrichment');
> await enrichBookmark(BOOKMARK_ID);
```

Or from an API endpoint (admin protected) if implemented.

### Database schema changes

1. Update `apps/api/prisma/schema.prisma`
2. Generate migration: `npx prisma migrate dev --name your_change`
3. Apply to all environments: `npx prisma migrate deploy`
4. Generate client: `npx prisma generate`

### Rotate JWT_SECRET

**Warning**: Rotating JWT secret will invalidate all existing tokens, forcing all users to log in again.

1. Generate a new strong random secret (64+ chars)
2. Update `.env` and restart service
3. (Optional) Support dual-secret transition by verifying against both old and new, but that's advanced.

### Rate limiting adjustments

Edit `apps/api/src/middleware/rateLimiter.js`:

- Auth endpoints: default 5 per minute per IP
- Bookmark creation: default 30 per minute per user

Adjust `windowMs` and `max` values in each `createRateLimiter` call.

For multi-instance deployments, set `REDIS_URL` env var to use Redis store.

## Troubleshooting

### 503 Service Unavailable from /healthz

- Check database is running and accessible
- Verify DATABASE_URL is correct
- Check network/firewall rules
- Look for DB connection pool exhaustion in logs

### High error rate

- Check `/metrics` or logs for 5xx errors
- Look for unhandled rejections or database errors
- Verify Claude API key (if error occurs during enrichment)
- Check rate limiting (429 responses)

### Enrichment jobs piling up

- `enrichment_active` metric will be high
- Increase `ENRICHMENT_CONCURRENCY` (but watch DB pool)
- Check for slow external calls (metadata fetch, Claude API)
- Consider Redis caching for Claude responses if duplicate URLs common

### CSRF errors (403)

- Frontend must send `X-CSRF-Token` header matching `csrfToken` cookie
- Ensure cookie is not blocked by browser settings
- Cookie is set on login/register only; after logout, need to re-login

### Request tracing

To debug a specific request:

1. Get the `X-Request-ID` from response headers or frontend
2. Search logs for `requestId="<value>"`
3. All logs for that request (including background enrichment if propagated) will have the same requestId

## Security

- **JWT_SECRET**: Must be at least 32 random characters; rotate periodically
- **Rate limiting**: Enabled on auth (5/min) and bookmark creation (30/min)
- **CSRF**: Double-submit cookie; frontend must send header
- **CORS**: Origins from `ALLOWED_ORIGINS` only; credentials allowed
- **Helmet**: Security headers (HSTS, XSS, etc.) enabled
- **SSRF protection**: Metadata fetch blocks private IP ranges and localhost

## Incident Response

If service is down:

1. Check `/healthz` endpoint
2. Check database connectivity
3. Check disk space (logs rotation should prevent fill-up)
4. Check recent deploys — rollback if new release caused issue
5. If process crashed, check logs for unhandledRejection/exception
6. Restart service if necessary

## Post-Mortem Template

After any outage:

- What happened?
- Root cause
- Impact (users affected, duration)
- How we fixed it
- How we prevent recurrence (monitoring, alerts, code change)

Document in incident reports.

---

**Contact/Support**: [Team channel/on-call rotation details]
