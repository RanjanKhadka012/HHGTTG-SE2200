const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const { parseDateTime, computeNextOccurrences } = require('./src/calendar');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

/* CORS: allow frontend URL if provided, otherwise allow all (for prototype)
const FRONTEND_URL = process.env.FRONTEND_URL || process.env.CLIENT_URL || 'https://hhgttg-se-2200.vercel.app';
app.use(cors({ origin: FRONTEND_URL }));
app.use(express.json());
*/

// For development, allow all origins
app.use(cors());
app.use(express.json());

// In-memory store (fallback prototype)
const EVENTS = new Map(); // id -> event
const SCHEDULED = new Map(); // id -> timeoutId

// In-memory users store (prototype auth)
const USERS = new Map(); // username -> { id, username, password, name, email }

// Optional Postgres pool (if DATABASE_URL provided by platform like Railway)
let pool = null;
if(process.env.DATABASE_URL){
  pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
}

async function initDb(){
  if(!pool) return;
  // create table if not exists
  await pool.query(`
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      date_time TIMESTAMPTZ NOT NULL,
      description TEXT,
      duration TEXT,
      repeat_rule TEXT,
      reminder_minutes INTEGER
    );
  `);
}

// Helper: schedule reminder for an event (in-memory timeout)
function scheduleReminderFor(event){
  if(!event || !event.reminderMinutes) return;
  const reminderMinutes = Number(event.reminderMinutes);
  if(isNaN(reminderMinutes)) return;
  const when = new Date(new Date(event.dateTime).getTime() - reminderMinutes * 60 * 1000);
  const now = new Date();
  if(when <= now) return;
  const wait = when.getTime() - now.getTime();
  const t = setTimeout(()=>{
    console.log(`Reminder for event ${event.id}: ${event.title} at ${event.date} ${event.time}`);
    SCHEDULED.delete(event.id);
  }, wait);
  SCHEDULED.set(event.id, t);
}

async function loadAndScheduleFromDb(){
  if(!pool) return;
  const res = await pool.query('SELECT * FROM events ORDER BY date_time ASC');
  for(const row of res.rows){
    // schedule if needed
    scheduleReminderFor({ id: row.id, title: row.title, date: row.date, time: row.time, dateTime: row.date_time, reminderMinutes: row.reminder_minutes });
  }
}

app.get('/api/health', (req, res) => res.json({status: 'ok', db: !!pool}));

app.get('/api/events', async (req, res) => {
  try{
    if(pool){
      const result = await pool.query('SELECT id, title, date, time, date_time as "dateTime", description, duration, repeat_rule as "repeatRule", reminder_minutes as "reminderMinutes" FROM events ORDER BY date_time ASC');
      return res.json(result.rows.map(r=>({ ...r, dateTime: (r.dateTime instanceof Date) ? r.dateTime.toISOString() : r.dateTime })));
    }
    const all = Array.from(EVENTS.values()).sort((a,b)=> new Date(a.dateTime) - new Date(b.dateTime));
    res.json(all);
  }catch(err){
    console.error('GET /api/events error', err);
    res.status(500).json({error: 'server error'});
  }
});

// ---------- Auth: signup & login (prototype only) ----------

// SIGNUP
app.post('/api/auth/signup', (req, res) => {
  const { name, email, username, password } = req.body || {};

  // Basic validation
  if (!username || !password || !email) {
    return res.status(400).json({ message: 'Missing required fields (username, email, password)' });
  }

  if (USERS.has(username)) {
    return res.status(409).json({ message: 'Username already taken' });
  }

  const id = uuidv4();
  const user = { id, username, password, name: name || '', email };
  USERS.set(username, user);

  // Return minimal info (no password)
  return res.status(201).json({
    id: user.id,
    username: user.username,
    name: user.name,
    email: user.email
  });
});

// LOGIN
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ message: 'Missing username or password' });
  }

  const user = USERS.get(username);
  if (!user || user.password !== password) {
    return res.status(401).json({ message: 'Invalid username or password' });
  }

  // Fake token for prototype – in a real app use JWT + hashed passwords
  const token = 'fake-token-' + user.id;

  return res.json({
    message: 'Login successful',
    token,
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email
    }
  });
});

app.post('/api/events', async (req, res) => {
  try{
    const { title, date, time, description, duration, repeatRule, reminderMinutes } = req.body || {};
    if(!title || !date || !time) return res.status(400).json({error:'title, date and time are required'});
    const id = uuidv4();
    const dt = parseDateTime(date, time);
    const dateTimeIso = dt.toISOString();

    const event = { id, title, date, time, dateTime: dateTimeIso, description: description||'', duration: duration||'', repeatRule: repeatRule||null, reminderMinutes: reminderMinutes||null };

    if(pool){
      await pool.query(`INSERT INTO events (id, title, date, time, date_time, description, duration, repeat_rule, reminder_minutes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      `, [id, title, date, time, dateTimeIso, description||'', duration||'', repeatRule||null, reminderMinutes || null]);
      // schedule in-memory reminder for this running instance
      scheduleReminderFor(event);
      return res.status(201).json(event);
    }

    EVENTS.set(id, event);
    scheduleReminderFor(event);
    return res.status(201).json(event);
  }catch(err){
    console.error('POST /api/events error', err);
    res.status(500).json({error: 'server error'});
  }
});

