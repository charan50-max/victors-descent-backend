// server.js
require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'dungeon',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'dungeon_game',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Register new user (or return existing)
app.post('/register', async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: 'username required' });

    const conn = await pool.getConnection();
    const [rows] = await conn.query('SELECT id FROM users WHERE username = ?', [username]);
    if (rows.length) {
      conn.release();
      return res.json({ id: rows[0].id, username });
    }
    const [result] = await conn.query('INSERT INTO users (username) VALUES (?)', [username]);
    conn.release();
    res.json({ id: result.insertId, username });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Log game events
app.post('/log', async (req, res) => {
  try {
    const { user_id, event_type, message } = req.body;
    await pool.query(
      'INSERT INTO logs (user_id, event_type, message) VALUES (?,?,?)',
      [user_id || null, event_type || 'info', message || '']
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Update leaderboard
app.post('/update-leaderboard', async (req, res) => {
  try {
    const { user_id, victory = 0, defeat = 0, explored = 0 } = req.body;
    if (!user_id) return res.status(400).json({ error: 'user_id required' });

    await pool.query(
      `INSERT INTO leaderboard (user_id, victories, defeats, explored_rooms)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         victories = victories + VALUES(victories),
         defeats = defeats + VALUES(defeats),
         explored_rooms = explored_rooms + VALUES(explored_rooms)`,
      [user_id, victory, defeat, explored]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Get leaderboard
app.get('/leaderboard', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT u.username, l.victories, l.defeats, l.explored_rooms
       FROM leaderboard l
       JOIN users u ON u.id = l.user_id
       ORDER BY l.victories DESC, l.explored_rooms DESC
       LIMIT 20`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on http://localhost:${port}`));
