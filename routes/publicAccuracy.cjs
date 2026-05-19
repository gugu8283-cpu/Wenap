const express = require('express');
const store = require('../db/store.cjs');

const router = express.Router();

router.get('/stats', (req, res) => {
  try {
    res.json(store.getPublicAccuracy());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
