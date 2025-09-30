'use strict';

const express = require('express');
const cors = require('cors');
require('dotenv').config();
const mysql = require('mysql2/promise');

const app = express();

// Middleware
app.use(express.json());
app.use(
  cors({
    origin: ['https://papaya-muffin-55a8b5.netlify.app'],
    credentials: false,
  })
);

// Health check
app.get('/health', (req, res) => {
  res.json({ ok: true });
});

// MySQL pool from env
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Ensure tables exist
async function ensureSchema() {
  const conn = await pool.getConnection();
  try {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(64) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await conn.query(`
      CREATE TABLE IF NOT EXISTS leaderboard (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(64) NOT NULL,
        score INT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      );
    `);
    // Create index (no IF NOT EXISTS in MySQL/MariaDB)
    try {
      await conn.query(`CREATE INDEX idx_leaderboard_username ON leaderboard (username);`);
    } catch (err) {
      // Ignore error if index already exists
      if (err.code !== 'ER_DUP_KEYNAME') {
        throw err;
      }
    }
  } finally {
    conn.release();
  }
}

// POST /register { username }
app.post('/register', async (req, res) => {
  const { username } = req.body || {};
  if (!username || typeof username !== 'string') {
    return res.status(400).json({ error: 'username required' });
  }
  let conn;
  try {
    conn = await pool.getConnection();
    // Check existing
    const [rows] = await conn.query(
      'SELECT id FROM users WHERE username = ? LIMIT 1',
      [username]
    );
    if (rows.length) {
      return res.json({ id: rows[0].id, username });
    }
    // Create new
    const [result] = await conn.query(
      'INSERT INTO users (username) VALUES (?)',
      [username]
    );
    return res.json({ id: result.insertId, username });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ error: 'server error' });
  } finally {
    if (conn) conn.release();
  }
});

// POST /update-leaderboard { username, score }
app.post('/update-leaderboard', async (req, res) => {
  const { username, score } = req.body || {};
  if (!username || typeof username !== 'string') {
    return res.status(400).json({ error: 'username required' });
  }
  const numericScore = Number(score);
  if (!Number.isFinite(numericScore)) {
    return res.status(400).json({ error: 'valid score required' });
  }
  let conn;
  try {
    conn = await pool.getConnection();
    // Upsert by keeping the max score per username
    const [existing] = await conn.query(
      'SELECT id, score FROM leaderboard WHERE username = ? LIMIT 1',
      [username]
    );
    if (existing.length) {
      const best = Math.max(existing[0].score, numericScore);
      await conn.query(
        'UPDATE leaderboard SET score = ? WHERE id = ?',
        [best, existing[0].id]
      );
    } else {
      await conn.query(
        'INSERT INTO leaderboard (username, score) VALUES (?, ?)',
        [username, numericScore]
      );
    }
    return res.json({ ok: true });
  } catch (err) {
    console.error('Update leaderboard error:', err);
    return res.status(500).json({ error: 'server error' });
  } finally {
    if (conn) conn.release();
  }
});

// GET /leaderboard
app.get('/leaderboard', async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const [rows] = await conn.query(
      'SELECT username, score FROM leaderboard ORDER BY score DESC, updated_at ASC LIMIT 100'
    );
    return res.json({ leaderboard: rows });
  } catch (err) {
    console.error('Get leaderboard error:', err);
    return res.status(500).json({ error: 'server error' });
  } finally {
    if (conn) conn.release();
  }
});

// Start server
const PORT = process.env.PORT || 3000;
ensureSchema()
  .then(() => {
    app.listen(PORT, () => console.log(`Listening on ${PORT}`));
  })
  .catch((err) => {
    console.error('Schema init failed:', err);
    app.listen(PORT, () =>
      console.log(`Listening on ${PORT} (schema init failed)`)
    );
  });

