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
  customer_phone text not null,
  customer_address text not null,
  items jsonb not null,
  total numeric(10,2) not null default 0
);

create index if not exists idx_orders_created_at on orders (created_at desc);

create table if not exists contact_messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  email text not null,
  message text not null
);

-- Backfill and tighten constraints for existing projects.
do $$
begin
  if exists (
    select 1
    from orders
    where customer_phone is null
      or length(regexp_replace(customer_phone, '\D', '', 'g')) < 8
      or customer_address is null
      or length(btrim(customer_address)) = 0
  ) then
    raise notice 'Orders table has legacy invalid data; strict phone/address constraints were not applied.';
  else
    alter table orders
      alter column customer_phone set not null,
      alter column customer_address set not null;

    alter table orders
      drop constraint if exists orders_customer_phone_min_digits,
      add constraint orders_customer_phone_min_digits
      check (length(regexp_replace(customer_phone, '\D', '', 'g')) >= 8);

    alter table orders
      drop constraint if exists orders_customer_phone_prefix_961,
      add constraint orders_customer_phone_prefix_961
      check (left(customer_phone, 4) = '+961');

    alter table orders
      drop constraint if exists orders_customer_address_required,
      add constraint orders_customer_address_required
      check (length(btrim(customer_address)) > 0);
  end if;
end $$;
