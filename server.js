'use strict';

const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(express.json());
app.use(
cors({
origin: ['https://papaya-muffin-55a8b5.netlify.app'],
credentials: false
})
);

// Health check
app.get('/health', (req, res) => {
res.json({ ok: true });
});

// In-memory data store for demo
// Replace with a database if you need persistence.
const leaderboard = [];

// POST /register
// Body: { username: string }
app.post('/register', (req, res) => {
try {
const { username } = req.body || {};
if (!username || typeof username !== 'string') {
return res.status(400).json({ error: 'Username is required' });
}
const userId = user_${Date.now()}_${Math.floor(Math.random() * 1e6)};
return res.json({ userId, username });
} catch (err) {
console.error('Register error:', err);
return res.status(500).json({ error: 'Server error' });
}
});

// POST /update-leaderboard
// Body: { username: string, score: number }
app.post('/update-leaderboard', (req, res) => {
try {
const { username, score } = req.body || {};
if (!username || typeof username !== 'string') {
return res.status(400).json({ error: 'Username is required' });
}
const numericScore = Number(score);
if (!Number.isFinite(numericScore)) {
return res.status(400).json({ error: 'Valid score is required' });
}

const existing = leaderboard.find((e) => e.username === username);
if (existing) {
  existing.score = Math.max(existing.score, numericScore);
} else {
  leaderboard.push({ username, score: numericScore });
}

leaderboard.sort((a, b) => b.score - a.score);
if (leaderboard.length > 100) leaderboard.length = 100;

return res.json({ ok: true });
} catch (err) {
console.error('Update leaderboard error:', err);
return res.status(500).json({ error: 'Server error' });
}
});

// GET /leaderboard
app.get('/leaderboard', (req, res) => {
try {
return res.json({ leaderboard });
} catch (err) {
console.error('Get leaderboard error:', err);
return res.status(500).json({ error: 'Server error' });
}
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(Listening on ${PORT}));
