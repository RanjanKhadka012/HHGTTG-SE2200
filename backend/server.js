// backend/server.js
const express = require('express');
const cors = require('cors');
const pool = require('./src/db'); // mysql2 promise pool

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

/* ===================== HEALTH CHECK ===================== */

app.get('/api/health', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT 1 AS ok');
    res.json({ status: 'ok', db: true });
  } catch (err) {
    console.error('Health check error:', err);
    res.status(500).json({ status: 'error', db: false });
  }
});

/* ===================== AUTH: SIGNUP ===================== */
// Uses your `users` table:
// userID, userName, password, name, email, joinedDate

app.post('/api/auth/signup', async (req, res) => {
  try {
    const { username, userName, password, name, email } = req.body || {};
    const finalUsername = username || userName;

    if (!finalUsername || !password || !email) {
      return res.status(400).json({
        message: 'Missing required fields (username, email, password)'
      });
    }

    // check if username exists
    const [existing] = await pool.execute(
      'SELECT userID FROM users WHERE userName = ?',
      [finalUsername]
    );
    if (existing.length > 0) {
      return res.status(409).json({ message: 'Username already taken' });
    }

    const [result] = await pool.execute(
      `INSERT INTO users (userName, password, name, email)
       VALUES (?, ?, ?, ?)`,
      [finalUsername, password, name || '', email]
    );

    return res.status(201).json({
      id: result.insertId,
      username: finalUsername,
      name: name || '',
      email
    });
    } catch (err) {
    console.error('POST /api/auth/signup error:', err);
    // send the real message so signup.js can show it
    res.status(500).json({
      message: err.message || 'Error creating user'
    });
  }
});

/* ===================== AUTH: LOGIN ===================== */
// login.js calls POST http://localhost:3000/api/auth/login
// and expects: { token, user: { id, username, name, email } }

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, userName, password } = req.body || {};
    const finalUsername = username || userName;

    if (!finalUsername || !password) {
      return res.status(400).json({ message: 'Missing username or password' });
    }

    // Look up the user from USERS table
    const [rows] = await pool.execute(
      'SELECT userID, userName, name, email, password FROM users WHERE userName = ?',
      [finalUsername]
    );

    if (rows.length === 0 || rows[0].password !== password) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    const user = rows[0];

    // Fake token is fine for this project
    const token = 'fake-token-' + user.userID;

    return res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.userID,
        username: user.userName,
        name: user.name,
        email: user.email
      }
    });
  } catch (err) {
    console.error('POST /api/auth/login error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/* ===================== OPTIONAL: /api/users CREATE ===================== */

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

/* ===================== EVENTS HELPERS ===================== */

function normalizeTime(t) {
  if (!t) return null;
  // 'HH:MM' -> 'HH:MM:00'
  return t.length === 5 ? t + ':00' : t;
}

function mapRowToEvent(row) {
  // eventDate: DATE; eventTime: TIME
  let dateStr;
  if (row.eventDate instanceof Date) {
    dateStr = row.eventDate.toISOString().slice(0, 10); // YYYY-MM-DD
  } else {
    dateStr = String(row.eventDate);
  }

  let timeStr = String(row.eventTime || '');
  const shortTime = timeStr.length >= 5 ? timeStr.slice(0, 5) : timeStr; // HH:MM

  const dateTimeIso = new Date(`${dateStr}T${shortTime}:00`).toISOString();

  return {
    id: row.eventID,
    title: row.title,
    description: row.eventDescription || '',
    date: dateStr,
    time: shortTime,
    duration: null,
    reminderMinutes: null,
    dateTime: dateTimeIso
  };
}

/* ===================== EVENTS ROUTES ===================== */
/*
  Your DB schema (from earlier):

  CREATE TABLE events (
    eventID INT AUTO_INCREMENT PRIMARY KEY,
    userID INT NOT NULL,
    title VARCHAR(150) NOT NULL,
    eventDate DATE NOT NULL,
    eventTime TIME NOT NULL,
    eventDescription VARCHAR(300),
    Reminder TIME,
    created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userID) REFERENCES users(userID) ON DELETE CASCADE
  );
*/

// GET /api/events?userID=1  -> events only for that user
app.get('/api/events', async (req, res) => {
  try {
    const userID = req.query.userID;

    if (!userID) {
      return res
        .status(400)
        .json({ error: 'userID query parameter is required' });
    }

    const [rows] = await pool.execute(
      `SELECT eventID, title, eventDate, eventTime, eventDescription
       FROM events
       WHERE userID = ?
       ORDER BY eventDate, eventTime`,
      [userID]
    );

    const events = rows.map(mapRowToEvent);
    res.json(events);
  } catch (err) {
    console.error('GET /api/events error:', err);
    res.status(500).json({ error: 'Error fetching events' });
  }
});

// CREATE event: body must include userID, title, date, time, description (optional)
app.post('/api/events', async (req, res) => {
  try {
    const { title, date, time, description, userID } = req.body || {};

    if (!title || !date || !time || !userID) {
      return res.status(400).json({
        error: 'title, date, time, and userID are required'
      });
    }

    const eventDate = date; // YYYY-MM-DD from <input type="date">
    const eventTime = normalizeTime(time); // HH:MM:SS

    const [result] = await pool.execute(
      `INSERT INTO events (userID, title, eventDate, eventTime, eventDescription)
       VALUES (?, ?, ?, ?, ?)`,
      [userID, title, eventDate, eventTime, description || '']
    );

    const eventID = result.insertId;

    const eventObj = mapRowToEvent({
      eventID,
      title,
      eventDate,
      eventTime,
      eventDescription: description || ''
    });

    res.status(201).json(eventObj);
  } catch (err) {
    console.error('POST /api/events error:', err);
    res.status(500).json({ error: 'Error creating event' });
  }
});

// UPDATE event by id
app.put('/api/events/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, date, time, description } = req.body || {};

    // fetch existing
    const [rows] = await pool.execute(
      `SELECT eventID, userID, title, eventDate, eventTime, eventDescription
       FROM events
       WHERE eventID = ?`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const existing = rows[0];

    const newTitle = title ?? existing.title;
    const newDate = date ?? existing.eventDate;
    const newTime = time ? normalizeTime(time) : existing.eventTime;
    const newDescription =
      description !== undefined ? description : existing.eventDescription;

    await pool.execute(
      `UPDATE events
       SET title = ?, eventDate = ?, eventTime = ?, eventDescription = ?
       WHERE eventID = ?`,
      [newTitle, newDate, newTime, newDescription, id]
    );

    const updated = mapRowToEvent({
      eventID: id,
      title: newTitle,
      eventDate: newDate,
      eventTime: newTime,
      eventDescription: newDescription
    });

    res.json(updated);
  } catch (err) {
    console.error('PUT /api/events/:id error:', err);
    res.status(500).json({ error: 'Error updating event' });
  }
});

// DELETE event by id
app.delete('/api/events/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await pool.execute(
      `DELETE FROM events WHERE eventID = ?`,
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    res.json({ deleted: id });
  } catch (err) {
    console.error('DELETE /api/events/:id error:', err);
    res.status(500).json({ error: 'Error deleting event' });
  }
});

/* ===================== START SERVER ===================== */

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});