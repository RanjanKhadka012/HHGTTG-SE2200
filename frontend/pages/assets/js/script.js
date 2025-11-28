(function(){
  // If this is the user's first time visiting the index page in this browser
  // session, redirect to the login page after 3 seconds. We use sessionStorage
  // so the redirect happens only once per browser session.
  try{
    const visitKey = 'se2200_seen_index_v1';
    const isIndex = location.pathname === '/' || location.pathname.endsWith('/index.html');
    if(isIndex && !sessionStorage.getItem(visitKey)){
      // mark as seen so subsequent navigations in this session won't redirect
      sessionStorage.setItem(visitKey, '1');
      setTimeout(()=>{ 
        try{ location.href = 'login.html'; }catch(e){} 
      }, 3000);
    }
  }catch(e){ /* ignore sessionStorage errors */ }

  // Redirect to login page if no token (only on index page)
  try{
    if (!localStorage.getItem("token") && location.pathname.endsWith('/index.html')) {
      window.location.href = "login.html";
    }
  }catch(e){}

  // Hide the events container immediately to avoid showing un-grouped DOM
  const __eventsContainer = document.querySelector('.events');
  if(__eventsContainer) __eventsContainer.style.visibility = 'hidden';

  // ---------- date/time utilities ----------
  function startOfDay(d){
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }
  function daysDiff(a,b){
    const msPerDay = 24*60*60*1000;
    return Math.round((startOfDay(a)-startOfDay(b))/msPerDay);
  }
  function formatShortDate(d){
    const mm = String(d.getMonth()+1).padStart(2,'0');
    const dd = String(d.getDate()).padStart(2,'0');
    const yy = String(d.getFullYear()).slice(-2);
    return `${mm}/${dd}/${yy}`;
  }
  function weekdayName(d){
    return d.toLocaleDateString(undefined,{weekday:'long'});
  }

  function computeLabelForDate(dateStr){
    // accept yyyy-mm-dd or mm/dd/yyyy input
    if(!dateStr) return '';
    let d = null;
    const iso = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if(iso){
      d = new Date(Number(iso[1]), Number(iso[2])-1, Number(iso[3]));
    } else {
      const parts = dateStr.split('/').map(p=>p.trim());
      if(parts.length === 3){
        const month = Number(parts[0]);
        const day = Number(parts[1]);
        let year = Number(parts[2]);
        if(year < 100) year += 2000;
        d = new Date(year, month-1, day);
      }
    }
    if(!d || isNaN(d)) return dateStr;

    const today = startOfDay(new Date());
    const diff = daysDiff(d, today);
    if(diff === 0) return 'Today';
    if(diff === 1) return 'Tomorrow';
    if(diff > 1 && diff <= 7) return weekdayName(d);
    return formatShortDate(d);
  }

  // ---------- base renderer (group events by date label) ----------
  function renderGrouped(events) {
  const groups = new Map();

  events.forEach((ev) => {
    const dateStr =
      ev.date ||
      ev.dataDate ||
      (ev.dateTime && ev.dateTime.split("T")[0]) ||
      "";
    const label = computeLabelForDate(dateStr);
    const title = ev.title || "";
    const colorClass = ev.color || ev.colorClass || "e-red";

    if (!groups.has(label)) {
      groups.set(label, { date: dateStr, items: [], color: colorClass });
    }

    // ⬇️ keep time + description for later display
    groups.get(label).items.push({
      id: ev.id,
      title,
      description: ev.description || "",
      time: ev.time || "",
      date: dateStr,
      color: colorClass,
    });
  });

  const container = document.querySelector(".events");
  if (!container) return;
  container.innerHTML = "";

  groups.forEach((group, label) => {
    const article = document.createElement("article");
    article.className = `event ${group.color}`;
    article.setAttribute("data-group-label", label);
    article.style.position = "relative";


    const left = document.createElement("div");
    left.className = "left";
    left.textContent = label;
    left.setAttribute("tabindex", "0");

    const center = document.createElement("div");
    center.className = "center";

    // ⬇️ title + time on the main card
    const main = group.items[0];
    const titleSpan = document.createElement("span");
    titleSpan.textContent = main.title || "";

    const timeSpan = document.createElement("span");
    timeSpan.className = "event-time";
    timeSpan.textContent = main.time ? "  •  " + main.time : "";

    center.appendChild(titleSpan);
    center.appendChild(timeSpan);

    const right = document.createElement("div");
    right.className = "right";
    right.innerHTML = '<span class="arrow" aria-hidden="true"></span>';

    article.appendChild(left);
    article.appendChild(center);
    article.appendChild(right);

    const details = document.createElement("div");
    details.className = "details";
    details.style.display = "none";

    group.items.forEach((it) => {
      const item = document.createElement("div");
      item.className = "d-item";

      // store info for edit/delete
      item.dataset.id = it.id;
      item.dataset.title = it.title;
      item.dataset.description = it.description || "";

      // layout: column, centered
      item.style.display = "flex";
      item.style.flexDirection = "column";
      item.style.alignItems = "stretch";
      item.style.width = "100%";
      item.style.gap = "6px";

      // ⬇️ time inside expanded card
      if (it.time) {
        const timeDiv = document.createElement("div");
        timeDiv.className = "time";
        item.appendChild(timeDiv);
      }

      // description
      const d = document.createElement("div");
      d.className = "description";
      d.textContent = it.description || "";
      d.style.textAlign = "center";

      item.appendChild(d);
      details.appendChild(item);
    });

    article.appendChild(details);

    function toggle() {
  const open = article.classList.toggle("expanded");
  details.style.display = open ? "block" : "none";

  // 🔽 show/hide delete button only when expanded
  const controls = article.querySelector('.details-controls');
  if (controls) {
    controls.style.display = open ? 'flex' : 'none';
  }

  if (open) {
    const focusable = article.querySelector(
      ".details button, .details [tabindex], .details .d-item"
    );
    if (focusable && typeof focusable.focus === "function") {
      focusable.focus();
    }
  }
}


    left.addEventListener("click", toggle);
    left.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        toggle();
      }
    });

    article.setAttribute("tabindex", "0");
    article.addEventListener("click", (ev) => {
      const t = ev.target;
      const tag = t && t.tagName && t.tagName.toLowerCase();
      if (
        tag === "a" ||
        tag === "button" ||
        (t.closest && t.closest(".details"))
      )
        return;
      toggle();
    });
    article.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        toggle();
      }
    });

    container.appendChild(article);
  });
}


  // ---------- API base detection ----------
  (function(){
    try{
      const meta = document.querySelector('meta[name="api-base"]');
      if(meta && meta.content && meta.content.trim()) {
        window.__API_BASE__ = meta.content.trim();
      }
    }catch(e){}
  })();

  function getApiBase() {
    // if meta tag or window.__API_BASE__ is set, use that
    if (window.__API_BASE__ && String(window.__API_BASE__).trim()) {
      return String(window.__API_BASE__).trim();
    }

    const proto = window.location.protocol;
    const host = window.location.hostname;

    // If you're opening the file directly (file:///...), force localhost backend
    if (proto.startsWith('file')) {
      return 'http://localhost:3000';
    }

    if (host === 'localhost' || host === '127.0.0.1') {
      return 'http://localhost:3000';
    }

    return proto + '//' + window.location.host;
  }

  // ---------- backend/localStorage integration ----------
  const LS_KEY = 'se2200_events_v1';

  function loadLocalEvents(){
    try{
      const raw = localStorage.getItem(LS_KEY);
      if(!raw) return [];
      return JSON.parse(raw);
    }catch(e){ return []; }
  }

  function saveLocalEvents(events){
    localStorage.setItem(LS_KEY, JSON.stringify(events));
  }

  async function loadAndRender(){
  const API = getApiBase();
  const userId = localStorage.getItem('userId');

  // If no userId, don't even try to load events
  if (!userId) {
    console.warn('No userId in localStorage; not loading events');
    if (__eventsContainer) __eventsContainer.style.visibility = 'visible';
    return;
  }

  try {
    const resp = await fetch(
      `${API}/api/events?userID=${encodeURIComponent(userId)}`
    );
    if (!resp.ok) throw new Error('bad response');

    const events = await resp.json();
    const colored = events.map((e, i) => Object.assign({}, e, {
      color: e.color || ['e-red','e-green','e-blue','e-pink','e-orange'][i % 5]
    }));
    renderGrouped(colored);
    if (__eventsContainer) __eventsContainer.style.visibility = 'visible';
  } catch (err) {
    console.error('loadAndRender error:', err);
    // fallback (your existing DOM/localStorage fallback if you want)
  }
}

  async function saveEvent(event){
  const API = getApiBase();
  const userId = localStorage.getItem('userId');

  if (!userId) {
    alert('You must be logged in to create events.');
    return;
  }

  // always send userID with the payload
  const payload = Object.assign({}, event, { userID: Number(userId) });

  try {
    if (payload.id && !String(payload.id).startsWith('dom-')) {
      // UPDATE
      const resp = await fetch(`${API}/api/events/${payload.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!resp.ok) throw new Error('bad update');
      const updated = await resp.json();
      await loadAndRender();
      return updated;
    } else {
      // CREATE
      const resp = await fetch(`${API}/api/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!resp.ok) throw new Error('bad create');
      const created = await resp.json();
      await loadAndRender();
      return created;
    }
  } catch (err) {
    console.error('saveEvent error, falling back to localStorage:', err);
    // your localStorage fallback logic can stay the same, if you’re using it
  }
}



  async function deleteEventById(id){
    const API = getApiBase();
    try{
      if(!id) return;
      if(!String(id).startsWith('dom-')){
        const resp = await fetch(API + '/api/events/' + id, {method:'DELETE'});
        if(!resp.ok) throw new Error('bad delete');
        await loadAndRender();
        return true;
      } else {
        const local = loadLocalEvents();
        const remaining = local.filter(e=> e.id !== id);
        saveLocalEvents(remaining);
        renderGrouped(remaining);
        return true;
      }
    }catch(err){
      const local = loadLocalEvents();
      const remaining = local.filter(e=> e.id !== id);
      saveLocalEvents(remaining);
      renderGrouped(remaining);
      return true;
    }
  }

  // ---------- UI: form wiring ----------
  function q(sel){ return document.querySelector(sel); }
  const btnNew = q('#btn-new');
  const form = q('#event-form');
  const formTitle = q('#form-title');
  const formCancel = q('#form-cancel');

  let editingId = null;

  function openForm(edit){
    form.setAttribute('aria-hidden','false');
    form.style.display = 'block';
    if(edit){
      formTitle.textContent = 'Edit Event';
      editingId = edit.id;
      form.querySelector('[name="title"]').value = edit.title || '';
      form.querySelector('[name="date"]').value = edit.date || (edit.dateTime && edit.dateTime.split('T')[0]) || '';
      form.querySelector('[name="time"]').value = edit.time || '';
      form.querySelector('[name="duration"]').value = edit.duration || '';
      form.querySelector('[name="reminderMinutes"]').value = edit.reminderMinutes || '';
    } else {
      formTitle.textContent = 'Create Event';
      editingId = null;
      form.reset();
    }
  }

  function closeForm(){
    form.setAttribute('aria-hidden','true');
    form.style.display = 'none';
    editingId = null;
  }

  btnNew && btnNew.addEventListener('click', ()=> openForm(null));
  formCancel && formCancel.addEventListener('click', closeForm);

  form && form.addEventListener('submit', async (ev)=>{
    ev.preventDefault();
    const data = new FormData(form);
    const obj = {
      id: editingId || undefined,
      title: data.get('title'),
      date: data.get('date'),
      time: data.get('time'),
      duration: data.get('duration'),
      reminderMinutes: data.get('reminderMinutes') ? Number(data.get('reminderMinutes')) : undefined
    };
    await saveEvent(obj);
    closeForm();
  });

  // ---------- Enhance details with edit/delete buttons ----------
