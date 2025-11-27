// backend/server.js
const express = require('express');
const cors = require('cors');
const pool = require('./src/db');  // MySQL connection

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// --- Health check ---
app.get('/api/health', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT 1 AS ok');
    res.json({ status: 'ok', db: true });
  } catch (err) {
    console.error('Health check error:', err);
    res.status(500).json({ status: 'error', db: false });
  }
});

// --- USERS ---

// Create a user
app.post('/api/users', async (req, res) => {
  try {
    const { userName, password, name, email } = req.body || {};

    if (!userName || !password || !name || !email) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const [result] = await pool.execute(
      `INSERT INTO users (userName, password, name, email)
       VALUES (?, ?, ?, ?)`,
      [userName, password, name, email]
    );

    res.status(201).json({
      userID: result.insertId,
      userName,
      name,
      email
    });
  } catch (err) {
    console.error('POST /api/users error:', err);
    res.status(500).json({ error: 'Error creating user' });
  }
});

// (Optional) simple login — NOT secure, just for class demos
app.post('/api/login', async (req, res) => {
  try {
    const { userName, password } = req.body || {};
    if (!userName || !password) {
      return res.status(400).json({ error: 'Missing username or password' });
    }

    const [rows] = await pool.execute(
      `SELECT userID, userName, name, email
       FROM users
       WHERE userName = ? AND password = ?`,
      [userName, password]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    res.json({ user: rows[0] });
  } catch (err) {
    console.error('POST /api/login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// --- EVENTS ---

// Create an event
app.post('/api/events', async (req, res) => {
  try {
    const {
      userID,
      title,
      eventDate,        // 'YYYY-MM-DD'
      eventTime,        // 'HH:MM:SS' or 'HH:MM'
      eventDescription,
      reminderTime      // optional 'HH:MM:SS' or 'HH:MM'
    } = req.body || {};

    if (!userID || !title || !eventDate || !eventTime) {
      return res.status(400).json({ error: 'userID, title, eventDate, eventTime are required' });
    }

    // Normalize times to HH:MM:SS
    const normalizeTime = (t) => {
      if (!t) return null;
      return t.length === 5 ? t + ':00' : t; // 'HH:MM' -> 'HH:MM:00'
    };

    const [result] = await pool.execute(
      `INSERT INTO events
       (userID, title, eventDate, eventTime, eventDescription, reminderTime)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        userID,
        title,
        eventDate,
        normalizeTime(eventTime),
        eventDescription || null,
        normalizeTime(reminderTime)
      ]
    );

    res.status(201).json({
      eventID: result.insertId,
      userID,
      title,
      eventDate,
      eventTime: normalizeTime(eventTime),
      eventDescription: eventDescription || null,
      reminderTime: normalizeTime(reminderTime)
    });
  } catch (err) {
    console.error('POST /api/events error:', err);
    res.status(500).json({ error: 'Error creating event' });
  }
});

// Get events for a user on a specific date
// Example: GET /api/events?userID=1&date=2025-12-01
app.get('/api/events', async (req, res) => {
  try {
    const { userID, date } = req.query;

    if (!userID || !date) {
      return res.status(400).json({ error: 'userID and date query params are required' });
    }

    const [rows] = await pool.execute(
      `SELECT eventID, userID, title, eventDate, eventTime,
              eventDescription, reminderTime, created
       FROM events
       WHERE userID = ? AND eventDate = ?
       ORDER BY eventTime`,
      [userID, date]
    );

    res.json(rows);
  } catch (err) {
    console.error('GET /api/events error:', err);
    res.status(500).json({ error: 'Error fetching events' });
  }
});

// Delete an event
app.delete('/api/events/:eventID', async (req, res) => {
  try {
    const { eventID } = req.params;

    const [result] = await pool.execute(
      `DELETE FROM events WHERE eventID = ?`,
      [eventID]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    res.json({ deleted: eventID });
  } catch (err) {
    console.error('DELETE /api/events/:eventID error:', err);
    res.status(500).json({ error: 'Error deleting event' });
  }
});

// Update an event
app.put('/api/events/:eventID', async (req, res) => {
  try {
    const { eventID } = req.params;
    const {
      title,
      eventDate,
      eventTime,
      eventDescription,
      reminderTime
    } = req.body || {};

    // Fetch existing event
    const [rows] = await pool.execute(
      `SELECT * FROM events WHERE eventID = ?`,
      [eventID]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const existing = rows[0];

    const normalizeTime = (t) => {
      if (!t) return null;
      return t.length === 5 ? t + ':00' : t;
    };

    const newTitle = title ?? existing.title;
    const newDate = eventDate ?? existing.eventDate;
    const newTime = eventTime ? normalizeTime(eventTime) : existing.eventTime;
    const newDesc = eventDescription ?? existing.eventDescription;
    const newReminder = reminderTime
      ? normalizeTime(reminderTime)
      : existing.reminderTime;

    await pool.execute(
      `UPDATE events
       SET title = ?, eventDate = ?, eventTime = ?, eventDescription = ?, reminderTime = ?
       WHERE eventID = ?`,
      [newTitle, newDate, newTime, newDesc, newReminder, eventID]
    );

    res.json({
      eventID,
      userID: existing.userID,
      title: newTitle,
      eventDate: newDate,
      eventTime: newTime,
      eventDescription: newDesc,
      reminderTime: newReminder
    });
  } catch (err) {
    console.error('PUT /api/events/:eventID error:', err);
    res.status(500).json({ error: 'Error updating event' });
  }
});

// --- Start server ---
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

