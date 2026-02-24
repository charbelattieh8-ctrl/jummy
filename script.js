/*
  Delights by Jummy - client script

  Features:
  - Loads menu items from backend (/api/menu).
  - Lets clients add items to cart, adjust quantities, checkout.
  - Cart persists in localStorage.
  - Checkout posts an order to backend (/api/orders).
  - Mobile nav hamburger.
  - AOS scroll animations (if loaded).
*/

const API_BASE = '';
const CART_KEY = 'dbj_cart_v1';
const MENU_CATEGORY_SWEETS = 'sweets';
const MENU_CATEGORY_DAILY = 'daily-platters';

function money(n) {
  return `$${Number(n || 0).toFixed(2)}`;
}

function normalizeCategory(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === MENU_CATEGORY_SWEETS) return MENU_CATEGORY_SWEETS;
  if (raw === MENU_CATEGORY_DAILY) return MENU_CATEGORY_DAILY;
  return MENU_CATEGORY_DAILY;
}

function normalizeLebanonPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  const local = digits.startsWith('961') ? digits.slice(3) : digits;
  if (local.length < 8) return '';
  return `+961${local}`;
}

function readCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY) || '[]');
  } catch {
    return [];
  }
}

function writeCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

function cartCount(cart) {
  return cart.reduce((sum, row) => sum + (row.qty || 0), 0);
}

function cartTotal(cart) {
  return cart.reduce((sum, row) => sum + (row.qty || 0) * (row.price || 0), 0);
}

function upsertCartItem(cart, item, deltaQty) {
  const idx = cart.findIndex((r) => r.id === item.id);
  if (idx === -1) {
    if (deltaQty > 0) cart.push({ id: item.id, name: item.name, price: item.price, qty: deltaQty });
    return cart;
  }
  cart[idx].qty += deltaQty;
  if (cart[idx].qty <= 0) cart.splice(idx, 1);
  return cart;
}

async function fetchJSON(url, opts = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error((data && data.error) || `Request failed: ${res.status}`);
  return data;
}

function renderMenu(menu) {
  const dailyHost = document.getElementById('menu-items-daily');
  const sweetsHost = document.getElementById('menu-items-sweets');
  if (!dailyHost || !sweetsHost) return;

  dailyHost.innerHTML = '';
  sweetsHost.innerHTML = '';

  menu.forEach((item, i) => {
    const card = document.createElement('div');
    card.className = 'menu-item soft-glow';
    card.setAttribute('data-aos', 'zoom-in');
    card.setAttribute('data-aos-delay', String(Math.min(i * 80, 240)));

    card.innerHTML = `
      <img src="${item.image || 'assets/images/menu1.jpg'}" alt="${item.name}">
      <h3>${item.name}</h3>
      <p>${item.description || ''}</p>
      <p style="margin-top:0.75rem; font-weight:700; color:#111;">${money(item.price)}</p>
      <button class="btn" type="button" data-add="${item.id}" style="margin-top:0.75rem;">Add to cart</button>
    `;

    const category = normalizeCategory(item.category);
    if (category === MENU_CATEGORY_SWEETS) {
      sweetsHost.appendChild(card);
    } else {
      dailyHost.appendChild(card);
    }
  });

  if (!dailyHost.children.length) {
    dailyHost.innerHTML = '<p style="color:#666;">No daily platters available right now.</p>';
  }
  if (!sweetsHost.children.length) {
    sweetsHost.innerHTML = '<p style="color:#666;">No sweets available right now.</p>';
  }

  document.getElementById('menu')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-add]');
    if (!btn) return;
    const id = btn.getAttribute('data-add');
    const item = menu.find((m) => m.id === id);
    if (!item) return;
    const cart = upsertCartItem(readCart(), item, 1);
    writeCart(cart);
    renderCart(cart);
    openCart();
  });
}

function renderCart(cart) {
  const countEl = document.getElementById('cart-count');
  const totalEl = document.getElementById('cart-total');
  const rowsEl = document.getElementById('cart-rows');
  if (countEl) countEl.textContent = String(cartCount(cart));
  if (totalEl) totalEl.textContent = money(cartTotal(cart));
  if (!rowsEl) return;

  if (!cart.length) {
    rowsEl.innerHTML = '<p style="color:#666;">Your cart is empty.</p>';
    return;
  }

  rowsEl.innerHTML = '';
  cart.forEach((row) => {
    const div = document.createElement('div');
    div.className = 'cart-row';
    div.innerHTML = `
      <div>
        <div class="title">${row.name}</div>
        <div class="meta">${money(row.price)} each</div>
      </div>
      <div style="text-align:right;">
        <div class="qty">
          <button type="button" data-dec="${row.id}">−</button>
          <span>${row.qty}</span>
          <button type="button" data-inc="${row.id}">+</button>
        </div>
        <div class="meta" style="margin-top:0.25rem;">${money(row.qty * row.price)}</div>
        <button type="button" data-del="${row.id}" style="margin-top:0.35rem; border:none; background:none; color:#c0392b; cursor:pointer;">Remove</button>
      </div>
    `;
    rowsEl.appendChild(div);
  });
}

