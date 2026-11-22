-- Smart Queue Management System for University Offices
-- Step 1: database schema (PostgreSQL / Supabase)
-- Run in the Supabase SQL editor. Row Level Security and the
-- join_queue / call_next functions come in the next steps.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------
-- Enumerated types
-- ---------------------------------------------------------------
create type user_role as enum ('student', 'staff', 'admin');

create type queue_status as enum (
  'waiting', 'called', 'in_service', 'completed', 'skipped', 'cancelled'
);

create type notification_type as enum (
  'joined', 'position_changed', 'turn_approaching',
  'called', 'skipped', 'completed', 'cancelled'
);

-- ---------------------------------------------------------------
-- Offices (Bursary, Registry, Admissions, ...)
-- ---------------------------------------------------------------
create table offices (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  location    text,
  description text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- Profiles: one row per user, linked to Supabase Auth
-- Staff must be assigned to an office.
-- ---------------------------------------------------------------
create table profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  full_name  text not null,
  email      text not null unique,
  matric_no  text unique,
  role       user_role not null default 'student',
  office_id  uuid references offices (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint staff_must_have_office
    check (role <> 'staff' or office_id is not null)
);

-- ---------------------------------------------------------------
-- Services offered by an office (each service has its own queue)
-- prefix is used for ticket numbers, e.g. BUR-012
-- ---------------------------------------------------------------
create table services (
  id                   uuid primary key default gen_random_uuid(),
  office_id            uuid not null references offices (id) on delete cascade,
  name                 text not null,
  prefix               text not null unique check (prefix ~ '^[A-Z]{2,4}$'),
  description          text,
  avg_service_minutes  int  not null default 10 check (avg_service_minutes > 0),
  is_active            boolean not null default true,
  created_at           timestamptz not null default now(),
  unique (office_id, name)
);

-- ---------------------------------------------------------------
-- Queue entries: one row per student request
-- seq restarts at 1 for each service every day (Lagos time)
-- ---------------------------------------------------------------
create table queue_entries (
  id            uuid primary key default gen_random_uuid(),
  service_id    uuid not null references services (id),
  student_id    uuid not null references profiles (id),
  queue_date    date not null default ((now() at time zone 'Africa/Lagos')::date),
  seq           int  not null check (seq > 0),
  ticket_number text not null,
  status        queue_status not null default 'waiting',
  joined_at     timestamptz not null default now(),
  called_at     timestamptz,
  started_at    timestamptz,
  completed_at  timestamptz,
  served_by     uuid references profiles (id),
  remarks       text,
  unique (service_id, queue_date, seq)
);

-- A student can hold only one active ticket per service at a time
create unique index one_active_entry_per_student_service
  on queue_entries (student_id, service_id)
  where status in ('waiting', 'called', 'in_service');

create index queue_entries_lookup
  on queue_entries (service_id, queue_date, status, seq);

create index queue_entries_student_history
  on queue_entries (student_id, joined_at desc);

-- ---------------------------------------------------------------
-- Notifications (in-app)
-- ---------------------------------------------------------------
create table notifications (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references profiles (id) on delete cascade,
  queue_entry_id uuid references queue_entries (id) on delete cascade,
  type           notification_type not null,
  message        text not null,
  is_read        boolean not null default false,
  created_at     timestamptz not null default now()
);

create index notifications_inbox
  on notifications (user_id, is_read, created_at desc);

-- ---------------------------------------------------------------
-- View: live position and estimated wait for today's tickets
-- security_invoker makes the view respect Row Level Security
-- ---------------------------------------------------------------
create view queue_positions with (security_invoker = true) as
select
  q.id            as queue_entry_id,
  q.service_id,
  q.student_id,
  q.ticket_number,
  q.status,
  case when q.status = 'waiting' then
    1 + (select count(*)
         from queue_entries a
         where a.service_id = q.service_id
           and a.queue_date = q.queue_date
           and a.status = 'waiting'
           and a.seq < q.seq)
  end as position,
  case when q.status = 'waiting' then
    (select count(*)
     from queue_entries a
     where a.service_id = q.service_id
       and a.queue_date = q.queue_date
       and a.status = 'waiting'
       and a.seq < q.seq) * s.avg_service_minutes
  end as est_wait_minutes
from queue_entries q
join services s on s.id = q.service_id
where q.queue_date = ((now() at time zone 'Africa/Lagos')::date);

-- ---------------------------------------------------------------
-- View: daily statistics per service (for admin reports)
-- ---------------------------------------------------------------
create view daily_service_stats with (security_invoker = true) as
select
  q.queue_date,
  s.id   as service_id,
  s.name as service_name,
  o.name as office_name,
  count(*)                                           as total_requests,
  count(*) filter (where q.status = 'completed')     as completed,
  count(*) filter (where q.status = 'skipped')       as skipped,
  count(*) filter (where q.status = 'cancelled')     as cancelled,
  count(*) filter (where q.status = 'waiting')       as still_waiting,
  round(avg(extract(epoch from (q.called_at - q.joined_at)) / 60)
        filter (where q.called_at is not null), 1)   as avg_wait_minutes,
  round(avg(extract(epoch from (q.completed_at - q.started_at)) / 60)
        filter (where q.completed_at is not null
                  and q.started_at is not null), 1)  as avg_service_minutes
from queue_entries q
join services s on s.id = q.service_id
join offices  o on o.id = s.office_id
group by q.queue_date, s.id, s.name, o.name;
