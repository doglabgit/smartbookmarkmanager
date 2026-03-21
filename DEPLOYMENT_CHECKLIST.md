# Production Deployment Checklist

Use this checklist before deploying Smart Bookmark Manager to production.

## Pre-Deployment Validation

### Code Quality
- [x] All tests passing (`npm test`)
- [x] ESLint passes without errors (`npm run lint`)
- [x] TypeScript type checking passes (`npm run typecheck`)
- [x] No console.error/console.warn in production code (only in development)
- [x] All secrets are in environment variables, not hardcoded

### Security
- [x] CSRF protection enabled and tested
- [x] CORS configured with specific origins (no wildcard `*`)
- [x] JWT_SECRET is at least 32 characters
- [x] Helmet middleware enabled with CSP
- [x] Rate limiting applied to all write endpoints and sensitive reads
- [x] SSRF protection in metadata fetch service
- [x] Password hashing with bcrypt (cost factor 10+)
- [x] httpOnly cookies for JWT
- [x] SameSite cookies set to lax/strict

### Database
- [x] Prisma schema finalized
- [x] Migrations created (`npx prisma migrate dev` for dev, `npx prisma migrate deploy` for prod)
- [x] Database indexes defined for query patterns
- [x] Connection pool size configured appropriately
- [x] Backup strategy implemented (automated daily minimum)
- [x] Backup restore tested in staging

### Monitoring & Observability
- [x] Health check endpoint (`/healthz`) implemented and tested
- [x] Metrics endpoint (`/metrics`) exported in Prometheus format
- [x] Structured logging (JSON) configured
- [x] Request IDs injected for traceability
- [x] Alerting rules defined and configured
- [x] Dashboard for key metrics created (Grafana/datadog/etc)

### Documentation
- [x] README.md up to date with setup instructions
- [x] User guide created (USER_GUIDE.md)
- [x] Operations guide created (BACKUPS_MONITORING.md)
- [x] API endpoints documented (README.md)
- [x] Environment variable reference complete
- [x] Deployment runbook created (this document)

---

## Deployment Steps

### 1. Prepare Infrastructure

#### Database
- [ ] Create PostgreSQL database (Railway/Render/Supabase/etc)
- [ ] Whitelist API server IPs if required
- [ ] Enable automatic backups
- [ ] Set up connection pooling if needed (PgBouncer)
- [ ] Note connection string (will be DATABASE_URL)

#### Backend API
- [ ] Build Docker image: `docker build -f apps/api/Dockerfile -t smartbookmark-api .`
- [ ] Test image locally: `docker run -p 3000:3000 --env-file .env smartbookmark-api`
- [ ] Push to container registry (Render/ECR/Docker Hub)
- [ ] Create service/web service in hosting platform
- [ ] Configure environment variables:
  - `DATABASE_URL` (from database creation)
  - `JWT_SECRET` (generate strong random string, min 32 chars)
  - `NODE_ENV=production`
  - `PORT=3000`
  - `ALLOWED_ORIGINS` (comma-separated frontend URLs, **no** `*`)
  - Optional: `CLAUDE_API_KEY`, `ENRICHMENT_CONCURRENCY`, `REDIS_URL`

#### Frontend (Next.js)
- [ ] Build Docker image: `docker build -f apps/web/Dockerfile -t smartbookmark-frontend .`
- [ ] Test locally: `docker run -p 3001:3001 smartbookmark-frontend`
- [ ] Push to container registry
- [ ] Create frontend service
- [ ] Configure `NEXT_PUBLIC_API_URL` to point to backend URL (e.g., `https://api.yourdomain.com`)
- [ ] Set `NODE_ENV=production`, `PORT=3001`

#### Domain & SSL
- [ ] Configure DNS A/AAAA records for both API and frontend
- [ ] Ensure SSL/TLS certificates are provisioned (auto by most platforms)
- [ ] Update `ALLOWED_ORIGINS` to use HTTPS domains (not localhost)

---

### 2. Deploy

#### Backend First
1. Deploy API service
2. Wait for build to complete (~5-10 min)
3. Health check should return 200
4. Connect to API service shell (Render: "Shell" tab; other: SSH)
5. Run: `npx prisma migrate deploy`
6. Verify: `npx prisma studio` (optional, check data)
7. Test: `curl https://api.yourdomain.com/healthz`

