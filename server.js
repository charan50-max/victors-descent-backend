// POST /update-leaderboard { username, score } - Always use latest score
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
    
    // Always update to the latest score (not maximum)
    const [existing] = await conn.query(
      'SELECT id FROM leaderboard WHERE username = ? LIMIT 1',
      [username]
    );

    if (existing.length) {
      // Update to the new score (latest game result)
      await conn.query(
        'UPDATE leaderboard SET score = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [numericScore, existing[0].id]
      );
      console.log(`Updated score for ${username}: ${numericScore}`);
    } else {
      // Insert new record
      await conn.query(
        'INSERT INTO leaderboard (username, score) VALUES (?, ?)',
        [username, numericScore]
      );
      console.log(`New score for ${username}: ${numericScore}`);
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error('Update leaderboard error:', err);
    return res.status(500).json({ error: 'server error' });
  } finally {
    if (conn) conn.release();
  }
});

