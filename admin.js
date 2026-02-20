/* Admin panel script */

const TOKEN_KEY = 'dbj_admin_token_v1';

function getToken() {
  return localStorage.getItem(TOKEN_KEY) || '';
}

function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function fetchJSON(url, opts = {}) {
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(getToken() ? { 'X-Admin-Token': getToken() } : {}),
      ...(opts.headers || {}),
    },
    ...opts,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error((data && data.error) || `Request failed: ${res.status}`);
  return data;
}

function money(n) {
  return `$${Number(n || 0).toFixed(2)}`;
}

function setEditorMode(isAuthed) {
  document.getElementById('login-form').style.display = isAuthed ? 'none' : 'block';
  document.getElementById('edit-form').style.display = isAuthed ? 'block' : 'none';
  document.getElementById('editor-title').textContent = isAuthed ? 'Edit / Add Item' : 'Admin Login';
  document.getElementById('logout').style.display = isAuthed ? 'inline-block' : 'none';
}

function setServerStatus(text, isError = false) {
  const el = document.getElementById('server-status');
  if (!el) return;
  el.textContent = text;
  el.style.color = isError ? '#c0392b' : '#666';
}

function fillForm(item) {
  document.getElementById('item-id').value = item?.id || '';
  document.getElementById('name').value = item?.name || '';
  document.getElementById('price').value = item?.price ?? '';
  document.getElementById('image').value = item?.image || 'assets/images/menu1.jpg';
  document.getElementById('description').value = item?.description || '';
}

async function loadMenuList() {
  const host = document.getElementById('menu-list');
  host.innerHTML = '<p class="muted">Loading...</p>';
  const menu = await fetchJSON('/api/menu');
  if (!menu.length) {
    host.innerHTML = '<p class="muted">No items yet. Click \"New item\" to add one.</p>';
    return;
  }

  host.innerHTML = '';
  menu.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'row';
    row.innerHTML = `
      <div>
        <div style="font-weight:700;">${item.name} <span class="pill">${money(item.price)}</span></div>
        <div class="muted">${item.description || ''}</div>
      </div>
      <div style="display:flex; gap:8px;">
        <button class="btn small" type="button" data-edit="${item.id}">Edit</button>
        <button class="btn small" type="button" data-del="${item.id}" style="background:#c0392b;">Delete</button>
      </div>
    `;
    host.appendChild(row);
  });

  host.onclick = async (e) => {
    const editId = e.target.closest('[data-edit]')?.getAttribute('data-edit');
    const delId = e.target.closest('[data-del]')?.getAttribute('data-del');
    if (editId) {
      const item = menu.find((m) => m.id === editId);
      fillForm(item);
    }
    if (delId) {
      if (!confirm('Delete this item?')) return;
      await fetchJSON(`/api/menu/${delId}`, { method: 'DELETE' });
      await loadMenuList();
      fillForm(null);
    }
  };
}

async function loadOrders() {
  const host = document.getElementById('orders');
  try {
    const orders = await fetchJSON('/api/orders');
    if (!orders.length) {
      host.innerHTML = '<p class="muted">No orders yet.</p>';
      return;
    }
    host.innerHTML = '';
    orders.slice().reverse().forEach((o) => {
      const div = document.createElement('div');
      div.style.borderBottom = '1px solid #f2f2f2';
      div.style.padding = '10px 0';
      div.innerHTML = `
        <div style="font-weight:700;">${o.customer?.name || 'Customer'} - ${new Date(o.createdAt).toLocaleString()}</div>
        <div class="muted">Phone: ${o.customer?.phone || '-'} - Address: ${o.customer?.address || '-'}</div>
        <div style="margin-top:6px;">
          ${o.items.map((it) => `<span class="pill">${it.qty}x ${it.name}</span>`).join(' ')}
        </div>
        <div style="margin-top:6px; font-weight:700;">Total: ${money(o.total)}</div>
      `;
      host.appendChild(div);
    });
  } catch {
    host.innerHTML = '<p class="muted">Sign in to view orders.</p>';
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  setEditorMode(Boolean(getToken()));

  try {
    const health = await fetchJSON('/api/health', { headers: { 'X-Admin-Token': '' } });
    const status = health.requireAdminPassword ? 'password required' : 'password bypass on';
    setServerStatus(`Server: ${health.name} v${health.version} (${status}, db: ${health.database})`);
    if (!health.requireAdminPassword) setEditorMode(true);
  } catch (err) {
    setServerStatus(`Server: not reachable (${err.message})`, true);
  }

  document.getElementById('clear-login').onclick = () => {
    setToken('');
    setEditorMode(false);
    document.getElementById('orders').innerHTML = '<p class="muted">Sign in to view orders.</p>';
  };

  document.getElementById('logout').onclick = () => {
    setToken('');
    setEditorMode(false);
    document.getElementById('orders').innerHTML = '<p class="muted">Sign in to view orders.</p>';
  };

  document.getElementById('login-form').onsubmit = async (e) => {
    e.preventDefault();
    const password = document.getElementById('password').value.normalize('NFKC').trim();
    try {
      const { token } = await fetchJSON('/api/admin/login', {
        method: 'POST',
        body: JSON.stringify({ password }),
        headers: { 'X-Admin-Token': '' },
      });
      setToken(token);
      setEditorMode(true);
      await loadMenuList();
      await loadOrders();
      fillForm(null);
    } catch (err) {
      alert(`Login failed: ${err.message} (origin: ${location.origin})`);
    }
  };

  document.getElementById('new-item').onclick = () => fillForm(null);

  document.getElementById('edit-form').onsubmit = async (e) => {
    e.preventDefault();
    const id = document.getElementById('item-id').value.trim();
    const payload = {
      name: document.getElementById('name').value.trim(),
      price: Number(document.getElementById('price').value),
      image: document.getElementById('image').value,
      description: document.getElementById('description').value.trim(),
    };
    try {
      if (id) {
        await fetchJSON(`/api/menu/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
      } else {
        await fetchJSON('/api/menu', { method: 'POST', body: JSON.stringify(payload) });
      }
      await loadMenuList();
      await loadOrders();
      fillForm(null);
    } catch (err) {
      alert(`Save failed: ${err.message}`);
    }
  };

  // Public menu list loads even when not authed; buttons will fail without login.
  await loadMenuList();
  if (getToken()) await loadOrders();
});
