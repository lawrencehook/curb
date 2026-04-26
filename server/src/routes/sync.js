const express = require('express');
const storage = require('../storage');
const { requireAuth } = require('../services/jwt');

const router = express.Router();

// All sync routes require a valid session token.
router.use(requireAuth);

function parsePolicies(policiesJson) {
  try {
    return JSON.parse(policiesJson);
  } catch {
    return [];
  }
}

// GET /sync → { policies, version, updated_at }
router.get('/', (req, res) => {
  const doc = storage.getDocument(req.userId);
  if (!doc) {
    return res.json({ policies: [], version: 0, updated_at: null });
  }
  res.json({
    policies: parsePolicies(doc.policies_json),
    version: doc.version,
    updated_at: doc.updated_at,
  });
});

// PUT /sync  { policies, version }
//   On version match → 200 { ok: true, version, updated_at }
//   On mismatch     → 409 { ok: false, current: { policies, version, updated_at } }
router.put('/', (req, res) => {
  const { policies, version } = req.body || {};

  if (!Array.isArray(policies)) {
    return res.status(400).json({ error: 'policies must be an array' });
  }
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 0) {
    return res.status(400).json({ error: 'version must be a non-negative integer' });
  }

  const policiesJson = JSON.stringify(policies);
  const result = storage.putDocument(req.userId, policiesJson, version);

  if (!result.ok) {
    if (!result.current) {
      // Client expected a non-zero version but we've never seen this user.
      return res.status(409).json({
        ok: false,
        current: { policies: [], version: 0, updated_at: null },
      });
    }
    return res.status(409).json({
      ok: false,
      current: {
        policies: parsePolicies(result.current.policies_json),
        version: result.current.version,
        updated_at: result.current.updated_at,
      },
    });
  }

  res.json({ ok: true, version: result.version, updated_at: result.updated_at });
});

module.exports = router;
