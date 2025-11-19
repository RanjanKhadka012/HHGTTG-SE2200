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

Deployment notes (Railway)
--------------------------
This backend can run on Railway or similar PaaS providers. To deploy on Railway:

1. Set the `DATABASE_URL` environment variable (Railway will provide a Postgres URL) if you want persistent storage. If `DATABASE_URL` is not provided the server will fall back to an in-memory store (data lost on restart).

2. Set `FRONTEND_URL` (optional) to the URL where your frontend is hosted (for example: `https://hhgttg-se-2200.vercel.app`). By default the server will allow `https://hhgttg-se-2200.vercel.app`.

3. Railway will run `npm start` by default (Procfile present). The server will automatically create the `events` table on first start if `DATABASE_URL` is present.

Limitations
- Reminder scheduling uses in-memory timers (setTimeout). On a multi-instance or ephemeral environment this is not reliable — use a persistent job queue (e.g., BullMQ with Redis) or an external scheduler for production reminders.

Notes

- This is a prototype: events and scheduled reminders are stored in memory and will be lost on server restart.
- The project uses `rrule` to compute recurrence rules (RFC 5545). Reminders are scheduled using `setTimeout`.
- For production you should add persistent storage (database) and a persistent job scheduler (e.g., Agenda with MongoDB or a message queue).