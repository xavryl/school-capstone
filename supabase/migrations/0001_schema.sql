-- 0001_schema.sql
-- Core tables for the registrar & treasury one-stop service system.
--
-- Run order: 0001_schema -> 0002_functions -> 0003_rls -> 0004_seed
-- Paste each file into the Supabase SQL editor in that order, or use the CLI.

create extension if not exists btree_gist;
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- enums --

create type department       as enum ('registrar', 'treasury');
create type request_status   as enum ('submitted', 'pending', 'processing', 'ready', 'completed', 'cancelled');
create type inquiry_status   as enum ('submitted', 'assigned', 'responded', 'closed');
create type queue_state      as enum ('waiting', 'serving', 'skipped', 'completed');
create type appointment_status as enum ('booked', 'cancelled', 'attended');

-- --------------------------------------------------------------- people --

-- Mirrors auth.users. Populated by the handle_new_user trigger in 0002.
create table profiles (
  id         uuid primary key references auth.users on delete cascade,
  full_name  text not null default '',
  student_no text unique,
  created_at timestamptz not null default now()
);

create table staff (
  user_id    uuid primary key references auth.users on delete cascade,
  department department not null,
  is_admin   boolean not null default false,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------- catalogue --

create table services (
  id          bigint generated always as identity primary key,
  department  department not null,
  name        text not null,
  description text,
  active      boolean not null default true
);

create table service_windows (
  id         bigint generated always as identity primary key,
  department department not null,
  label      text not null,
  active     boolean not null default true
);

-- ------------------------------------------------------------- requests --

create table requests (
  id            uuid primary key default gen_random_uuid(),
  reference     text not null unique,
  student_id    uuid references auth.users on delete set null,
  department    department not null,
  service_id    bigint not null references services,
  details       text not null,
  contact_email text not null,
  contact_phone text,
  preferred_at  timestamptz,
  status        request_status not null default 'submitted',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index on requests (department, status, created_at desc);
create index on requests (student_id);

-- Append-only audit trail. Drives both the tracking timeline and the reports.
create table request_events (
  id         bigint generated always as identity primary key,
  request_id uuid not null references requests on delete cascade,
  status     request_status not null,
  note       text,
  actor      uuid references auth.users on delete set null,
  created_at timestamptz not null default now()
);

create index on request_events (request_id, created_at);

-- --------------------------------------------------------- appointments --

create table appointments (
  id         uuid primary key default gen_random_uuid(),
  request_id uuid references requests on delete cascade,
  student_id uuid references auth.users on delete set null,
  window_id  bigint not null references service_windows,
  starts_at  timestamptz not null,
  ends_at    timestamptz not null,
  status     appointment_status not null default 'booked',
  created_at timestamptz not null default now(),
  constraint appointment_ends_after_start check (ends_at > starts_at)
);

-- The guarantee the whole design rests on: the database itself refuses to
-- hold two live appointments that overlap at the same window. A check-then-
-- insert in application code loses this race; an exclusion constraint cannot.
alter table appointments
  add constraint appointments_no_overlap
  exclude using gist (
    window_id WITH =,
    tstzrange(starts_at, ends_at) WITH &&
  ) where (status <> 'cancelled');

create index on appointments (starts_at);

-- --------------------------------------------------------------- queue --

-- One row per department per day. next_queue_number() upserts against this.
create table queue_counters (
  department   department not null,
  service_date date not null,
  last_number  int not null default 0,
  primary key (department, service_date)
);

create table queue_tickets (
  id           uuid primary key default gen_random_uuid(),
  number       text not null,
  department   department not null,
  service_id   bigint references services,
  request_id   uuid references requests on delete set null,
  window_id    bigint references service_windows,
  state        queue_state not null default 'waiting',
  service_date date not null default current_date,
  created_at   timestamptz not null default now(),
  called_at    timestamptz,
  completed_at timestamptz,
  unique (department, service_date, number)
);

create index on queue_tickets (department, service_date, state, created_at);

-- ------------------------------------------------------------ inquiries --

-- Guests have no account. They are handed a random reference token and
-- everything they can do goes through security-definer functions in 0002.
create table inquiries (
  id           uuid primary key default gen_random_uuid(),
  reference    text not null unique,
  department   department not null,
  name         text not null,
  email        text not null,
  subject      text not null,
  body         text not null,
  status       inquiry_status not null default 'submitted',
  assigned_to  uuid references auth.users on delete set null,
  response     text,
  created_at   timestamptz not null default now(),
  responded_at timestamptz
);

create index on inquiries (department, status, created_at desc);

-- -------------------------------------------------------- notifications --

create table notifications (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users on delete cascade,
  title      text not null,
  body       text,
  href       text,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

create index on notifications (user_id, created_at desc);
