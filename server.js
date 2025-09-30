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
        username VARCHAR(64) UNIQUE NOT NULL,
        score INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      );
    `);

    console.log('Database schema ensured');
  } catch (err) {
    console.error('Schema setup error:', err);
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
    
    // Check if user exists
    const [existing] = await conn.query(
      'SELECT id, username FROM users WHERE username = ? LIMIT 1',
      [username]
    );

    if (existing.length) {
      // User exists, return existing user
      return res.json({
        id: existing[0].id,
        username: existing[0].username
      });
    }

    // Create new user
    const [result] = await conn.query(
      'INSERT INTO users (username) VALUES (?)',
      [username]
    );

    console.log(`New user registered: ${username} (ID: ${result.insertId})`);
    
    return res.json({
      id: result.insertId,
      username: username
    });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ error: 'server error' });
  } finally {
    if (conn) conn.release();
  }
});

// GET /leaderboard => { leaderboard: [{ username, score }, ...] }
app.get('/leaderboard', async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const [rows] = await conn.query(
      'SELECT username, score FROM leaderboard ORDER BY score DESC, updated_at DESC LIMIT 10'
    );
    
    console.log(`Leaderboard fetched: ${rows.length} entries`);
    return res.json({ leaderboard: rows });
  } catch (err) {
    console.error('Leaderboard fetch error:', err);
    return res.status(500).json({ error: 'server error' });
  } finally {
    if (conn) conn.release();
  }
});

// POST /update-leaderboard { username, score } - ALWAYS UPDATE TO LATEST SCORE
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
    
    console.log(`Score update request: ${username} -> ${numericScore}`);
    
    // Check if user exists in leaderboard
    const [existing] = await conn.query(
      'SELECT id, score FROM leaderboard WHERE username = ? LIMIT 1',
      [username]
    );

    if (existing.length) {
      // User exists - ALWAYS UPDATE TO LATEST SCORE (not maximum)
      const oldScore = existing[0].score;
      await conn.query(
        'UPDATE leaderboard SET score = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [numericScore, existing[0].id]
      );
      console.log(`Updated ${username}: ${oldScore} -> ${numericScore}`);
    } else {
      // User doesn't exist - insert new record
      await conn.query(
        'INSERT INTO leaderboard (username, score) VALUES (?, ?)',
        [username, numericScore]
      );
      console.log(`New leaderboard entry: ${username} -> ${numericScore}`);
    }

    return res.json({ ok: true, score: numericScore });
  } catch (err) {
    console.error('Update leaderboard error:', err);
    return res.status(500).json({ error: 'server error' });
  } finally {
    if (conn) conn.release();
  }
});

// Start server
async function start() {
  try {
    await ensureSchema();
    const port = process.env.PORT || 3000;
    app.listen(port, '0.0.0.0', () => {
      console.log(`Server running on port ${port}`);
    });
  } catch (err) {
    console.error('Server startup error:', err);
    process.exit(1);
  }
}

start();

