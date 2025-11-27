// backend/server.js
const express = require('express');
const cors = require('cors');
const pool = require('./src/db'); // mysql2 pool

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

//
// -------- AUTH ROUTES (LOGIN + SIGNUP) --------
//

// SIGNUP (used by signup page if it calls /api/auth/signup)
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { username, userName, password, name, email } = req.body || {};
    const finalUsername = username || userName;

    if (!finalUsername || !password || !email) {
      return res.status(400).json({
        message: 'Missing required fields (username, email, password)'
      });
    }

    // Check if username already exists
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
    res.status(500).json({ message: 'Error creating user' });
  }
});

// LOGIN (called by login.js => /api/auth/login)
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, userName, password } = req.body || {};
    const finalUsername = username || userName;

    if (!finalUsername || !password) {
      return res.status(400).json({ message: 'Missing username or password' });
    }

    const [rows] = await pool.execute(
      `SELECT userID, userName AS username, name, email
       FROM users
       WHERE userName = ? AND password = ?`,
      [finalUsername, password]
    );

    if (rows.length === 0) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    const user = rows[0];

    // Fake token for prototype
    const token = 'fake-token-' + user.userID;

    return res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.userID,
        username: user.username,
        name: user.name,
        email: user.email
      }
    });
  } catch (err) {
    console.error('POST /api/auth/login error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

//
// -------- OPTIONAL: simple /api/users create --------
//
app.post('/api/users', async (req, res) => {
  try {
    const { userName, password, name, email } = req.body || {};

    if (!userName || !password || !name || !email) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const [result] = await pool.execute(
      `INSERT INTO users (userName, password, name, email)
       VALUES (?, ?, ?, ?)` ,
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

//
// -------- EVENTS HELPERS --------
//

function normalizeTime(t) {
  if (!t) return null;
  // 'HH:MM' -> 'HH:MM:00'
  return t.length === 5 ? t + ':00' : t;
}

function mapRowToEvent(row) {
  let dateStr;
  if (row.eventDate instanceof Date) {
    dateStr = row.eventDate.toISOString().slice(0, 10);
  } else {
    dateStr = String(row.eventDate);
  }

  let timeStr = String(row.eventTime || '');
  const shortTime = timeStr.length >= 5 ? timeStr.slice(0, 5) : timeStr;

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

//
// -------- EVENTS ROUTES --------
//

// GET all events
app.get('/api/events', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT eventID, title, eventDate, eventTime, eventDescription
       FROM events
       ORDER BY eventDate, eventTime`
    );

    const events = rows.map(mapRowToEvent);
    res.json(events);
  } catch (err) {
    console.error('GET /api/events error:', err);
    res.status(500).json({ error: 'Error fetching events' });
  }
});

// CREATE event
app.post('/api/events', async (req, res) => {
  try {
    const { title, date, time, description } = req.body || {};

    if (!title || !date || !time) {
      return res
        .status(400)
        .json({ error: 'title, date, and time are required' });
    }

    const eventDate = date;                // 'YYYY-MM-DD'
    const eventTime = normalizeTime(time); // 'HH:MM:SS'
    const userID = 1; // temp / demo

    const [result] = await pool.execute(
      `INSERT INTO events (userID, title, eventDate, eventTime, eventDescription)
       VALUES (?, ?, ?, ?, ?)`,
      [userID, title, eventDate, eventTime, description || null]
    );

    const eventID = result.insertId;

    const eventObj = mapRowToEvent({
      eventID,
      title,
      eventDate,
      eventTime,
      eventDescription: description || null
    });

    res.status(201).json(eventObj);
  } catch (err) {
    console.error('POST /api/events error:', err);
    res.status(500).json({ error: 'Error creating event' });
  }
});

// UPDATE event
app.put('/api/events/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, date, time, description } = req.body || {};

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

// DELETE event
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

// --- Start server ---
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});