# ☁️ Study Hub — your cozy personalized study system

A single-page study space that pulls together everything you use every day:

| Feature | What it does |
| --- | --- |
| 🍅 **Study timer** | Pomodoro flow: 25 min focus → 5 min break, with a long break after 4 sessions. Breaks start automatically, with a gentle chime and progress dots. |
| ✅ **Smart to-do list** | Type a task and it **automatically suggests how long it should take** (it understands things like "read 20 pages" or "write 500 words"). Tasks can have due dates. |
| ✨ **Auto-plan my day** | One click turns your open tasks into a timed schedule starting right now, with breaks slotted in between. |
| 📅 **Calendar** | Month view that syncs with your to-do due dates — dots mark busy days, tap a day to see what's due and the total study time. |
| 🎧 **Lofi corner** | Embedded lofi playlists (Lofi Girl, synthwave, sleepy jazz) plus generated rain / café ambience you can layer on top. |
| 🗒 **Brainstorm board** | Pastel sticky notes you can drag anywhere, edit, recolor-randomly, and delete. Double-click the board to drop a note where you click. |
| 🚀 **App dock** | One-tap quick-launch for Spotify, Notion, Gmail, Google Calendar, Drive, and Sheets — the tools from your everyday setup. |

Everything (tasks, notes, pomodoro count) saves automatically to your browser via `localStorage` — no account, no server, no build step.

## Run it

Just open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8080
# → http://localhost:8080
```

## Tech

Plain HTML + CSS + vanilla JavaScript. No dependencies, no build step.
