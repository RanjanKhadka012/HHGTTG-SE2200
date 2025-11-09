(function(){
  // Hide the events container immediately to avoid showing un-grouped DOM
  // items briefly before our JS groups them. We'll reveal it after render.
  const __eventsContainer = document.querySelector('.events');
  if(__eventsContainer) __eventsContainer.style.visibility = 'hidden';
  // Utility functions
  function startOfDay(d){
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }
  function daysDiff(a,b){
    const msPerDay = 24*60*60*1000;
    return Math.round((startOfDay(a)-startOfDay(b))/msPerDay);
  }
  function formatShortDate(d){
    // mm/dd/yy
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
    // try ISO first
    const iso = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if(iso){ d = new Date(Number(iso[1]), Number(iso[2])-1, Number(iso[3])); }
    else {
      // try mm/dd/yy or mm/dd/yyyy
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

  // Render events grouped by computed label. Accepts an array of event objects
  // Each event object should have: id, title, date (yyyy-mm-dd), optional color
  function renderGrouped(events){
    const groups = new Map();
    events.forEach(ev=>{
      const dateStr = ev.date || ev.dataDate || ev.dateTime && ev.dateTime.split('T')[0] || '';
      const label = computeLabelForDate(dateStr);
      const title = ev.title || '';
      const colorClass = ev.color || ev.colorClass || 'e-red';
      if(!groups.has(label)) groups.set(label, {date: dateStr, items: [], color: colorClass});
      groups.get(label).items.push({id: ev.id, title, date: dateStr, color: colorClass});
    });

    const container = document.querySelector('.events');
    if(!container) return;
    container.innerHTML = '';

    groups.forEach((group, label) => {
      const article = document.createElement('article');
      article.className = `event ${group.color}`;
      article.setAttribute('data-group-label', label);

      const left = document.createElement('div');
      left.className = 'left';
      left.textContent = label;
      left.setAttribute('tabindex','0');

      const center = document.createElement('div');
      center.className = 'center';
      center.textContent = group.items[0].title || '';

      const right = document.createElement('div');
      right.className = 'right';
      right.innerHTML = '<span class="arrow" aria-hidden="true"></span>';

      article.appendChild(left);
      article.appendChild(center);
      article.appendChild(right);

      const details = document.createElement('div');
      details.className = 'details';
      details.style.display = 'none';
      group.items.forEach(it=>{
        const item = document.createElement('div');
        item.className = 'd-item';
        const t = document.createElement('div');
        t.className = 'title';
        t.textContent = it.title;
        item.appendChild(t);
        details.appendChild(item);
      });
      article.appendChild(details);

      function toggle(){
        const open = article.classList.toggle('expanded');
        // when expanded, move focus into the first actionable control if available
        if(open){
          const focusable = article.querySelector('.details button, .details [tabindex], .details .d-item');
          if(focusable && typeof focusable.focus === 'function') focusable.focus();
        }
      }
      left.addEventListener('click', toggle);
      left.addEventListener('keydown', (ev)=>{
        if(ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); toggle(); }
      });

      // Make the whole article clickable to toggle expand/collapse.
      // Ignore clicks on anchors/buttons or inside details so their own handlers work.
      article.setAttribute('tabindex', '0');
      article.addEventListener('click', (ev)=>{
        const t = ev.target;
        const tag = t && t.tagName && t.tagName.toLowerCase();
        if(tag === 'a' || tag === 'button' || (t.closest && t.closest('.details'))) return;
        toggle();
      });
      article.addEventListener('keydown', (ev)=>{
        if(ev.key === 'Enter' || ev.key === ' '){ ev.preventDefault(); toggle(); }
      });

      container.appendChild(article);
    });
  }

  // Try to load events from backend; fallback to reading inline DOM events if backend unavailable
  async function loadAndRender(){
    const API = 'http://localhost:3000';
    try{
      const resp = await fetch(API + '/api/events');
      if(!resp.ok) throw new Error('bad response');
      const events = await resp.json();
      // assign color classes deterministically by weekday index if not provided
      const colored = events.map((e,i)=> Object.assign({}, e, { color: e.color || ['e-red','e-green','e-blue','e-pink','e-orange'][i % 5] }));
      renderGrouped(colored);
      if(__eventsContainer) __eventsContainer.style.visibility = 'visible';
      return;
    }catch(err){
      // fallback: read existing DOM source events (use their data-date and center text)
      const sourceEvents = Array.from(document.querySelectorAll('.event')).map((el,i)=>({
        id: el.getAttribute('data-id') || ('dom-'+i),
        title: (el.querySelector('.center') || {}).textContent || '',
        date: el.getAttribute('data-date') || el.getAttribute('data-date') || '',
        color: Array.from(el.classList).find(c=>c.startsWith('e-')) || 'e-red'
      }));
      // merge with any localStorage events (unsynced)
      const local = loadLocalEvents();
      const merged = local.concat(sourceEvents);
      renderGrouped(merged);
      if(__eventsContainer) __eventsContainer.style.visibility = 'visible';
      return;
    }
  }

  // ---------- localStorage helpers ----------
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

  // Create or update event: try backend, fall back to localStorage
  async function saveEvent(event){
    const API = 'http://localhost:3000';
    try{
      if(event.id && !String(event.id).startsWith('dom-')){
        // update
        const resp = await fetch(API + '/api/events/' + event.id, {method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(event)});
        if(!resp.ok) throw new Error('bad update');
        const updated = await resp.json();
        await loadAndRender();
        return updated;
      } else {
        // create
        const resp = await fetch(API + '/api/events', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(event)});
        if(!resp.ok) throw new Error('bad create');
        const created = await resp.json();
        await loadAndRender();
        return created;
      }
    }catch(err){
      // local fallback
      const local = loadLocalEvents();
      if(event.id){
        // update local item
        const idx = local.findIndex(x=>x.id === event.id);
        if(idx >= 0) local[idx] = event;
        else local.push(event);
      } else {
        event.id = 'dom-' + Date.now();
        local.push(event);
      }
      saveLocalEvents(local);
      renderGrouped(local.concat(Array.from(document.querySelectorAll('.event')).map((el,i)=>({
        id: el.getAttribute('data-id') || ('dom-'+i),
        title: (el.querySelector('.center') || {}).textContent || '',
        date: el.getAttribute('data-date') || '',
        color: Array.from(el.classList).find(c=>c.startsWith('e-')) || 'e-red'
      }))));
      return event;
    }
  }

  // Delete event: try backend, fall back to localStorage
  async function deleteEventById(id){
    const API = 'http://localhost:3000';
    try{
      if(!id) return;
      if(!String(id).startsWith('dom-')){
        const resp = await fetch(API + '/api/events/' + id, {method:'DELETE'});
        if(!resp.ok) throw new Error('bad delete');
        await loadAndRender();
        return true;
      } else {
        // local id: delete from localStorage
        const local = loadLocalEvents();
        const remaining = local.filter(e=> e.id !== id);
        saveLocalEvents(remaining);
        renderGrouped(remaining);
        return true;
      }
    }catch(err){
      // fallback: remove from localStorage
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
      form.querySelector('[name="date"]').value = edit.date || edit.dateTime && edit.dateTime.split('T')[0] || '';
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

  // Enhance details with edit/delete buttons when rendering
  const originalRenderGrouped = renderGrouped;
  function renderGroupedWithActions(events){
    originalRenderGrouped(events);
    // attach edit/delete to each details item
    document.querySelectorAll('.event').forEach(article=>{
      const details = article.querySelector('.details');
      if(!details) return;
      // append controls area if not present
      if(!article.querySelector('.details-controls')){
        const controls = document.createElement('div');
        controls.className = 'details-controls';
        controls.style.display = 'flex';
        controls.style.gap = '8px';
        controls.style.marginTop = '8px';
        const firstItem = details.querySelector('.d-item');
        // create per-item edit/delete buttons
        Array.from(details.querySelectorAll('.d-item')).forEach((di, idx)=>{
          const rowControls = document.createElement('div');
          rowControls.style.marginLeft = 'auto';
          const editBtn = document.createElement('button');
          editBtn.className = 'btn';
          editBtn.textContent = 'Edit';
          const deleteBtn = document.createElement('button');
          deleteBtn.className = 'btn muted';
          deleteBtn.textContent = 'Delete';
          rowControls.appendChild(editBtn);
          rowControls.appendChild(deleteBtn);
          di.appendChild(rowControls);

          editBtn.addEventListener('click', async ()=>{
            // build event object from d-item text and article label
            const label = article.getAttribute('data-group-label');
            const title = di.querySelector('.title').textContent;
            // try to find matching event in local storage or via backend by title+label
            // For simplicity, open form prefilled with title and date derived from label
            const dateGuess = article.getAttribute('data-group-label') === label ? '' : '';
            openForm({ id: null, title, date: '' });
          });

          deleteBtn.addEventListener('click', async ()=>{
            // For now, attempt to delete by matching title and label from local storage
            const title = di.querySelector('.title').textContent;
            // find candidate in local storage
            const local = loadLocalEvents();
            const candidate = local.find(e=> e.title === title);
            if(candidate){
              await deleteEventById(candidate.id);
            } else {
              // no local candidate: ask backend to delete by searching events
              try{
                const resp = await fetch('http://localhost:3000/api/events');
                const all = await resp.json();
                const match = all.find(e=> e.title === title);
                if(match) await deleteEventById(match.id);
                else alert('Unable to find matching event to delete');
              }catch(e){
                alert('Delete failed');
              }
            }
          });
        });
      }
    });
  }

  // swap in enhanced renderer
  renderGrouped = renderGroupedWithActions;

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', loadAndRender);
  else loadAndRender();
})();
