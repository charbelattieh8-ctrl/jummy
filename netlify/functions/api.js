const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

const APP_NAME = 'delights-by-jummy';
const APP_VERSION = '2.1.0';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || '';
const ALLOW_ANY_PASSWORD = process.env.ALLOW_ANY_PASSWORD === '1';

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const MENU_FILE = path.join(DATA_DIR, 'menu.json');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const CONTACT_FILE = path.join(DATA_DIR, 'contact_messages.json');

class HttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-Token',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    },
    body: JSON.stringify(body),
  };
}

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

function getAdminToken(headers) {
  const headerToken = headers['x-admin-token'] || headers['X-Admin-Token'];
  if (headerToken) return String(headerToken);
  const auth = headers.authorization || headers.Authorization || '';
  if (auth.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim();
  return '';
}

function createJwt(payload, expiresIn) {
  return jwt.sign(payload, ADMIN_JWT_SECRET, { expiresIn });
}

function verifyJwt(token) {
  try {
    return jwt.verify(token, ADMIN_JWT_SECRET);
  } catch {
    return null;
  }
}

function isDevBypass() {
  return !process.env.NETLIFY && (!ADMIN_PASSWORD || ALLOW_ANY_PASSWORD);
}

function requireAdmin(headers) {
  if (isDevBypass()) return true;
  if (!ADMIN_JWT_SECRET) return false;
  const token = getAdminToken(headers);
  if (!token) return false;
  const payload = verifyJwt(token);
  return Boolean(payload && payload.role === 'admin');
}

function getSupabase() {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  return createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
}

function usingSupabase() {
  return Boolean(SUPABASE_URL && SUPABASE_KEY);
}

async function fetchMenu() {
  if (usingSupabase()) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('menu_items')
      .select('id,name,description,price,image,created_at')
      .order('created_at', { ascending: true });
    if (error) throw new Error(error.message);
    return (data || []).map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description || '',
      price: Number(row.price || 0),
      image: row.image || 'assets/images/menu1.jpg',
    }));
  }
  if (process.env.NETLIFY) throw new Error('Database not configured');
  return readJson(MENU_FILE, []);
}

async function createMenuItem(payload) {
  if (usingSupabase()) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('menu_items')
      .insert({
        name: payload.name,
        description: payload.description || '',
        price: payload.price,
        image: payload.image || 'assets/images/menu1.jpg',
      })
      .select('id,name,description,price,image')
      .single();
    if (error) throw new Error(error.message);
    return {
      id: data.id,
      name: data.name,
      description: data.description || '',
      price: Number(data.price || 0),
      image: data.image || 'assets/images/menu1.jpg',
    };
  }
  if (process.env.NETLIFY) throw new Error('Database not configured');
  const menu = readJson(MENU_FILE, []);
  const item = {
    id: `item_${Date.now()}`,
    name: payload.name,
    description: payload.description || '',
    price: payload.price,
    image: payload.image || 'assets/images/menu1.jpg',
  };
  menu.push(item);
  writeJsonAtomic(MENU_FILE, menu);
  return item;
}

async function updateMenuItem(id, payload) {
  if (usingSupabase()) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('menu_items')
      .update({
        name: payload.name,
        description: payload.description || '',
        price: payload.price,
        image: payload.image || 'assets/images/menu1.jpg',
      })
      .eq('id', id)
      .select('id,name,description,price,image')
      .single();
    if (error) throw new Error(error.message);
    return {
      id: data.id,
      name: data.name,
      description: data.description || '',
      price: Number(data.price || 0),
      image: data.image || 'assets/images/menu1.jpg',
    };
  }
  if (process.env.NETLIFY) throw new Error('Database not configured');
  const menu = readJson(MENU_FILE, []);
  const idx = menu.findIndex((m) => m.id === id);
  if (idx === -1) return null;
  menu[idx] = {
    ...menu[idx],
    name: payload.name,
    description: payload.description || '',
    price: payload.price,
    image: payload.image || menu[idx].image,
  };
  writeJsonAtomic(MENU_FILE, menu);
  return menu[idx];
}