const originalRenderGrouped = renderGrouped;

function renderGroupedWithActions(events){
  // first render the grouped cards
  originalRenderGrouped(events);

  // then add Edit/Delete buttons to each detail row
  document.querySelectorAll('.event').forEach(article => {
    const details = article.querySelector('.details');
    if (!details) return;

    Array.from(details.querySelectorAll('.d-item')).forEach(di => {
      // avoid duplicating buttons on re-render
      if (di.querySelector('button')) return;

      // we’ll attach the delete button to the entire card (article),
// but use this event’s id when deleting
const id = di.dataset.id;

const rowControls = document.createElement('div');
rowControls.className = 'details-controls';

// position at bottom-right of the whole card
rowControls.style.position = 'absolute';
rowControls.style.right = '40px';   // nudge from right edge
rowControls.style.bottom = '30px';  // nudge up from bottom
rowControls.style.display = 'none';
rowControls.style.gap = '8px';

const deleteBtn = document.createElement('button');
deleteBtn.className = 'btn muted';
deleteBtn.textContent = 'Delete?';

rowControls.appendChild(deleteBtn);

// ⬅️ append to the *article* (the big pink card), not the .d-item
article.appendChild(rowControls);

deleteBtn.addEventListener('click', async () => {
  if (!id) {
    alert('Unable to find matching event to delete');
    return;
  }
  await deleteEventById(id);
});


      // Edit: use the stored title/description
      

      // Delete: delete directly by id
      deleteBtn.addEventListener('click', async () => {
        const id = di.dataset.id;
        if (!id) {
          alert('Unable to find matching event to delete');
          return;
        }
        await deleteEventById(id);
      });
    });
  });
}

// swap in enhanced renderer
renderGrouped = renderGroupedWithActions;


  

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', loadAndRender);
  } else {
    loadAndRender();
  }
})();
