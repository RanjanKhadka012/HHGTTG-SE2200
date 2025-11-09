(function(){
  const LS_KEY = 'se2200_events_v1';
  const form = document.getElementById('create-form');
  if(!form) return;
  form.addEventListener('submit', async (ev)=>{
    ev.preventDefault();
    const data = new FormData(form);
    const obj = {
      title: data.get('title'),
      date: data.get('date'),
      time: data.get('time'),
      duration: data.get('duration') || '',
      reminderMinutes: data.get('reminderMinutes') ? Number(data.get('reminderMinutes')) : null
    };

    // Try to POST to backend; if unavailable, store locally.
    try{
      const resp = await fetch('http://localhost:3000/api/events', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify(obj)
      });
      if(resp.ok){
        // success — go back to index
        window.location.href = 'index.html';
        return;
      }
      // If server responded but not ok, we fall back to local save below
    }catch(e){
      console.warn('Backend not reachable, will save locally', e);
    }

    try{
      const raw = localStorage.getItem(LS_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      const newEvent = Object.assign({}, obj, { id: 'dom-' + Date.now() });
      arr.push(newEvent);
      localStorage.setItem(LS_KEY, JSON.stringify(arr));
      window.location.href = 'index.html';
    }catch(err){
    
      alert('Failed to save event: ' + (err && err.message));
    }
  });
})();
