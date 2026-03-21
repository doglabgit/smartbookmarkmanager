const client = require('prom-client');

// Create a Registry which registers the metrics
const register = new client.Registry();

// Define metrics
const httpRequestDurationMicroseconds = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]
});

const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status']
});

const enrichmentActive = new client.Gauge({
  name: 'enrichment_active',
  help: 'Number of currently running enrichment jobs'
});

const claudeApiCallsTotal = new client.Counter({
  name: 'claude_api_calls_total',
  help: 'Total number of Claude API calls'
});

const enrichmentSuccessTotal = new client.Counter({
  name: 'enrichment_success_total',
  help: 'Total number of successful enrichment jobs'
});

const enrichmentFailureTotal = new client.Counter({
  name: 'enrichment_failure_total',
  help: 'Total number of failed enrichment jobs'
});

// Register the metrics
register.registerMetric(httpRequestDurationMicroseconds);
register.registerMetric(httpRequestsTotal);
register.registerMetric(enrichmentActive);
register.registerMetric(claudeApiCallsTotal);
register.registerMetric(enrichmentSuccessTotal);
register.registerMetric(enrichmentFailureTotal);

// Middleware to collect request metrics automatically
function metricsMiddleware(req, res, next) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route?.path || req.path; // Use route pattern if available

    httpRequestDurationMicroseconds
      .labels(req.method, route, res.statusCode.toString())
      .observe(duration);

    httpRequestsTotal
      .labels(req.method, route, res.statusCode.toString())
      .inc();
  });

  next();
}

// Middleware to track Claude API calls
function trackClaudeCall() {
  claudeApiCallsTotal.inc();
}

// Export metrics endpoint handler
async function metricsEndpoint(_req, res) {
  try {
    const metrics = await register.metrics();
    res.set('Content-Type', register.contentType);
    res.end(metrics);
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate metrics' });
  }
}

module.exports = {
  metricsMiddleware,
  metricsEndpoint,
  trackClaudeCall,
  enrichmentActive,
  enrichmentSuccessTotal,
  enrichmentFailureTotal,
  httpRequestsTotal,
  httpRequestDurationMicroseconds,
  claudeApiCallsTotal
};
