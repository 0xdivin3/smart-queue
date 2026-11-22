-- Smart Queue: step 2 - security, business logic and sample data.
-- Run AFTER 01_schema.sql.

-- The old view cannot compute positions under Row Level Security; replaced by my_queue().
drop view if exists queue_positions;

-- ---------------------------------------------------------------
-- Create a profile automatically when someone registers
-- ---------------------------------------------------------------
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, full_name, email, matric_no, role)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), split_part(new.email, '@', 1)),
    new.email,
    nullif(new.raw_user_meta_data->>'matric_no', ''),
    'student'
  );
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------
create or replace function my_role() returns user_role
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid()
$$;

create or replace function my_office() returns uuid
language sql stable security definer set search_path = public as $$
  select office_id from profiles where id = auth.uid()
$$;

create or replace function assert_can_serve(p_service_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (
    my_role() = 'admin'
    or (my_role() = 'staff' and my_office() = (select office_id from services where id = p_service_id))
  ) then
    raise exception 'You are not allowed to manage this queue';
  end if;
end $$;

-- ---------------------------------------------------------------
-- Row Level Security
-- Clients cannot insert or update queue_entries directly;
-- all changes go through the functions below.
-- ---------------------------------------------------------------
alter table offices        enable row level security;
alter table profiles       enable row level security;
alter table services       enable row level security;
alter table queue_entries  enable row level security;
alter table notifications  enable row level security;

create policy offices_read  on offices  for select to authenticated using (true);
create policy offices_admin on offices  for all to authenticated
  using (my_role() = 'admin') with check (my_role() = 'admin');

create policy services_read  on services for select to authenticated using (true);
create policy services_admin on services for all to authenticated
  using (my_role() = 'admin') with check (my_role() = 'admin');

create policy profiles_read on profiles for select to authenticated
  using (id = auth.uid() or my_role() in ('admin', 'staff'));
create policy profiles_admin_write on profiles for all to authenticated
  using (my_role() = 'admin') with check (my_role() = 'admin');

create policy queue_read on queue_entries for select to authenticated
  using (
    student_id = auth.uid()
    or my_role() = 'admin'
    or (my_role() = 'staff' and service_id in (select id from services where office_id = my_office()))
  );

create policy notes_read   on notifications for select to authenticated using (user_id = auth.uid());
create policy notes_update on notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------
-- Student functions
-- ---------------------------------------------------------------
create or replace function join_queue(p_service_id uuid) returns queue_entries
language plpgsql security definer set search_path = public as $$
declare
  v_date   date := (now() at time zone 'Africa/Lagos')::date;
  v_prefix text;
  v_seq    int;
  v_row    queue_entries;
begin
  if auth.uid() is null then raise exception 'Please sign in'; end if;
  if my_role() <> 'student' then raise exception 'Only students can join a queue'; end if;

  select prefix into v_prefix from services where id = p_service_id and is_active;
  if v_prefix is null then raise exception 'This service is not available'; end if;

  if exists (
    select 1 from queue_entries
    where student_id = auth.uid() and service_id = p_service_id
      and status in ('waiting', 'called', 'in_service')
  ) then
    raise exception 'You already have an active ticket for this service';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_service_id::text || v_date::text));

  select coalesce(max(seq), 0) + 1 into v_seq
  from queue_entries where service_id = p_service_id and queue_date = v_date;

  insert into queue_entries (service_id, student_id, queue_date, seq, ticket_number)
  values (p_service_id, auth.uid(), v_date, v_seq, v_prefix || '-' || lpad(v_seq::text, 3, '0'))
  returning * into v_row;

  insert into notifications (user_id, queue_entry_id, type, message)
  values (auth.uid(), v_row.id, 'joined', 'You joined the queue. Your ticket is ' || v_row.ticket_number || '.');

  return v_row;
end $$;

