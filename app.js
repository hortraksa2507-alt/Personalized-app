/* ════════════════════════════════════════════════
   Study Hub · all logic, saved to localStorage
   ════════════════════════════════════════════════ */

const $ = (sel) => document.querySelector(sel);
const store = {
  get(key, fallback) {
    try { return JSON.parse(localStorage.getItem("studyhub:" + key)) ?? fallback; }
    catch { return fallback; }
  },
  set(key, val) { localStorage.setItem("studyhub:" + key, JSON.stringify(val)); },
};

function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove("show"), 2600);
}

/* ————— greeting & date chip ————— */
(function greeting() {
  const h = new Date().getHours();
  const word = h < 5 ? "late night grind?" : h < 12 ? "good morning" : h < 18 ? "good afternoon" : "good evening";
  $("#greeting").textContent = `${word}, let's get things done`;
  $("#today-chip").textContent = new Date().toLocaleDateString(undefined, {
    weekday: "long", month: "long", day: "numeric",
  });
})();

/* ════════════════════════════════════════════════
   1 · POMODORO STUDY TIMER (with automatic breaks)
   ════════════════════════════════════════════════ */
const TIMER_MODES = {
  focus: { mins: 25, label: "time to focus 🍅" },
  short: { mins: 5,  label: "short break ☕" },
  long:  { mins: 15, label: "long break 🌸" },
};
const RING_LEN = 2 * Math.PI * 116;

const timer = {
  mode: "focus",
  remaining: TIMER_MODES.focus.mins * 60,
  total: TIMER_MODES.focus.mins * 60,
  running: false,
  interval: null,
  completedFocus: store.get("pomodoros", 0) % 4,
};

const ringEl = $("#ring-fg");
ringEl.style.strokeDasharray = RING_LEN;

function timerRender() {
  const m = String(Math.floor(timer.remaining / 60)).padStart(2, "0");
  const s = String(timer.remaining % 60).padStart(2, "0");
  $("#timer-time").textContent = `${m}:${s}`;
  $("#timer-label").textContent = timer.running
    ? TIMER_MODES[timer.mode].label
    : timer.mode === "focus" ? "ready to focus" : "ready for a break";
  ringEl.style.strokeDashoffset = RING_LEN * (1 - timer.remaining / timer.total);
  $("#timer-toggle").textContent = timer.running ? "pause" : "start";
  $("#timer-card").classList.toggle("break-mode", timer.mode !== "focus");
  document.title = timer.running ? `${m}:${s} · Study Hub` : "Study Hub · your cozy focus space";
  renderDots();
}

function renderDots() {
  const wrap = $("#session-dots");
  wrap.innerHTML = "";
  for (let i = 0; i < 4; i++) {
    const d = document.createElement("span");
    d.className = "dot" + (i < timer.completedFocus ? " done" : "");
    wrap.appendChild(d);
  }
}

function setMode(mode, autostart = false) {
  timer.mode = mode;
  timer.total = timer.remaining = TIMER_MODES[mode].mins * 60;
  document.querySelectorAll(".mode-btn").forEach((b) =>
    b.classList.toggle("active", b.dataset.mode === mode));
  stopTicking();
  if (autostart) startTicking();
  timerRender();
}

function startTicking() {
  timer.running = true;
  timer.interval = setInterval(() => {
    timer.remaining--;
    if (timer.remaining <= 0) onTimerDone();
    timerRender();
  }, 1000);
}
function stopTicking() {
  timer.running = false;
  clearInterval(timer.interval);
}

function onTimerDone() {
  stopTicking();
  chime();
  if (timer.mode === "focus") {
    timer.completedFocus++;
    store.set("pomodoros", store.get("pomodoros", 0) + 1);
    if (timer.completedFocus >= 4) {
      timer.completedFocus = 0;
      toast("4 pomodoros done!! long break earned 🌸");
      setMode("long", true);
    } else {
      toast("focus done! enjoy a short break ☕");
      setMode("short", true);
    }
  } else {
    toast("break's over — back to it, you got this 💪");
    setMode("focus", true);
  }
}

function chime() {
  try {
    const ctx = getAudioCtx();
    [523.25, 659.25, 783.99].forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "sine"; o.frequency.value = f;
      g.gain.setValueAtTime(0.001, ctx.currentTime + i * 0.18);
      g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + i * 0.18 + 0.03);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.18 + 0.6);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + i * 0.18); o.stop(ctx.currentTime + i * 0.18 + 0.65);
    });
  } catch { /* audio unavailable */ }
}

