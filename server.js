/*
  Delights by Jummy - minimal working backend

  What it does
  - Serves the static website (index.html, admin.html, assets, etc.)
  - Stores menu items in ./data/menu.json
  - Stores orders in ./data/orders.json

  Endpoints
  - GET    /api/menu
  - POST   /api/menu              (admin)
  - PUT    /api/menu/:id          (admin)
  - DELETE /api/menu/:id          (admin)
  - POST   /api/orders            (public checkout)
  - GET    /api/orders            (admin)
  - POST   /api/admin/login       (admin)

  Admin auth
  - Set ADMIN_PASSWORD in env (default: admin123)
  - Login returns an X-Admin-Token which must be sent on admin requests.
*/

const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, 'data');
const MENU_FILE = path.join(DATA_DIR, 'menu.json');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const CONTACT_FILE = path.join(DATA_DIR, 'contact_messages.json');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const ALLOW_ANY_PASSWORD = process.env.ALLOW_ANY_PASSWORD === '1';
const MENU_CATEGORY_SWEETS = 'sweets';
const MENU_CATEGORY_DAILY = 'daily-platters';
console.log('ADMIN_PASSWORD_ACTIVE=', ADMIN_PASSWORD);

const activeTokens = new Set();

app.use(cors());
app.use(express.json({ limit: '8mb' }));

// Prevent stale admin assets from being cached
app.use((req, res, next) => {
  if (req.path === '/admin.html' || req.path === '/admin.js') {
    res.set('Cache-Control', 'no-store');
  }
  next();
});

