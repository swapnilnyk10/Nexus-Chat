const express = require('express');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { User } = require('../db/database');

const router     = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

const AVATAR_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316',
  '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6'
];

// Register
router.post('/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: 'Username and password are required' });

  try {
    const exists = await User.findOne({ username });
    if (exists) return res.status(409).json({ error: 'Username already taken' });

    const password_hash = await bcrypt.hash(password, 10);
    const avatar_color  = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
    const user          = await User.create({ username, password_hash, avatar_color });

    const token = jwt.sign(
      { id: user._id, username: user.username, avatarColor: user.avatar_color },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({ token, username: user.username, avatarColor: user.avatar_color });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: 'Username and password are required' });

  try {
    const user = await User.findOne({ username });
    if (!user) return res.status(401).json({ error: 'Invalid username or password' });

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) return res.status(401).json({ error: 'Invalid username or password' });

    const token = jwt.sign(
      { id: user._id, username: user.username, avatarColor: user.avatar_color },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ token, username: user.username, avatarColor: user.avatar_color });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