$("#timer-toggle").addEventListener("click", () => {
  timer.running ? stopTicking() : startTicking();
  timerRender();
});
$("#timer-reset").addEventListener("click", () => setMode(timer.mode));
$("#timer-skip").addEventListener("click", () => { timer.remaining = 1; if (!timer.running) startTicking(); });
document.querySelectorAll(".mode-btn").forEach((b) =>
  b.addEventListener("click", () => setMode(b.dataset.mode)));

timerRender();

/* ════════════════════════════════════════════════
   2 · TO-DO LIST with smart time estimates
   ════════════════════════════════════════════════ */
let todos = store.get("todos", [
  { id: 1, text: "read 20 pages of psych textbook", done: false, mins: 40, cat: "reading", due: null },
  { id: 2, text: "review flashcards for spanish quiz", done: false, mins: 25, cat: "review", due: null },
]);

/* Heuristic engine: guesses how long a task takes from its wording. */
function estimateTask(text) {
  const t = text.toLowerCase();

  // explicit page / problem / word counts scale the estimate
  const pages = t.match(/(\d+)\s*(pages?|pgs?)/);
  if (pages) return { mins: clamp(Math.round(+pages[1] * 2.5), 10, 180), cat: "reading" };
  const problems = t.match(/(\d+)\s*(problems?|questions?|exercises?)/);
  if (problems) return { mins: clamp(Math.round(+problems[1] * 4), 10, 180), cat: "practice" };
  const words = t.match(/(\d+)\s*words?/);
  if (words) return { mins: clamp(Math.round(+words[1] / 15), 15, 240), cat: "writing" };

  const rules = [
    [/essay|paper|report|write|draft|blog/, 90, "writing"],
    [/exam|final|midterm|study for/, 120, "studying"],
    [/project|build|code|program|design/, 90, "project"],
    [/read|chapter|textbook|article/, 45, "reading"],
    [/review|revise|flashcard|notes|summar/, 30, "review"],
    [/homework|assignment|worksheet|problem set/, 60, "homework"],
    [/quiz|test prep/, 45, "studying"],
    [/email|reply|message|respond/, 15, "admin"],
    [/organize|clean|tidy|plan|schedule/, 20, "admin"],
    [/watch|lecture|video|tutorial/, 40, "learning"],
    [/practice|drill|exercise/, 40, "practice"],
    [/meeting|call|zoom/, 30, "meeting"],
    [/lab|experiment/, 90, "lab"],
    [/present|slides|powerpoint|deck/, 60, "project"],
  ];
  for (const [re, mins, cat] of rules) if (re.test(t)) return { mins, cat };
  return { mins: 30, cat: "task" };
}
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const fmtMins = (m) => (m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ""}` : `${m} min`);

function saveTodos() { store.set("todos", todos); renderTodos(); renderCalendar(); }

function renderTodos() {
  const list = $("#todo-list");
  list.innerHTML = "";
  todos.forEach((td) => {
    const li = document.createElement("li");
    li.className = "todo-item" + (td.done ? " done" : "");
    const dueTag = td.due
      ? `<span class="tag date">📅 ${new Date(td.due + "T12:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>`
      : "";
    li.innerHTML = `
      <button class="todo-check" aria-label="toggle done">${td.done ? "✓" : ""}</button>
      <div class="todo-main">
        <div class="todo-text"></div>
        <div class="todo-meta">
          <span class="tag time">⏱ ${fmtMins(td.mins)}</span>
          <span class="tag cat">${td.cat}</span>
          ${dueTag}
        </div>
      </div>
      <button class="todo-del" aria-label="delete">✕</button>`;
    li.querySelector(".todo-text").textContent = td.text;
    li.querySelector(".todo-check").onclick = () => { td.done = !td.done; saveTodos(); };
    li.querySelector(".todo-del").onclick = () => { todos = todos.filter((x) => x.id !== td.id); saveTodos(); };
    list.appendChild(li);
  });
  const open = todos.filter((t) => !t.done);
  const totalMins = open.reduce((s, t) => s + t.mins, 0);
  $("#todo-count").textContent = open.length
    ? `${open.length} left · ~${fmtMins(totalMins)}`
    : "all done 🎉";
}

/* live estimate preview while typing */
$("#todo-input").addEventListener("input", (e) => {
  const chip = $("#estimate-chip");
  const val = e.target.value.trim();
  if (val.length < 4) return chip.classList.add("hidden");
  const est = estimateTask(val);
  chip.textContent = `✨ suggestion: this looks like ~${fmtMins(est.mins)} of ${est.cat}`;
  chip.classList.remove("hidden");
});