// Serve static site
app.use(express.static(__dirname));

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJsonAtomic(filePath, data) {
  const tmp = `${filePath}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, filePath);
}

function requireAdmin(req, res, next) {
  if (ALLOW_ANY_PASSWORD) return next();
  const token = req.header('X-Admin-Token') || '';
  if (!token || !activeTokens.has(token)) {
    return res.status(401).json({ error: 'Admin auth required' });
  }
  next();
}

function normalizePassword(value) {
  return String(value || '').normalize('NFKC').replace(/\s+/g, '');
}

function normalizeLebanonPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  const local = digits.startsWith('961') ? digits.slice(3) : digits;
  if (local.length < 8) return '';
  return `+961${local}`;
}

function normalizeMenuCategory(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === MENU_CATEGORY_SWEETS) return MENU_CATEGORY_SWEETS;
  if (raw === MENU_CATEGORY_DAILY) return MENU_CATEGORY_DAILY;
  return MENU_CATEGORY_DAILY;
}

function withNormalizedMenuCategory(item) {
  return {
    ...item,
    category: normalizeMenuCategory(item?.category),
  };
}

// Admin login
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body || {};
  if (ALLOW_ANY_PASSWORD) {
    const token = `adm_${uuidv4()}`;
    activeTokens.add(token);
    return res.json({ token });
  }
  const provided = normalizePassword(password);
  const expected = normalizePassword(ADMIN_PASSWORD);
  const matches = provided === expected;
  if (!provided || !matches) {
    return res.status(401).json({ error: 'Invalid password' });
  }
  const token = `adm_${uuidv4()}`;
  activeTokens.add(token);
  res.json({ token });
});

// Menu APIs
app.get('/api/menu', (req, res) => {
  const menu = readJson(MENU_FILE, []);
  res.json(menu.map(withNormalizedMenuCategory));
});

app.post('/api/menu', requireAdmin, (req, res) => {
  const menu = readJson(MENU_FILE, []);
  const { name, description = '', price, image = 'assets/images/menu1.jpg', category } = req.body || {};
  if (!name || typeof price !== 'number') {
    return res.status(400).json({ error: 'Missing name or price' });
  }
  const item = { id: `item_${uuidv4()}`, name, description, price, image, category: normalizeMenuCategory(category) };
  menu.push(item);
  writeJsonAtomic(MENU_FILE, menu);
  res.status(201).json(withNormalizedMenuCategory(item));
});

app.put('/api/menu/:id', requireAdmin, (req, res) => {
  const menu = readJson(MENU_FILE, []);
  const id = req.params.id;
  const idx = menu.findIndex((m) => m.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });

  const { name, description, price, image, category } = req.body || {};
  if (!name || typeof price !== 'number') {
    return res.status(400).json({ error: 'Missing name or price' });
  }
  menu[idx] = {
    ...menu[idx],
    name,
    description: description || '',
    price,
    image: image || menu[idx].image,
    category: normalizeMenuCategory(category ?? menu[idx].category),
  };
  writeJsonAtomic(MENU_FILE, menu);
  res.json(withNormalizedMenuCategory(menu[idx]));
});

app.delete('/api/menu/:id', requireAdmin, (req, res) => {
  const menu = readJson(MENU_FILE, []);
  const id = req.params.id;
  const next = menu.filter((m) => m.id !== id);
  if (next.length === menu.length) return res.status(404).json({ error: 'Not found' });
  writeJsonAtomic(MENU_FILE, next);
  res.json({ ok: true });
});

// Orders APIs
app.post('/api/orders', (req, res) => {
  const { customer = {}, items = [] } = req.body || {};
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Cart is empty' });
  }
  const phone = normalizeLebanonPhone(customer.phone);
  const address = String(customer.address || '').trim();
  if (!phone) return res.status(400).json({ error: 'Phone number is required' });
  if (!address) return res.status(400).json({ error: 'Delivery address is required' });

  const total = items.reduce((sum, it) => sum + Number(it.qty || 0) * Number(it.price || 0), 0);
  const orders = readJson(ORDERS_FILE, []);
  const order = {
    id: `ord_${uuidv4()}`,
    createdAt: new Date().toISOString(),
    status: 'pending',
    customer: {
      name: String(customer.name || '').slice(0, 120),
      phone: phone.slice(0, 60),
      address: address.slice(0, 200),
    },
    items: items.map((it) => ({
      id: String(it.id || '').slice(0, 80),
      name: String(it.name || '').slice(0, 120),
      price: Number(it.price || 0),
      qty: Number(it.qty || 0),
    })).filter((it) => it.qty > 0),
    total,
  };
  orders.push(order);
  writeJsonAtomic(ORDERS_FILE, orders);
  res.status(201).json(order);
});

app.post('/api/contact', (req, res) => {
  const { name, email, message } = req.body || {};
  const cleanName = String(name || '').trim();
  const cleanEmail = String(email || '').trim();
  const cleanMessage = String(message || '').trim();

  if (!cleanName || !cleanEmail || !cleanMessage) {
    return res.status(400).json({ error: 'Name, email, and message are required' });
  }

  const entries = readJson(CONTACT_FILE, []);
  const entry = {
    id: `msg_${uuidv4()}`,
    createdAt: new Date().toISOString(),
    name: cleanName.slice(0, 120),
    email: cleanEmail.slice(0, 160),
    message: cleanMessage.slice(0, 2000),
  };
  entries.push(entry);
  writeJsonAtomic(CONTACT_FILE, entries);
  res.status(201).json({ ok: true });
});

app.get('/api/orders', requireAdmin, (req, res) => {
  const orders = readJson(ORDERS_FILE, []).map((o) => ({
    ...o,
    status: o.status === 'completed' ? 'completed' : 'pending',
  }));
  res.json(orders);
});

app.put('/api/orders/:id/status', requireAdmin, (req, res) => {
  const orders = readJson(ORDERS_FILE, []);
  const id = req.params.id;
  const status = String(req.body?.status || '').trim().toLowerCase();
  if (status !== 'pending' && status !== 'completed') {
    return res.status(400).json({ error: 'Invalid status' });
  }
  const idx = orders.findIndex((o) => o.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  orders[idx] = { ...orders[idx], status };
  writeJsonAtomic(ORDERS_FILE, orders);
  res.json(orders[idx]);
});

app.delete('/api/orders/:id', requireAdmin, (req, res) => {
  const orders = readJson(ORDERS_FILE, []);
  const id = req.params.id;
  const next = orders.filter((o) => o.id !== id);
  if (next.length === orders.length) return res.status(404).json({ error: 'Not found' });
  writeJsonAtomic(ORDERS_FILE, next);
  res.json({ ok: true });
});

app.get('/api/contact', requireAdmin, (req, res) => {
  const entries = readJson(CONTACT_FILE, []);
  res.json(entries.slice().reverse());
});

app.get('/api/health', (req, res) => {
  res.json({
    name: 'delights-by-jummy',
    version: '2.1.0',
    database: 'local-json',
    requireAdminPassword: Boolean(ADMIN_PASSWORD) && !ALLOW_ANY_PASSWORD,
  });
});

// Admin shortcuts / common typos
app.get(['/admin', '/isadmin', '/isadmin.html'], (req, res) => {
  res.redirect('/admin.html');
});

// SPA-friendly fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Delights by Jummy running at http://localhost:${PORT}`);
});
