const express = require('express');
const router = express.Router();
const authService = require('../services/auth.service');
const { body, validationResult } = require('express-validator');

router.post('/register',
  [
    body('username').isLength({ min: 3 }).trim(),
    body('email').isEmail(),
    body('password').isLength({ min: 6 })
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const user = await authService.register(
        req.body.username,
        req.body.email,
        req.body.password
      );
      res.status(201).json({ user });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
);

router.post('/login', async (req, res) => {
  try {
    const result = await authService.login(req.body.username, req.body.password);
    res.json(result);
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
});

module.exports = router;
