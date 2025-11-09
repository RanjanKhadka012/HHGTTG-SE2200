const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const { parseDateTime, computeNextOccurrences } = require('./src/calendar');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// In-memory store (prototype only)
const EVENTS = new Map(); // id -> event
const SCHEDULED = new Map(); // id -> timeoutId

app.get('/api/health', (req, res) => res.json({status: 'ok'}));

app.get('/api/events', (req, res) => {
  const all = Array.from(EVENTS.values()).sort((a,b)=> new Date(a.dateTime) - new Date(b.dateTime));
  res.json(all);
});

app.post('/api/events', (req, res) => {
  const { title, date, time, description, duration, repeatRule, reminderMinutes } = req.body;
  if(!title || !date || !time){
    return res.status(400).json({error:'title, date and time are required'});
  }

  const id = uuidv4();
  const dateTime = parseDateTime(date, time);
  const event = { id, title, date, time, dateTime: dateTime.toISOString(), description: description||'', duration: duration||'', repeatRule: repeatRule||null, reminderMinutes: reminderMinutes||null };
  EVENTS.set(id, event);

  // schedule reminder if requested (prototype: in-memory setTimeout)
  if(reminderMinutes && !isNaN(Number(reminderMinutes))){
    const msBefore = Number(reminderMinutes) * 60 * 1000;
    const when = new Date(dateTime.getTime() - msBefore);
    const now = new Date();
    if(when > now){
      const wait = when.getTime() - now.getTime();
      const t = setTimeout(()=>{
        console.log(`Reminder for event ${id}: ${title} at ${date} ${time}`);
        // Here you could integrate push, email, or other notification mechanisms.
        SCHEDULED.delete(id);
      }, wait);
      SCHEDULED.set(id, t);
    } else {
      console.log('Reminder time already passed; not scheduled.');
    }
  }

  res.status(201).json(event);
});

app.delete('/api/events/:id', (req,res)=>{
  const id = req.params.id;
  if(!EVENTS.has(id)) return res.status(404).json({error:'not found'});
  EVENTS.delete(id);
  if(SCHEDULED.has(id)){
    clearTimeout(SCHEDULED.get(id));
    SCHEDULED.delete(id);
  }
  res.json({deleted:id});
});

// Update an event
app.put('/api/events/:id', (req, res) => {
  const id = req.params.id;
  if(!EVENTS.has(id)) return res.status(404).json({error:'not found'});
  const existing = EVENTS.get(id);
  const { title, date, time, description, duration, repeatRule, reminderMinutes } = req.body;
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
  if(updated.reminderMinutes && !isNaN(Number(updated.reminderMinutes))){
    const msBefore = Number(updated.reminderMinutes) * 60 * 1000;
    const when = new Date(new Date(updated.dateTime).getTime() - msBefore);
    const now = new Date();
    if(when > now){
      const wait = when.getTime() - now.getTime();
      const t = setTimeout(()=>{
        console.log(`Reminder for event ${id}: ${updated.title} at ${updated.date} ${updated.time}`);
        SCHEDULED.delete(id);
      }, wait);
      SCHEDULED.set(id, t);
    }
  }

  res.json(updated);
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

app.listen(PORT, ()=> console.log(`Server listening on http://localhost:${PORT}`));
