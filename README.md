# HHGTTG-SE2200 — Remember To Do (Prototype)

Lightweight calendar / todo prototype used for the SE2200 course. Simple frontend UI with grouped event "pills" and a minimal Node.js backend for persistence and reminder scheduling (in-memory).

## Contents
- `frontend/` — static UI (HTML, CSS, JS)
- `backend/` — Node.js + Express prototype API

## Prerequisites
- Node.js (v14+ recommended)
- Git (optional)

## Run the backend
1. Open a terminal and change into the `backend` folder:

```powershell
Set-Location 'C:\Users\<you>\Desktop\SE2200\backend'
```

2. Install dependencies and start the server:

```powershell
npm install
npm start
```

This starts the prototype API at http://localhost:3000 by default. Endpoints include:

- `GET /api/events` — list events
- `POST /api/events` — create event (expects JSON: title, date, time, ...)
- `PUT /api/events/:id` — update
- `DELETE /api/events/:id` — delete

Notes: persistence is in-memory for the prototype. Restarting the server clears stored events. Reminder scheduling uses `setTimeout` (in-memory) — not suitable for production.

## Serve the frontend
The `frontend/` folder is plain static files. You can open `frontend/index.html` directly in a browser, but using a local static server is recommended to avoid file:// and CORS behaviors.

Quick ways to serve the frontend (from project root):

1) Using npx `http-server` (no install required):

```powershell
npx http-server ./frontend -p 8080
# then open http://localhost:8080 in your browser
```

2) Or use the Node `serve` package:

```powershell
npx serve frontend -l 8080
```

3) Or open the file directly (less recommended):

 - Open `frontend/index.html` in your browser.

When the frontend is loaded it will try to fetch events from `http://localhost:3000/api/events`. If the backend is unavailable it will fall back to reading embedded sample events and to `localStorage` for create/update operations.

## Create events
- Use `Create Event` in the UI (opens `frontend/create.html`) and fill Title, Date and Time. The frontend tries to POST to the backend and will fall back to `localStorage` when offline.

## Development notes
- The backend uses `rrule` for recurrence utilities and `uuid` for event ids.
- This prototype stores data in memory. For production consider using a database (Mongo, Postgres) and a persistent job scheduler (Agenda, BullMQ, cron) for reminders.

## Repo
- Remote: https://github.com/RanjanKhadka012/HHGTTG-SE2200

If you want, I can add a single npm script at the repo root to run both frontend & backend simultaneously (using `concurrently`) and add a small `Makefile`/PowerShell script for easier local starts.

---
Created for the SE2200 project — simple prototype, not production-ready.