create or replace function cancel_ticket(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update queue_entries set status = 'cancelled'
  where id = p_id and student_id = auth.uid() and status = 'waiting';
  if not found then raise exception 'This ticket cannot be cancelled'; end if;
end $$;

create or replace function service_overview()
returns table (service_id uuid, service_name text, office_name text, avg_service_minutes int, waiting int)
language sql stable security definer set search_path = public as $$
  select s.id, s.name, o.name, s.avg_service_minutes,
    (select count(*) from queue_entries q
      where q.service_id = s.id
        and q.queue_date = (now() at time zone 'Africa/Lagos')::date
        and q.status = 'waiting')::int
  from services s join offices o on o.id = s.office_id
  where s.is_active and o.is_active
  order by o.name, s.name
$$;

create or replace function my_queue()
returns table (id uuid, ticket_number text, status queue_status, service_name text,
               office_name text, pos int, wait_min int, joined_at timestamptz)
language sql stable security definer set search_path = public as $$
  select q.id, q.ticket_number, q.status, s.name, o.name,
    case when q.status = 'waiting' then
      (1 + (select count(*) from queue_entries a
            where a.service_id = q.service_id and a.queue_date = q.queue_date
              and a.status = 'waiting' and a.seq < q.seq))::int end,
    case when q.status = 'waiting' then
      ((select count(*) from queue_entries a
        where a.service_id = q.service_id and a.queue_date = q.queue_date
          and a.status = 'waiting' and a.seq < q.seq) * s.avg_service_minutes)::int end,
    q.joined_at
  from queue_entries q
  join services s on s.id = q.service_id
  join offices  o on o.id = s.office_id
  where q.student_id = auth.uid()
    and q.queue_date = (now() at time zone 'Africa/Lagos')::date
  order by q.joined_at desc
$$;

-- ---------------------------------------------------------------
-- Staff functions
-- ---------------------------------------------------------------
create or replace function staff_board(p_service_id uuid)
returns table (id uuid, ticket_number text, status queue_status, seq int,
               joined_at timestamptz, student_name text, matric_no text)
language plpgsql security definer set search_path = public as $$
begin
  perform assert_can_serve(p_service_id);
  return query
    select q.id, q.ticket_number, q.status, q.seq, q.joined_at, p.full_name, p.matric_no
    from queue_entries q join profiles p on p.id = q.student_id
    where q.service_id = p_service_id
      and q.queue_date = (now() at time zone 'Africa/Lagos')::date
      and q.status in ('waiting', 'called', 'in_service')
    order by q.seq;
end $$;

create or replace function call_next(p_service_id uuid) returns queue_entries
language plpgsql security definer set search_path = public as $$
declare
  v_date   date := (now() at time zone 'Africa/Lagos')::date;
  v_row    queue_entries;
  v_near   record;
  v_office text;
begin
  perform assert_can_serve(p_service_id);

  select * into v_row from queue_entries
  where service_id = p_service_id and queue_date = v_date and status = 'waiting'
  order by seq limit 1 for update skip locked;
  if not found then raise exception 'No students are waiting'; end if;

  update queue_entries set status = 'called', called_at = now(), served_by = auth.uid()
  where id = v_row.id returning * into v_row;

  select o.name into v_office from services s join offices o on o.id = s.office_id
  where s.id = p_service_id;

  insert into notifications (user_id, queue_entry_id, type, message)
  values (v_row.student_id, v_row.id, 'called',
          'Ticket ' || v_row.ticket_number || ' has been called. Please go to ' || v_office || ' now.');

  -- warn the student who now has two people ahead of them
  select id, student_id, ticket_number into v_near from queue_entries
  where service_id = p_service_id and queue_date = v_date and status = 'waiting'
  order by seq offset 2 limit 1;
  if found then
    insert into notifications (user_id, queue_entry_id, type, message)
    values (v_near.student_id, v_near.id, 'turn_approaching',
            'Your turn is approaching. Two students are ahead of ticket ' || v_near.ticket_number || '.');
  end if;

  return v_row;
end $$;

create or replace function set_ticket_status(p_id uuid, p_status queue_status) returns void
language plpgsql security definer set search_path = public as $$
declare v queue_entries;
begin
  select * into v from queue_entries where id = p_id for update;
  if not found then raise exception 'Ticket not found'; end if;
  perform assert_can_serve(v.service_id);

  if not (
    (v.status = 'called'     and p_status in ('in_service', 'skipped'))
    or (v.status = 'in_service' and p_status = 'completed')
    or (v.status = 'waiting'    and p_status = 'skipped')
  ) then
    raise exception 'Invalid status change from % to %', v.status, p_status;
  end if;

  update queue_entries set
    status = p_status,
    served_by = auth.uid(),
    started_at = case when p_status = 'in_service' then now() else started_at end,
    completed_at = case when p_status = 'completed' then now() else completed_at end
  where id = p_id;

  if p_status in ('completed', 'skipped') then
    insert into notifications (user_id, queue_entry_id, type, message)
    values (v.student_id, v.id, p_status::text::notification_type,
      case when p_status = 'completed'
           then 'Ticket ' || v.ticket_number || ' is complete. Thank you.'
           else 'Ticket ' || v.ticket_number || ' was skipped. Please join the queue again if you still need service.'
      end);
  end if;
end $$;

-- ---------------------------------------------------------------
-- Sample data (safe to re-run)
-- ---------------------------------------------------------------
insert into offices (name, location) values
  ('Bursary', 'Admin Block, Ground Floor'),
  ('Registry', 'Admin Block, First Floor'),
  ('Admissions Office', 'Senate Building'),
  ('Student Affairs', 'Student Centre'),
  ('Examinations Office', 'Senate Building')
on conflict (name) do nothing;

insert into services (office_id, name, prefix, avg_service_minutes)
select o.id, v.name, v.prefix, v.mins
from (values
  ('Bursary', 'Payment Verification', 'PAY', 8),
  ('Bursary', 'Receipt Collection', 'RCP', 5),
  ('Registry', 'Transcript Request', 'TRN', 12),
  ('Registry', 'Document Collection', 'DOC', 6),
  ('Admissions Office', 'Admission Enquiry', 'ADM', 10),
  ('Student Affairs', 'Clearance', 'CLR', 10),
  ('Examinations Office', 'Result Complaint', 'EXM', 12)
) as v(office, name, prefix, mins)
join offices o on o.name = v.office
on conflict do nothing;