async function deleteMenuItem(id) {
  if (usingSupabase()) {
    const supabase = getSupabase();
    const { error } = await supabase.from('menu_items').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return true;
  }
  if (process.env.NETLIFY) throw new Error('Database not configured');
  const menu = readJson(MENU_FILE, []);
  const next = menu.filter((m) => m.id !== id);
  if (next.length === menu.length) return false;
  writeJsonAtomic(MENU_FILE, next);
  return true;
}

async function createOrder(payload) {
  const items = (payload.items || [])
    .map((it) => ({
      id: String(it.id || '').slice(0, 80),
      name: String(it.name || '').slice(0, 120),
      price: Number(it.price || 0),
      qty: Number(it.qty || 0),
    }))
    .filter((it) => it.qty > 0);

  if (!items.length) throw new HttpError(400, 'Cart is empty');

  const phone = normalizeLebanonPhone(payload.customer?.phone);
  const address = String(payload.customer?.address || '').trim();
  if (!phone) throw new HttpError(400, 'Phone number is required');
  if (!address) throw new HttpError(400, 'Delivery address is required');

  const total = items.reduce((sum, it) => sum + it.qty * it.price, 0);

  const order = {
    created_at: new Date().toISOString(),
    customer_name: String(payload.customer?.name || '').slice(0, 120),
    customer_phone: phone.slice(0, 60),
    customer_address: address.slice(0, 200),
    items,
    total,
  };

  if (usingSupabase()) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('orders')
      .insert(order)
      .select('id,created_at,customer_name,customer_phone,customer_address,items,total')
      .single();
    if (error) throw new Error(error.message);
    return {
      id: data.id,
      createdAt: data.created_at,
      customer: {
        name: data.customer_name,
        phone: data.customer_phone,
        address: data.customer_address,
      },
      items: data.items || [],
      total: Number(data.total || 0),
    };
  }

  if (process.env.NETLIFY) throw new Error('Database not configured');
  const orders = readJson(ORDERS_FILE, []);
  const localOrder = {
    id: `ord_${Date.now()}`,
    createdAt: order.created_at,
    customer: {
      name: order.customer_name,
      phone: order.customer_phone,
      address: order.customer_address,
    },
    items,
    total,
  };
  orders.push(localOrder);
  writeJsonAtomic(ORDERS_FILE, orders);
  return localOrder;
}

async function createContactMessage(payload) {
  const name = String(payload.name || '').trim();
  const email = String(payload.email || '').trim();
  const message = String(payload.message || '').trim();
  if (!name || !email || !message) {
    throw new HttpError(400, 'Name, email, and message are required');
  }

  const row = {
    created_at: new Date().toISOString(),
    name: name.slice(0, 120),
    email: email.slice(0, 160),
    message: message.slice(0, 2000),
  };

  if (usingSupabase()) {
    const supabase = getSupabase();
    const { error } = await supabase.from('contact_messages').insert(row);
    if (error) {
      if (String(error.message || '').includes("Could not find the table 'public.contact_messages'")) {
        throw new HttpError(
          500,
          "Contact messages table is missing in Supabase. Run supabase_schema.sql to create public.contact_messages."
        );
      }
      throw new Error(error.message);
    }
    return { ok: true };
  }

  if (process.env.NETLIFY) throw new Error('Database not configured');
  const entries = readJson(CONTACT_FILE, []);
  entries.push({
    id: `msg_${Date.now()}`,
    createdAt: row.created_at,
    name: row.name,
    email: row.email,
    message: row.message,
  });
  writeJsonAtomic(CONTACT_FILE, entries);
  return { ok: true };
}

async function fetchOrders() {
  if (usingSupabase()) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('orders')
      .select('id,created_at,customer_name,customer_phone,customer_address,items,total')
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map((row) => ({
      id: row.id,
      createdAt: row.created_at,
      customer: {
        name: row.customer_name,
        phone: row.customer_phone,
        address: row.customer_address,
      },
      items: row.items || [],
      total: Number(row.total || 0),
    }));
  }
  if (process.env.NETLIFY) throw new Error('Database not configured');
  return readJson(ORDERS_FILE, []);
}

