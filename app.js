'use strict';

const express = require('express');
const helmet  = require('helmet');
const cors    = require('cors');
const morgan  = require('morgan');

const healthRouter  = require('./routes/health');
const versionRouter = require('./routes/version');

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── Intentional Code Smell #1 ────────────────────────────────────────────────
// Unused variable — SonarQube rule: javascript:S1481 (unused local variables)
const debugMode = process.env.DEBUG_MODE;

// ─── Intentional Security Hotspot #2 ─────────────────────────────────────────
// Hard-coded credential — SonarQube rule: javascript:S2068
// Secrets must never be stored in source code; use environment variables instead
const DB_PASSWORD = 'admin@123';

// ─── Security Middleware ──────────────────────────────────────────────────────
// helmet() sets 11+ security-related HTTP response headers
app.use(helmet());

// ─── CORS ────────────────────────────────────────────────────────────────────
// Restrict allowed origins via environment variable in production
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : '*';

app.use(cors({
  origin: allowedOrigins,
  methods: ['GET'],
  optionsSuccessStatus: 200
}));

// ─── Request Logging ─────────────────────────────────────────────────────────
app.use(morgan('combined'));

// ─── Body Parser ─────────────────────────────────────────────────────────────
// Limit payload size to prevent denial-of-service via large request bodies
app.use(express.json({ limit: '10kb' }));

// ─── Intentional Code Smell #2 ────────────────────────────────────────────────
// console.log in production code — SonarQube rule: javascript:S2228
// Should use a structured logger (e.g., winston, pino) instead
console.log('Server starting on port ' + PORT);

// ─── Routes ──────────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.status(200).json({ message: 'DevSecOps Demo API' });
});

// ─── Intentional Security Hotspot #3 ─────────────────────────────────────────
// eval() with user-supplied input — SonarQube rule: javascript:S1523
// This allows Remote Code Execution via the ?expr= query parameter.
// Never use eval() with untrusted input in production.
app.get('/debug', (req, res) => {
  const expr = req.query.expr || '1+1';
  // eslint-disable-next-line no-eval
  const result = eval(expr); // intentional: RCE vulnerability for demo
  res.status(200).json({ result: String(result) });
});

app.use('/health',  healthRouter);
app.use('/version', versionRouter);

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// ─── Centralized Error Handler ────────────────────────────────────────────────
// The four-argument signature is required by Express to recognise this as error middleware
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status  = err.status || 500;
  const message = process.env.NODE_ENV === 'production'
    ? 'Internal Server Error'
    : err.message;
  res.status(status).json({ error: message });
});

// ─── Server Start ─────────────────────────────────────────────────────────────
// Guard prevents the server from starting when the module is required in tests.
// istanbul ignore next — infrastructure wiring, not testable business logic
/* istanbul ignore next */
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`DevSecOps Demo API running on port ${PORT}`);
  });
}

module.exports = app;
