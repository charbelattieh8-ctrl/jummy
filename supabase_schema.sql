-- Delights by Jummy - Supabase schema
-- Run in the Supabase SQL editor once per project.

create extension if not exists "pgcrypto";

create table if not exists menu_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text default '',
  price numeric(10,2) not null,
  image text default 'assets/images/menu1.jpg',
  created_at timestamptz not null default now()
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  customer_name text,
  customer_phone text,
  customer_address text,
  items jsonb not null,
  total numeric(10,2) not null default 0
);

create index if not exists idx_orders_created_at on orders (created_at desc);