function parseBody(event) {
  if (!event.body) return null;
  const raw = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function extractPath(event) {
  const full = event.path || '';
  const base = '/.netlify/functions/api';
  let route = full.startsWith(base) ? full.slice(base.length) : full;
  if (route.startsWith('/api/')) route = route.slice(4);
  if (!route.startsWith('/')) route = `/${route}`;
  return route;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return jsonResponse(200, { ok: true });

  const route = extractPath(event);
  const method = event.httpMethod || 'GET';
  const headers = event.headers || {};

  try {
    if (route === '/health' && method === 'GET') {
      return jsonResponse(200, {
        name: APP_NAME,
        version: APP_VERSION,
        database: usingSupabase() ? 'supabase' : 'local-json',
        requireAdminPassword: Boolean(ADMIN_PASSWORD) && !isDevBypass(),
      });
    }

    if (route === '/admin/login' && method === 'POST') {
      const body = parseBody(event) || {};
      if (isDevBypass()) {
        const token = ADMIN_JWT_SECRET ? createJwt({ role: 'admin' }, '7d') : 'dev_bypass';
        return jsonResponse(200, { token });
      }
      if (!ADMIN_PASSWORD || !ADMIN_JWT_SECRET) {
        return jsonResponse(500, { error: 'Admin auth is not configured' });
      }
      const provided = normalizePassword(body.password);
      const expected = normalizePassword(ADMIN_PASSWORD);
      if (!provided || provided !== expected) {
        return jsonResponse(401, { error: 'Invalid password' });
      }
      const token = createJwt({ role: 'admin' }, '7d');
      return jsonResponse(200, { token });
    }

    if (route === '/menu' && method === 'GET') {
      const menu = await fetchMenu();
      return jsonResponse(200, menu);
    }

    if (route === '/menu' && method === 'POST') {
      if (!requireAdmin(headers)) return jsonResponse(401, { error: 'Admin auth required' });
      const body = parseBody(event) || {};
      if (!body.name || typeof body.price !== 'number') {
        return jsonResponse(400, { error: 'Missing name or price' });
      }
      const item = await createMenuItem(body);
      return jsonResponse(201, item);
    }

    if (route.startsWith('/menu/') && method === 'PUT') {
      if (!requireAdmin(headers)) return jsonResponse(401, { error: 'Admin auth required' });
      const id = route.split('/')[2];
      const body = parseBody(event) || {};
      if (!body.name || typeof body.price !== 'number') {
        return jsonResponse(400, { error: 'Missing name or price' });
      }
      const item = await updateMenuItem(id, body);
      if (!item) return jsonResponse(404, { error: 'Not found' });
      return jsonResponse(200, item);
    }

    if (route.startsWith('/menu/') && method === 'DELETE') {
      if (!requireAdmin(headers)) return jsonResponse(401, { error: 'Admin auth required' });
      const id = route.split('/')[2];
      const ok = await deleteMenuItem(id);
      if (!ok) return jsonResponse(404, { error: 'Not found' });
      return jsonResponse(200, { ok: true });
    }

    if (route === '/orders' && method === 'POST') {
      const body = parseBody(event) || {};
      const order = await createOrder(body);
      return jsonResponse(201, order);
    }

    if (route === '/contact' && method === 'POST') {
      const body = parseBody(event) || {};
      const result = await createContactMessage(body);
      return jsonResponse(201, result);
    }

    if (route === '/orders' && method === 'GET') {
      if (!requireAdmin(headers)) return jsonResponse(401, { error: 'Admin auth required' });
      const orders = await fetchOrders();
      return jsonResponse(200, orders);
    }

    return jsonResponse(404, { error: 'Not found' });
  } catch (err) {
    return jsonResponse(err.statusCode || 500, { error: err.message || 'Server error' });
  }
};