app.delete('/api/events/:id', async (req,res)=>{
  try{
    const id = req.params.id;
    if(pool){
      const result = await pool.query('DELETE FROM events WHERE id=$1 RETURNING id', [id]);
      if(result.rowCount === 0) return res.status(404).json({error:'not found'});
      if(SCHEDULED.has(id)){ clearTimeout(SCHEDULED.get(id)); SCHEDULED.delete(id); }
      return res.json({deleted:id});
    }
    if(!EVENTS.has(id)) return res.status(404).json({error:'not found'});
    EVENTS.delete(id);
    if(SCHEDULED.has(id)){
      clearTimeout(SCHEDULED.get(id));
      SCHEDULED.delete(id);
    }
    res.json({deleted:id});
  }catch(err){
    console.error('DELETE /api/events/:id error', err);
    res.status(500).json({error:'server error'});
  }
});

// Update an event
app.put('/api/events/:id', async (req, res) => {
  try{
    const id = req.params.id;
    const { title, date, time, description, duration, repeatRule, reminderMinutes } = req.body || {};
    if(pool){
      // fetch existing
      const r = await pool.query('SELECT * FROM events WHERE id=$1', [id]);
      if(r.rowCount === 0) return res.status(404).json({error:'not found'});
      const existing = r.rows[0];
      const newDate = date !== undefined ? date : existing.date;
      const newTime = time !== undefined ? time : existing.time;
      const newDt = (date !== undefined || time !== undefined) ? parseDateTime(newDate, newTime).toISOString() : existing.date_time;
      const updated = {
        title: title !== undefined ? title : existing.title,
        date: newDate,
        time: newTime,
        date_time: newDt,
        description: description !== undefined ? description : existing.description,
        duration: duration !== undefined ? duration : existing.duration,
        repeat_rule: repeatRule !== undefined ? repeatRule : existing.repeat_rule,
        reminder_minutes: reminderMinutes !== undefined ? reminderMinutes : existing.reminder_minutes
      };
      await pool.query(`UPDATE events SET title=$1, date=$2, time=$3, date_time=$4, description=$5, duration=$6, repeat_rule=$7, reminder_minutes=$8 WHERE id=$9`, [updated.title, updated.date, updated.time, updated.date_time, updated.description, updated.duration, updated.repeat_rule, updated.reminder_minutes, id]);
      // reschedule
      if(SCHEDULED.has(id)){ clearTimeout(SCHEDULED.get(id)); SCHEDULED.delete(id); }
      scheduleReminderFor({ id, title: updated.title, date: updated.date, time: updated.time, dateTime: updated.date_time, reminderMinutes: updated.reminder_minutes });
      // return updated shape
      return res.json(Object.assign({ id }, { title: updated.title, date: updated.date, time: updated.time, dateTime: updated.date_time, description: updated.description, duration: updated.duration, repeatRule: updated.repeat_rule, reminderMinutes: updated.reminder_minutes }));
    }

    if(!EVENTS.has(id)) return res.status(404).json({error:'not found'});
    const existing = EVENTS.get(id);
    const dateTime = (date && time) ? parseDateTime(date, time).toISOString() : existing.dateTime;
    const updated = Object.assign({}, existing, {
      title: title !== undefined ? title : existing.title,
      date: date !== undefined ? date : existing.date,
      time: time !== undefined ? time : existing.time,
      dateTime,
      description: description !== undefined ? description : existing.description,
      duration: duration !== undefined ? duration : existing.duration,
      repeatRule: repeatRule !== undefined ? repeatRule : existing.repeatRule,
      reminderMinutes: reminderMinutes !== undefined ? reminderMinutes : existing.reminderMinutes
    });
    EVENTS.set(id, updated);

    // reschedule reminder if changed
    if(SCHEDULED.has(id)){
      clearTimeout(SCHEDULED.get(id));
      SCHEDULED.delete(id);
    }
    scheduleReminderFor(updated);
    res.json(updated);
  }catch(err){
    console.error('PUT /api/events/:id error', err);
    res.status(500).json({error:'server error'});
  }
});

// Utility endpoint to get next occurrences for a given rule (RFC rrule)
app.post('/api/next-occurrences', (req,res)=>{
  const { dtstart, rrule } = req.body; // rrule string or object
  try{
    const occ = computeNextOccurrences(dtstart ? new Date(dtstart) : new Date(), rrule, 10);
    res.json(occ);
  }catch(e){
    res.status(400).json({error: String(e)});
  }
});

// Initialize DB if present then start server
initDb()
  .then(() => loadAndScheduleFromDb())
  .catch(err => console.warn('DB init failed', err))
  .finally(() => {
    app.listen(PORT, () => {
      console.log(`Server listening on http://localhost:${PORT}`);
    });
  });

process.on('SIGINT', async () => {
  console.log('Shutting down...');
  try { if (pool) await pool.end(); } catch(e) {}
  process.exit(0);
});
