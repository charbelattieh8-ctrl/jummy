/* Admin panel script */

const TOKEN_KEY = 'dbj_admin_token_v1';
const MENU_CATEGORY_SWEETS = 'sweets';
const MENU_CATEGORY_DAILY = 'daily-platters';

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

function normalizeCategory(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === MENU_CATEGORY_SWEETS) return MENU_CATEGORY_SWEETS;
  if (raw === MENU_CATEGORY_DAILY) return MENU_CATEGORY_DAILY;
  return MENU_CATEGORY_DAILY;
}

function categoryLabel(value) {
  return normalizeCategory(value) === MENU_CATEGORY_SWEETS ? 'Sweets' : 'Daily Platters';
}

function setAuthState(isAuthed) {
  document.getElementById('login-screen').style.display = isAuthed ? 'none' : 'block';
  document.getElementById('admin-app').style.display = isAuthed ? 'block' : 'none';
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
  document.getElementById('category').value = normalizeCategory(item?.category);
  document.getElementById('price').value = item?.price ?? '';
  document.getElementById('image').value = item?.image || 'assets/images/menu1.jpg';
  document.getElementById('description').value = item?.description || '';
  updateImagePreview(document.getElementById('image').value);
}

function updateImagePreview(src) {
  const img = document.getElementById('image-preview');
  if (!img) return;
  const value = String(src || '').trim();
  if (!value) {
    img.style.display = 'none';
    img.removeAttribute('src');
    return;
  }
  img.src = value;
  img.style.display = 'block';
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Invalid image'));
    img.src = src;
  });
}

