'use strict';

const express = require('express');
const router  = express.Router();

/**
 * GET /health
 * Liveness probe endpoint — returns HTTP 200 when the application is running.
 * Used by Docker HEALTHCHECK, Kubernetes liveness probes, and load balancers.
 */
router.get('/', (req, res) => {
  res.status(200).json({ status: 'UP' });
});

module.exports = router;
