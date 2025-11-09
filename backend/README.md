# SE2200 Backend (prototype)

This folder contains a minimal Node.js + Express scaffold for the calendar/to-do prototype.

Quick start

1. Open a terminal in `backend/`.
2. Install dependencies:

```bash
npm install
```

3. Start the server:

```bash
npm start
```

The server listens on port 3000 by default and exposes a small API:

- GET /api/health — health check
- GET /api/events — list events (in-memory)
- POST /api/events — create an event (JSON body: title, date, time, description, duration, repeatRule, reminderMinutes)
- DELETE /api/events/:id — delete an event
- POST /api/next-occurrences — compute occurrences from an rrule

Notes

- This is a prototype: events and scheduled reminders are stored in memory and will be lost on server restart.
- The project uses `rrule` to compute recurrence rules (RFC 5545). Reminders are scheduled using `setTimeout`.
- For production you should add persistent storage (database) and a persistent job scheduler (e.g., Agenda with MongoDB or a message queue).