#### Frontend Second
1. Deploy frontend service
2. Wait for build to complete (~5-10 min)
3. Health check should pass
4. Test: Open `https://yourdomain.com` in browser

---

### 3. Post-Deployment Validation

#### Smoke Tests
- [ ] Homepage loads (redirects to /login if no auth)
- [ ] Registration works (creates user, sets cookies)
- [ ] Login works (sets accessToken cookie)
- [ ] Can create bookmark with URL only
- [ ] Bookmark appears in list immediately
- [ ] Can add title, description, tags
- [ ] Can edit existing bookmark
- [ ] Can delete bookmark (with confirmation)
- [ ] Tag filter dropdown populates after creating tags
- [ ] Search filters bookmarks by keyword
- [ ] AI summary appears after 10-30 seconds (if Claude API key set)
- [ ] Logout clears cookies and redirects to login

#### Security Tests
- [ ] CSRF token is set in cookie after login
- [ ] State-changing requests without `X-CSRF-Token` header fail with 403
- [ ] CORS blocks requests from unauthorized origins
- [ ] Accessing another user's bookmark returns 404

#### Performance Tests
- [ ] Page load < 2s on 3G (use Chrome DevTools throttling)
- [ ] API response times: P95 < 500ms for simple queries
- [ ] Can handle at least 10 concurrent users (basic load test)

#### Monitoring
- [ ] Metrics endpoint accessible: `curl https://api.yourdomain.com/metrics`
- [ ] Grafana/Loki dashboard showing requests, errors, latency
- [ ] Logs appearing in log aggregation system
- [ ] Alerts configured and test alert sent successfully

---

### 4. Rollback Plan

If something goes wrong:

1. **API issues**:
   - Roll back to previous Docker image tag
   - Or disable new deployment and re-enable old service
   - Database can be rolled back with `prisma migrate resolve --rolled-back <migration>`

2. **Frontend issues**:
   - Switch traffic back to previous frontend deployment
   - Clear CDN cache if using

3. **Database migration failure**:
   - If migration failed mid-way, review logs, fix issue, re-run `prisma migrate deploy`
   - If data corruption, restore from backup

---

### 5. Post-Launch Monitoring (First 24 Hours)

- [ ] Check error logs every hour for first 6 hours
- [ ] Monitor error rate (should be < 1%)
- [ ] Watch enrichment job success rate (should be > 95%)
- [ ] Verify Claude API quota not exhausted (if using)
- [ ] Check database connection pool usage
- [ ] Monitor disk space on database and API server
- [ ] Review slow queries (if any > 1s)
- [ ] Confirm backups running (check backup file timestamps)

---

### 6. Handoff

- [ ] Team notified of deployment completion
- [ ] On-call rotation updated with new service contacts
- [ ] Runbook distributed to operations team
- [ ] Monitoring dashboard shared
- [ ] Emergency contacts documented (DB admin, cloud provider support)
- [ ] Next maintenance window scheduled (for dependency updates, etc.)

---

## Production Configuration Reference

### Environment Variables

**Required:**
```bash
DATABASE_URL="postgresql://..."
JWT_SECRET="your-32+char-secret-here"
```

**Recommended:**
```bash
NODE_ENV=production
PORT=3000
ALLOWED_ORIGINS="https://yourdomain.com,https://www.yourdomain.com"
ENRICHMENT_CONCURRENCY=10  # Tune based on DB pool + Claude rate limits
```

**Optional:**
```bash
CLAUDE_API_KEY="sk-ant-..."  # Enable AI summaries
REDIS_URL="redis://..."       # For multi-instance rate limiting
```

---

## Sign-off

Deployed by: _________________
Date: _________________
Version: _________________
Rollback tested: [ ] Yes [ ] No

---

## Quick Command Reference

```bash
# Health check
curl https://api.yourdomain.com/healthz

# Check metrics
curl https://api.yourdomain.com/metrics

# Test registration
curl -X POST https://api.yourdomain.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Run DB migrations (via API shell)
npx prisma migrate deploy

# View logs (Render example)
tail -f logs/application-$(date +%Y-%m-%d).log
```

---

**Need help?** See [BACKUPS_MONITORING.md](./BACKUPS_MONITORING.md) for incident response runbook.