$("#todo-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const text = $("#todo-input").value.trim();
  if (!text) return;
  const est = estimateTask(text);
  todos.push({ id: Date.now(), text, done: false, mins: est.mins, cat: est.cat, due: $("#todo-date").value || null });
  $("#todo-input").value = "";
  $("#todo-date").value = "";
  $("#estimate-chip").classList.add("hidden");
  saveTodos();
  toast(`added! estimated ${fmtMins(est.mins)} ⏱`);
});

$("#clear-done").addEventListener("click", () => {
  todos = todos.filter((t) => !t.done);
  saveTodos();
});

/* auto-plan: slots open tasks into pomodoro-sized blocks starting now */
$("#auto-plan").addEventListener("click", () => {
  const open = todos.filter((t) => !t.done);
  const plan = $("#day-plan");
  if (!open.length) { toast("nothing to plan — add some tasks first!"); return; }
  const sorted = [...open].sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999") || b.mins - a.mins);
  let cursor = new Date();
  cursor.setMinutes(Math.ceil(cursor.getMinutes() / 5) * 5, 0, 0);
  plan.innerHTML = "";
  const fmt = (d) => d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  sorted.forEach((t, i) => {
    const start = new Date(cursor);
    cursor = new Date(cursor.getTime() + t.mins * 60000);
    const li = document.createElement("li");
    li.innerHTML = `<strong>${fmt(start)}–${fmt(cursor)}</strong> · `;
    li.appendChild(document.createTextNode(t.text));
    plan.appendChild(li);
    if (i < sorted.length - 1) {
      const br = document.createElement("li");
      const bStart = new Date(cursor);
      cursor = new Date(cursor.getTime() + 10 * 60000);
      br.innerHTML = `<strong>${fmt(bStart)}–${fmt(cursor)}</strong> · ☕ break`;
      plan.appendChild(br);
    }
  });
  plan.classList.remove("hidden");
  toast("your day is planned ✨ breaks included");
});

renderTodos();

/* ════════════════════════════════════════════════
   3 · CALENDAR (synced with to-do due dates)
   ════════════════════════════════════════════════ */
let calCursor = new Date();
let selectedDay = null;

function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function renderCalendar() {
  const grid = $("#cal-grid");
  grid.innerHTML = "";
  const y = calCursor.getFullYear(), m = calCursor.getMonth();
  $("#cal-title").textContent = calCursor.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  ["S", "M", "T", "W", "T", "F", "S"].forEach((d) => {
    const el = document.createElement("div");
    el.className = "cal-dow"; el.textContent = d;
    grid.appendChild(el);
  });

  const first = new Date(y, m, 1);
  const start = new Date(first);
  start.setDate(1 - first.getDay());
  const todayStr = ymd(new Date());

  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const dStr = ymd(d);
    const cell = document.createElement("button");
    cell.className = "cal-cell"
      + (d.getMonth() !== m ? " other" : "")
      + (dStr === todayStr ? " today" : "")
      + (dStr === selectedDay ? " selected" : "");
    cell.textContent = d.getDate();
    if (todos.some((t) => t.due === dStr && !t.done)) {
      const dot = document.createElement("span");
      dot.className = "evt-dot";
      cell.appendChild(dot);
    }
    cell.onclick = () => { selectedDay = dStr; renderCalendar(); renderDayDetail(dStr); };
    grid.appendChild(cell);
  }
}

function renderDayDetail(dStr) {
  const box = $("#cal-day-detail");
  const items = todos.filter((t) => t.due === dStr);
  const nice = new Date(dStr + "T12:00").toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  if (!items.length) {
    box.innerHTML = `<h4>${nice}</h4><p class="muted">nothing due — free day 🌿</p>`;
    return;
  }
  const total = items.filter((t) => !t.done).reduce((s, t) => s + t.mins, 0);
  box.innerHTML = `<h4>${nice} · ~${fmtMins(total)} of work</h4><ul></ul>`;
  const ul = box.querySelector("ul");
  items.forEach((t) => {
    const li = document.createElement("li");
    li.textContent = `${t.done ? "✅" : "⏳"} ${t.text} (${fmtMins(t.mins)})`;
    ul.appendChild(li);
  });
}

$("#cal-prev").onclick = () => { calCursor.setMonth(calCursor.getMonth() - 1); renderCalendar(); };
$("#cal-next").onclick = () => { calCursor.setMonth(calCursor.getMonth() + 1); renderCalendar(); };
renderCalendar();

/* ════════════════════════════════════════════════
   4 · LOFI PLAYER + ambience mixer
   ════════════════════════════════════════════════ */
document.querySelectorAll(".preset").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".preset").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    $("#lofi-frame").src = `https://www.youtube-nocookie.com/embed/${btn.dataset.video}?rel=0&autoplay=1`;
    toast("switching vibes 🎧");
  });
});

