# Database Backups & Monitoring Guide

## Database Backup Strategy

### Why Backups Matter
Your bookmark data is valuable. Losing it would be devastating. Automated backups protect against:
- Human error (accidental deletion)
- Database corruption
- Infrastructure failures
- Security incidents

### Recommended Backup Setup (PostgreSQL)

#### 1. Automated Daily Backups (Railway)

If deploying on Railway:

1. **PostgreSQL Plugin**: Railway automatically creates daily backups for Postgres databases
2. **Retention**: 7-30 days (check your plan)
3. **Restore**: From Railway dashboard → Database → Backups → Restore

**Verify**: Ensure your database plan includes automatic backups. Free tier may have limited backup retention.

#### 2. Manual Backup Script (for self-hosted or additional safety)

Create `scripts/backup-db.sh`:

```bash
#!/bin/bash
set -e

# Configuration
BACKUP_DIR="/path/to/backups"
DATABASE_URL="${DATABASE_URL}"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/smartbookmarks_${DATE}.sql.gz"

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

# Perform backup
echo "Starting backup: ${BACKUP_FILE}"
pg_dump "$DATABASE_URL" | gzip > "$BACKUP_FILE"

# Keep only last 30 days
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +30 -delete

echo "Backup complete: ${BACKUP_FILE}"
```

Add to crontab (daily at 2 AM):
```bash
crontab -e
0 2 * * * /path/to/smartbookmarkmanager/scripts/backup-db.sh
```

#### 3. Point-in-Time Recovery (PITR) for Critical Deployments

For mission-critical deployments, enable PostgreSQL WAL (Write-Ahead Logging) archiving:
- Requires PostgreSQL 12+
- Configure `wal_level = replica`
- Set up continuous archiving to cloud storage (S3, GCS, etc.)
- Allows recovery to any point in time within retention window

**Contact your database provider** for PITR options if you need RPO < 24 hours.

---

## Monitoring & Alerting

### Application-Level Monitoring

#### 1. Health Check Endpoint

Already implemented:
- `GET /healthz` returns 200 if database is reachable
- Render uses this to determine if service is "Live"
- Script: `node -e "require('http').get('http://localhost:3000/healthz', (r) => { if (r.statusCode !== 200) throw new Error('Unhealthy') })"`

**What it checks**:
- Database connectivity (raw query `SELECT 1`)
- Application is running

**What it does NOT check**:
- Claude API availability
- Memory/CPU usage
- Error rates

#### 2. Prometheus Metrics Endpoint

Already implemented:
- `GET /metrics` returns metrics in Prometheus format
- Includes: request counts, durations, Claude API calls, enrichment stats

**Key metrics to watch**:
```
smartbookmark_api_http_requests_total{code,method,route}
smartbookmark_api_http_request_duration_seconds{route}
smartbookmark_enrichment_active_jobs
smartbookmark_enrichment_success_total
smartbookmark_enrichment_failure_total
smartbookmark_claude_api_calls_total
```

**Grafana Dashboard**: Create panels for:
- Request rate (req/min) by status code
- Error rate (5xx responses) > 5% = alert
- P95 latency > 2s = warn, > 5s = alert
- Enrichment failure rate > 10% = alert
- Active enrichment jobs > 80% of concurrency limit = warn

#### 3. Log Aggregation

Structured JSON logs are already enabled (Winston). Recommended setup:

**Loki + Grafana** (self-hosted or Grafana Cloud):
- Index logs by `service`, `level`, `userId`, `requestId`
- Create alerts:
  - Error rate > 10/min = alert
  - `Enrichment failed` errors > 5/min = alert
  - `Claude API error` > 5/min = alert (could indicate API limit or billing issue)

**Alternative**: Papertrail, Loggly, Datadog

---

### Infrastructure Monitoring

#### Render Metrics (if using Render)

Render provides:
- CPU usage
- Memory usage
- Request count & response times
- Disk I/O

**Set alerts**:
- CPU > 80% for 5 min = alert
- Memory > 80% for 5 min = alert
- 5xx error rate > 5% = alert

#### Database Monitoring

**PostgreSQL metrics to monitor**:
- Connection count (should not exceed pool size * instances)
- Cache hit ratio (should be > 95%)
- Slow queries (> 1s)
- Disk space usage

**Tools**:
- Railway: Built-in DB metrics
- Self-hosted: pg_stat_statements + Prometheus postgres_exporter

---

## Alerting Rules (Recommended)

### Critical (P0) - Page Someone Immediately