function openCart() {
  document.getElementById('drawer-backdrop')?.classList.add('open');
  document.getElementById('cart-drawer')?.classList.add('open');
}

function closeCart() {
  document.getElementById('drawer-backdrop')?.classList.remove('open');
  document.getElementById('cart-drawer')?.classList.remove('open');
}

async function loadMenu() {
  try {
    const menu = await fetchJSON(`${API_BASE}/api/menu`);
    renderMenu(menu);
    if (typeof AOS !== 'undefined') AOS.refresh();
  } catch (err) {
    // Fallback demo items if backend is not running
    const demo = [
      { id: 'demo-1', name: 'Daily Special', price: 8.5, image: 'assets/images/menu1.jpg', description: 'Today\'s rotating home-cooked favourite.', category: MENU_CATEGORY_DAILY },
      { id: 'demo-2', name: 'Soups & Stews', price: 6.0, image: 'assets/images/menu2.jpg', description: 'Warm bowls simmered slowly for deep flavour.', category: MENU_CATEGORY_DAILY },
      { id: 'demo-3', name: 'Desserts', price: 4.0, image: 'assets/images/menu3.jpg', description: 'Homemade treats to sweeten your day.', category: MENU_CATEGORY_SWEETS },
    ];
    renderMenu(demo);
  }
}

async function checkout() {
  const cart = readCart();
  if (!cart.length) return;

  const name = prompt('Your name for the order:');
  if (!name) return;
  const phoneInput = prompt('Phone number (required, at least 8 digits):');
  if (phoneInput === null) return;
  const phoneDigits = String(phoneInput || '').replace(/\D/g, '');
  if (!phoneDigits) {
    alert('Phone number is required.');
    return;
  }
  if ((phoneDigits.startsWith('961') ? phoneDigits.slice(3) : phoneDigits).length < 8) {
    alert('Phone number must include at least 8 digits.');
    return;
  }
  const phone = normalizeLebanonPhone(phoneInput);
  if (!phone) {
    alert('Phone number is required.');
    return;
  }

  const addressInput = prompt('Delivery address (required):');
  if (addressInput === null) return;
  const address = addressInput.trim();
  if (!address) {
    alert('Delivery address is required.');
    return;
  }

  try {
    await fetchJSON(`${API_BASE}/api/orders`, {
      method: 'POST',
      body: JSON.stringify({
        customer: { name, phone, address },
        items: cart,
      }),
    });
    alert('Order placed successfully!');
    writeCart([]);
    renderCart([]);
    closeCart();
  } catch (err) {
    alert(`Checkout failed: ${err.message}`);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // Mobile nav
  const hamburger = document.querySelector('.hamburger');
  const navLinks = document.querySelector('nav ul');
  if (hamburger && navLinks) {
    hamburger.addEventListener('click', () => navLinks.classList.toggle('active'));
    hamburger.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' || e.key === ' ') navLinks.classList.toggle('active');
    });
  }

  // AOS
  if (typeof AOS !== 'undefined') {
    AOS.init({ duration: 900, once: true });
  }

  // Cart drawer
  document.getElementById('open-cart')?.addEventListener('click', openCart);
  document.getElementById('close-cart')?.addEventListener('click', closeCart);
  document.getElementById('drawer-backdrop')?.addEventListener('click', closeCart);
  document.getElementById('checkout')?.addEventListener('click', checkout);

  // Cart quantity controls
  document.getElementById('cart-rows')?.addEventListener('click', (e) => {
    const inc = e.target.closest('[data-inc]');
    const dec = e.target.closest('[data-dec]');
    const del = e.target.closest('[data-del]');
    const cart = readCart();

    const id = (inc || dec || del)?.getAttribute(inc ? 'data-inc' : dec ? 'data-dec' : 'data-del');
    if (!id) return;

    const row = cart.find((r) => r.id === id);
    if (!row) return;

    if (inc) row.qty += 1;
    if (dec) row.qty -= 1;
    if (del) row.qty = 0;
    const next = cart.filter((r) => r.qty > 0);
    writeCart(next);
    renderCart(next);
  });

  // Initial render
  const cart = readCart();
  renderCart(cart);
  loadMenu();

  // Contact form
  const contactForm = document.getElementById('contact-form');
  contactForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('name')?.value?.trim() || '';
    const email = document.getElementById('email')?.value?.trim() || '';
    const message = document.getElementById('message')?.value?.trim() || '';

    try {
      await fetchJSON(`${API_BASE}/api/contact`, {
        method: 'POST',
        body: JSON.stringify({ name, email, message }),
      });
      alert('Thanks! Your message was received.');
      contactForm.reset();
    } catch (err) {
      alert(`Could not send your message: ${err.message}`);
    }
  });
});