async function optimizeImageFile(file) {
  if (!file || !String(file.type || '').startsWith('image/')) {
    throw new Error('Please choose a valid image file');
  }

  const rawDataUrl = await readFileAsDataUrl(file);
  const image = await loadImage(rawDataUrl);
  const maxSize = 1200;
  const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
  const targetW = Math.max(1, Math.round(image.width * scale));
  const targetH = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not process image');
  ctx.drawImage(image, 0, 0, targetW, targetH);

  // JPEG keeps payload sizes smaller for API transport.
  return canvas.toDataURL('image/jpeg', 0.82);
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
        <div style="display:flex; align-items:center; gap:10px;">
          <img src="${item.image || 'assets/images/menu1.jpg'}" alt="${item.name}" style="width:46px; height:46px; object-fit:cover; border-radius:8px; border:1px solid #eee;">
          <div style="font-weight:700;">${item.name} <span class="pill">${money(item.price)}</span> <span class="pill">${categoryLabel(item.category)}</span></div>
        </div>
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
  const historyHost = document.getElementById('orders-history');
  try {
    const orders = await fetchJSON('/api/orders');
    const activeOrders = orders.filter((o) => (o.status || 'pending') !== 'completed');
    const completedOrders = orders.filter((o) => o.status === 'completed');

    host.innerHTML = '';
    historyHost.innerHTML = '';

    if (!activeOrders.length) {
      host.innerHTML = '<p class="muted">No active orders.</p>';
    }
    if (!completedOrders.length) {
      historyHost.innerHTML = '<p class="muted">No completed orders yet.</p>';
    }

    activeOrders.slice().reverse().forEach((o) => {
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
        <div style="margin-top:8px; display:flex; gap:8px;">
          <button class="btn small" type="button" data-complete="${o.id}" style="background:#8e7077;">Complete</button>
          <button class="btn small" type="button" data-order-del="${o.id}" style="background:#c0392b;">Delete</button>
        </div>
      `;
      host.appendChild(div);
    });

    completedOrders.slice().reverse().forEach((o) => {
      const div = document.createElement('div');
      div.style.borderBottom = '1px solid #f2f2f2';
      div.style.padding = '10px 0';
      div.innerHTML = `
        <div style="font-weight:700;">${o.customer?.name || 'Customer'} - ${new Date(o.createdAt).toLocaleString()} <span class="pill">Completed</span></div>
        <div class="muted">Phone: ${o.customer?.phone || '-'} - Address: ${o.customer?.address || '-'}</div>
        <div style="margin-top:6px;">
          ${o.items.map((it) => `<span class="pill">${it.qty}x ${it.name}</span>`).join(' ')}
        </div>
        <div style="margin-top:6px; font-weight:700;">Total: ${money(o.total)}</div>
        <div style="margin-top:8px; display:flex; gap:8px;">
          <button class="btn small" type="button" data-order-del="${o.id}" style="background:#c0392b;">Delete</button>
        </div>
      `;
      historyHost.appendChild(div);
    });

    const onOrderAction = async (e) => {
      const completeId = e.target.closest('[data-complete]')?.getAttribute('data-complete');
      const delId = e.target.closest('[data-order-del]')?.getAttribute('data-order-del');
      try {
        if (completeId) {
          await fetchJSON(`/api/orders/${completeId}/status`, {
            method: 'PUT',
            body: JSON.stringify({ status: 'completed' }),
          });
          await loadOrders();
        }
        if (delId) {
          if (!confirm('Delete this order permanently?')) return;
          await fetchJSON(`/api/orders/${delId}`, { method: 'DELETE' });
          await loadOrders();
        }
      } catch (err) {
        alert(`Order action failed: ${err.message}`);
      }
    };

    host.onclick = onOrderAction;
    historyHost.onclick = onOrderAction;
  } catch (err) {
    host.innerHTML = `<p class="muted">Could not load orders: ${err.message}</p>`;
    historyHost.innerHTML = '<p class="muted">Order history unavailable.</p>';
  }
}

async function loadMessages() {
  const host = document.getElementById('messages');
  try {
    const messages = await fetchJSON('/api/contact');
    if (!messages.length) {
      host.innerHTML = '<p class="muted">No messages yet.</p>';
      return;
    }
    host.innerHTML = '';
    messages.forEach((m) => {
      const div = document.createElement('div');
      div.style.borderBottom = '1px solid #f2f2f2';
      div.style.padding = '10px 0';
      div.innerHTML = `
        <div style="font-weight:700;">${m.name || 'Visitor'} - ${new Date(m.createdAt).toLocaleString()}</div>
        <div class="muted">${m.email || '-'}</div>
        <div style="margin-top:6px; white-space:pre-wrap;">${m.message || ''}</div>
      `;
      host.appendChild(div);
    });
  } catch {
    host.innerHTML = '<p class="muted">Sign in to view messages.</p>';
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  // Always require login when opening admin page.
  setToken('');
  setAuthState(false);

  try {
    const health = await fetchJSON('/api/health', { headers: { 'X-Admin-Token': '' } });
    const status = health.requireAdminPassword ? 'password required' : 'password bypass on';
    setServerStatus(`Server: ${health.name} v${health.version} (${status}, db: ${health.database})`);
  } catch (err) {
    setServerStatus(`Server: not reachable (${err.message})`, true);
  }

  document.getElementById('clear-login').onclick = () => {
    setToken('');
    setAuthState(false);
    document.getElementById('password').value = '';
    document.getElementById('orders').innerHTML = '<p class="muted">Sign in to view orders.</p>';
    document.getElementById('orders-history').innerHTML = '<p class="muted">Sign in to view order history.</p>';
    document.getElementById('messages').innerHTML = '<p class="muted">Sign in to view messages.</p>';
  };

  document.getElementById('logout').onclick = () => {
    setToken('');
    setAuthState(false);
    document.getElementById('password').value = '';
    document.getElementById('orders').innerHTML = '<p class="muted">Sign in to view orders.</p>';
    document.getElementById('orders-history').innerHTML = '<p class="muted">Sign in to view order history.</p>';
    document.getElementById('messages').innerHTML = '<p class="muted">Sign in to view messages.</p>';
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
      setAuthState(true);
      await loadMenuList();
      await loadOrders();
      await loadMessages();
      fillForm(null);
    } catch (err) {
      alert(`Login failed: ${err.message} (origin: ${location.origin})`);
    }
  };

  document.getElementById('new-item').onclick = () => fillForm(null);

  document.getElementById('image').addEventListener('input', (e) => {
    updateImagePreview(e.target.value);
  });

  document.getElementById('image-upload').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const optimized = await optimizeImageFile(file);
      document.getElementById('image').value = optimized;
      updateImagePreview(optimized);
    } catch (err) {
      alert(`Image upload failed: ${err.message}`);
    }
  });

  document.getElementById('edit-form').onsubmit = async (e) => {
    e.preventDefault();
    const id = document.getElementById('item-id').value.trim();
    const payload = {
      name: document.getElementById('name').value.trim(),
      category: normalizeCategory(document.getElementById('category').value),
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
      await loadMessages();
      fillForm(null);
    } catch (err) {
      alert(`Save failed: ${err.message}`);
    }
  };

  // No admin data is loaded until successful login.
});