1. **Health check failing** - service down
   - Condition: `/healthz` returns non-200 for 2 consecutive checks (1 min)
   - Action: Page on-call

2. **Database connection exhaustion** - risk of total outage
   - Condition: PostgreSQL connections > 90% of max for 5 min
   - Action: Page on-call

3. **High error rate** - service degraded
   - Condition: 5xx error rate > 20% for 5 min
   - Action: Page on-call

4. **Enrichment failure spike** - AI or metadata fetching broken
   - Condition: `enrichment_failure_total` rate increase > 50% vs baseline for 10 min
   - Action: Page on-call

### Warning (P1) - Notify, not page

1. **Elevated error rate**
   - Condition: 5xx error rate > 5% for 15 min
   - Action: Slack/email notification

2. **Slow response times**
   - Condition: P95 latency > 2s for 15 min
   - Action: Slack/email

3. **Claude API errors**
   - Condition: Claude API 4xx/5xx errors > 10/min for 5 min
   - Action: Slack (may indicate quota exceeded or billing issue)

4. **Disk space low**
   - Condition: DB disk usage > 85%
   - Action: Email to sysadmin

---

## Setting Up Alerts

### With Grafana (Loki + Prometheus)

1. Create alert rule:
   ```yaml
   alert: HighErrorRate
   expr: sum(rate(smartbookmark_api_http_requests_total{code=~"5.."}[5m])) / sum(rate(smartbookmark_api_http_requests_total[5m])) > 0.05
   for: 5m
   labels:
     severity: critical
   annotations:
     summary: "High 5xx error rate detected"
     description: "5xx error rate is {{ $value | humanizePercentage }} (threshold: 5%)"
   ```

2. Configure notification policy (Slack, email, PagerDuty integrations)

### With Datadog

1. Create monitor: `avg(last_5m):sum:http.requests{status_code:5xx}.rollup(sum).divide(sum:http.requests{*}.rollup(sum)) > 0.05`
2. Set evaluation window and alert threshold
3. Add recipients

### With Render (limited)

Render does not have customizable alerting. Use external monitoring:
- UptimeRobot / Pingdom for HTTP health checks every 1 min
- Logtail / Papertrail for log-based alerts
- Grafana Cloud for full observability stack

---

## Manual Monitoring Checklist

Daily/Weekly checks:

- [ ] Check error logs for increasing `Enrichment failed` messages
- [ ] Verify backups exist and have reasonable size (no zero-byte files)
- [ ] Monitor disk space usage on database
- [ ] Review active enrichment jobs metric (should not consistently hit concurrency limit)
- [ ] Verify Claude API calls are succeeding (check for quota warnings from Anthropic)

Monthly:

- [ ] Test backup restoration in staging environment
- [ ] Review slow query logs
- [ ] Update dependencies (security patches)
- [ ] Review and rotate secrets if needed (JWT_SECRET rotation requires downtime)

---

## Security Monitoring

**Audit logs** (to be implemented):
- Record: user login/logout, bookmark creation/deletion, tag changes
- Alert on: > 100 deletions/hour, > 50 failed logins from single IP

**Anomaly detection**:
- Sudden spike in API calls from single user (could indicate compromised token)
- Enrichment job failures > 50% (could indicate OpenAI/Anthropic API key issue)

---

## Support Runbook

When an alert fires:

1. **Health check failing**
   ```bash
   # Check if API is running
   curl http://localhost:3000/healthz
   # Check logs
   tail -f logs/error-*.log
   # Restart if needed
   npm restart (or pm2 restart)
   ```

2. **Database connection errors**
   ```
   Logger: "Enrichemnt failed" with errors about "too many connections"
   Action: Check database pool size vs max_connections. Increase pool or reduce ENRICHMENT_CONCURRENCY.
   ```

3. **Claude API errors**
   ```
   logger.error('Claude API error', { status: 429 })
   Action: API quota exceeded. Check Anthropic billing. Consider rate-limiting enrichment or adding queue.
   ```

4. **High error rate**
   ```bash
   # Check recent error patterns
   grep -o '"error":"[^"]*"' logs/error-$(date +%Y-%m-%d).log | sort | uniq -c | sort -rn | head -10
   ```

---

## Contact Information

Fill this in for your team:

- **On-call rotation**: ___
- **Escalation policy**: ___
- **Database admin contact**: ___
- **Cloud provider support**: ___
- **Anthropic support**: https://support.anthropic.com/

---

## Review Schedule

- **Monthly**: Review alert effectiveness, thresholds
- **Quarterly**: Test backup restore procedure
- **Annually**: Review disaster recovery plan
