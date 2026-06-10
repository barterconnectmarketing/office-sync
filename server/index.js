require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const pool    = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

// GET /api/bookings/range?start=YYYY-MM-DD&end=YYYY-MM-DD
app.get('/api/bookings/range', async (req, res) => {
  const { start, end } = req.query;
  if (!start || !end) return res.status(400).json({ error: 'start and end required' });
  try {
    const result = await pool.query(
      'SELECT * FROM bookings WHERE date >= $1 AND date <= $2 ORDER BY date ASC, timestamp ASC',
      [start, end]
    );
    const bookings = result.rows.map(row => ({
      id:         row.id,
      itemId:     row.item_id,
      type:       row.type,
      userId:     row.user_id,
      userName:   row.user_name,
      date:       row.date,
      startTime:  row.start_time,
      endTime:    row.end_time,
      purpose:    row.purpose,
      isRelease:  row.is_release,
      releaseKey: row.release_key,
      timestamp:  row.timestamp,
    }));
    res.json(bookings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// GET /api/bookings?date=YYYY-MM-DD
app.get('/api/bookings', async (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: 'date is required' });

  try {
    const result = await pool.query(
      'SELECT * FROM bookings WHERE date = $1 ORDER BY timestamp ASC',
      [date]
    );
    const bookings = result.rows.map(row => ({
      id:         row.id,
      itemId:     row.item_id,
      type:       row.type,
      userId:     row.user_id,
      userName:   row.user_name,
      date:       row.date,
      startTime:  row.start_time,
      endTime:    row.end_time,
      purpose:    row.purpose,
      isRelease:  row.is_release,
      releaseKey: row.release_key,
      timestamp:  row.timestamp,
    }));
    res.json(bookings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// POST /api/bookings  — create or upsert (สำหรับ release record ด้วย)
app.post('/api/bookings', async (req, res) => {
  const {
    id, itemId, type, userId, userName,
    date, startTime, endTime, purpose,
    isRelease, releaseKey, timestamp,
  } = req.body;

  if (!id || !date) return res.status(400).json({ error: 'id and date are required' });

  try {
    await pool.query(
      `INSERT INTO bookings
         (id, item_id, type, user_id, user_name, date, start_time, end_time, purpose, is_release, release_key, timestamp)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT (id) DO UPDATE SET
         item_id     = EXCLUDED.item_id,
         type        = EXCLUDED.type,
         user_id     = EXCLUDED.user_id,
         user_name   = EXCLUDED.user_name,
         date        = EXCLUDED.date,
         start_time  = EXCLUDED.start_time,
         end_time    = EXCLUDED.end_time,
         purpose     = EXCLUDED.purpose,
         is_release  = EXCLUDED.is_release,
         release_key = EXCLUDED.release_key,
         timestamp   = EXCLUDED.timestamp`,
      [
        id, itemId || null, type || null, userId || null, userName || null,
        date, startTime || '00:00', endTime || '23:59', purpose || null,
        isRelease || false, releaseKey || null, timestamp || Date.now(),
      ]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// DELETE /api/bookings/:id
app.delete('/api/bookings/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM bookings WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