/* ambience = generated noise, no files needed */
let audioCtx = null;
const getAudioCtx = () => (audioCtx ??= new (window.AudioContext || window.webkitAudioContext)());
const ambience = { rain: null, cafe: null };

function makeNoise(kind) {
  const ctx = getAudioCtx();
  const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1;
    if (kind === "cafe") { last = (last + 0.02 * white) / 1.02; data[i] = last * 3.5; } // brown-ish murmur
    else data[i] = white;
  }
  const src = ctx.createBufferSource();
  src.buffer = buf; src.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = kind === "rain" ? 900 : 400;
  const gain = ctx.createGain();
  gain.gain.value = kind === "rain" ? 0.06 : 0.09;
  src.connect(filter).connect(gain).connect(ctx.destination);
  src.start();
  return src;
}

function toggleAmbience(kind, btn) {
  if (ambience[kind]) {
    ambience[kind].stop(); ambience[kind] = null;
    btn.classList.remove("on");
  } else {
    ambience[kind] = makeNoise(kind);
    btn.classList.add("on");
    toast(kind === "rain" ? "rain sounds on 🌧" : "café hum on ☕");
  }
}
$("#amb-rain").onclick = (e) => toggleAmbience("rain", e.currentTarget);
$("#amb-cafe").onclick = (e) => toggleAmbience("cafe", e.currentTarget);

/* ════════════════════════════════════════════════
   5 · STICKY-NOTE BRAINSTORM BOARD (drag anywhere)
   ════════════════════════════════════════════════ */
const COLORS = ["c-butter", "c-pink", "c-mint", "c-lav", "c-sky", "c-peach"];
let notes = store.get("notes", [
  { id: 1, text: "brain dump ideas here ✨", x: 30, y: 30, color: "c-butter", rot: -2 },
  { id: 2, text: "drag me around!", x: 240, y: 90, color: "c-pink", rot: 3 },
  { id: 3, text: "essay thesis ideas:\n– topic A\n– topic B", x: 460, y: 40, color: "c-mint", rot: -1 },
]);
const board = $("#board");

function saveNotes() { store.set("notes", notes); }

function renderNotes() {
  board.querySelectorAll(".sticky").forEach((n) => n.remove());
  notes.forEach((n) => board.appendChild(buildSticky(n)));
}

function buildSticky(n) {
  const el = document.createElement("div");
  el.className = `sticky ${n.color}`;
  el.style.left = n.x + "px";
  el.style.top = n.y + "px";
  el.style.transform = `rotate(${n.rot}deg)`;
  el.dataset.id = n.id;

  const ta = document.createElement("textarea");
  ta.value = n.text;
  ta.placeholder = "jot something…";
  ta.addEventListener("input", () => { n.text = ta.value; saveNotes(); });

  const x = document.createElement("button");
  x.className = "sticky-x"; x.textContent = "✕"; x.title = "delete note";
  x.addEventListener("click", () => {
    notes = notes.filter((m) => m.id !== n.id);
    el.remove(); saveNotes();
  });

  el.append(ta, x);

  /* pointer-based dragging (mouse + touch) */
  el.addEventListener("pointerdown", (e) => {
    if (e.target === ta || e.target === x) return;
    e.preventDefault();
    el.setPointerCapture(e.pointerId);
    el.classList.add("dragging");
    const startX = e.clientX - n.x, startY = e.clientY - n.y;
    const move = (ev) => {
      n.x = clamp(ev.clientX - startX, 0, board.clientWidth - el.offsetWidth);
      n.y = clamp(ev.clientY - startY, 0, board.clientHeight - el.offsetHeight);
      el.style.left = n.x + "px";
      el.style.top = n.y + "px";
    };
    const up = () => {
      el.classList.remove("dragging");
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      saveNotes();
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
  });

  return el;
}

function addNote(x, y) {
  const n = {
    id: Date.now(),
    text: "",
    x: x ?? 20 + Math.random() * Math.max(20, board.clientWidth - 240),
    y: y ?? 20 + Math.random() * Math.max(20, board.clientHeight - 200),
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    rot: Math.round(Math.random() * 8 - 4),
  };
  notes.push(n);
  const el = buildSticky(n);
  board.appendChild(el);
  el.querySelector("textarea").focus();
  saveNotes();
}

$("#add-note").addEventListener("click", () => addNote());
board.addEventListener("dblclick", (e) => {
  if (e.target !== board) return;
  const rect = board.getBoundingClientRect();
  addNote(clamp(e.clientX - rect.left - 85, 0, board.clientWidth - 180),
          clamp(e.clientY - rect.top - 20, 0, board.clientHeight - 160));
});

renderNotes();
