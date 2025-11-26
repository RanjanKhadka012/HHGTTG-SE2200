(function(){
  // Get the API base URL
  const API = (window.__API_BASE__ && String(window.__API_BASE__).trim()) || 
    (location.hostname === 'localhost' || location.hostname === '127.0.0.1' 
      ? 'http://localhost:3000' 
      : (window.location.protocol + '//' + window.location.host));

  // Check if user is authenticated
  function checkAuth() {
    const token = localStorage.getItem('token');
    if (!token) {
      window.location.href = 'login.html';
      return false;
    }
    return true;
  }

  // Load user profile from backend
  async function loadProfile() {
    try {
      const token = localStorage.getItem('token');
      const userId = localStorage.getItem('userId');
      
      if (!userId) {
        // Fallback: try to get profile from current user endpoint
        const resp = await fetch(API + '/api/auth/profile', {
          headers: { 'Authorization': 'Bearer ' + token }
        });
        
        if (!resp.ok) throw new Error('Failed to load profile');
        const data = await resp.json();
        displayProfile(data);
        return;
      }

      const resp = await fetch(API + '/api/users/' + userId, {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      
      if (!resp.ok) throw new Error('Failed to load profile');
      const user = await resp.json();
      displayProfile(user);
    } catch (err) {
      console.error('Profile load error:', err);
      // Fallback: show data from localStorage
      loadProfileFromStorage();
    }
  }

  // Display profile in view mode
  function displayProfile(user) {
    document.getElementById('display-username').textContent = user.username || '-';
    document.getElementById('display-email').textContent = user.email || '-';
    document.getElementById('display-name').textContent = user.name || '-';
    
    // Format joined date
    if (user.createdAt) {
      const date = new Date(user.createdAt);
      document.getElementById('display-joined').textContent = date.toLocaleDateString();
    } else {
      document.getElementById('display-joined').textContent = 'N/A';
    }

    // Store in session for edit mode
    sessionStorage.setItem('profileData', JSON.stringify(user));
  }

  // Fallback: load from localStorage
  function loadProfileFromStorage() {
    const username = localStorage.getItem('username') || '-';
    const email = localStorage.getItem('email') || '-';
    const name = localStorage.getItem('name') || '-';
    
    document.getElementById('display-username').textContent = username;
    document.getElementById('display-email').textContent = email;
    document.getElementById('display-name').textContent = name;
    document.getElementById('display-joined').textContent = new Date().toLocaleDateString();
  }

  // Switch to edit mode
  function enterEditMode() {
    const username = document.getElementById('display-username').textContent;
    const email = document.getElementById('display-email').textContent;
    const name = document.getElementById('display-name').textContent;

    document.getElementById('edit-username').value = username === '-' ? '' : username;
    document.getElementById('edit-email').value = email === '-' ? '' : email;
    document.getElementById('edit-name').value = name === '-' ? '' : name;

    document.getElementById('view-mode').style.display = 'none';
    document.getElementById('edit-form').classList.add('active');
  }

  // Exit edit mode without saving
  function cancelEdit() {
    document.getElementById('view-mode').style.display = 'block';
    document.getElementById('edit-form').classList.remove('active');
  }

  // Save profile changes
  async function saveProfile(e) {
    e.preventDefault();

    const username = document.getElementById('edit-username').value.trim();
    const email = document.getElementById('edit-email').value.trim();
    const name = document.getElementById('edit-name').value.trim();

    if (!username || !email || !name) {
      alert('All fields are required');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const userId = localStorage.getItem('userId');

      const updateData = { username, email, name };

      // Try to update via backend
      const endpoint = userId 
        ? (API + '/api/users/' + userId)
        : (API + '/api/auth/profile');

      const resp = await fetch(endpoint, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify(updateData)
      });

      if (!resp.ok) throw new Error('Failed to update profile');
      const updated = await resp.json();

      // Update localStorage
      localStorage.setItem('username', updated.username);
      localStorage.setItem('email', updated.email);
      localStorage.setItem('name', updated.name);

      displayProfile(updated);
      cancelEdit();
      alert('Profile updated successfully!');
    } catch (err) {
      console.error('Update error:', err);
      // Fallback: save to localStorage only
      localStorage.setItem('username', username);
      localStorage.setItem('email', email);
      localStorage.setItem('name', name);
      
      displayProfile({ username, email, name });
      cancelEdit();
      alert('Profile saved locally (backend unavailable)');
    }
  }

  // Logout
  function logout() {
    if (confirm('Are you sure you want to logout?')) {
      localStorage.removeItem('token');
      localStorage.removeItem('userId');
      sessionStorage.clear();
      window.location.href = 'login.html';
    }
  }

  // Event listeners
  document.getElementById('btn-edit-profile').addEventListener('click', enterEditMode);
  document.getElementById('btn-cancel-edit').addEventListener('click', cancelEdit);
  document.getElementById('edit-form').addEventListener('submit', saveProfile);
  document.getElementById('btn-logout').addEventListener('click', logout);

  // Initialize on page load
  if (checkAuth()) {
    loadProfile();
  }
})();
