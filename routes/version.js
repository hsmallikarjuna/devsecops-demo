'use strict';

const express = require('express');
const router  = express.Router();

/**
 * GET /version
 * Returns the current application version.
 * APP_VERSION is read at request time so it can be overridden at runtime
 * (and tested by mutating process.env in unit tests).
 *
 * ─── Intentional Code Smell #3 ──────────────────────────────────────────────
 * Loose equality operator (==) used instead of strict equality (===).
 * SonarQube rule: javascript:S1439 — "==" should be "==="
 */
router.get('/', (req, res) => {
  const version = process.env.APP_VERSION || '1.0.0';
  const parts   = version.split('.');

  // Code smell: loose equality comparison (should use ===)
  if (parts.length == 3) {
    res.status(200).json({ version });
  } else {
    res.status(200).json({ version: '1.0.0' });
  }
});

module.exports = router;
