-- ALL MIGRATIONS, CONCATENATED
-- Paste this whole file into the Supabase SQL editor and run it once.
-- Equivalent to running 0001 through 0009 in order.
-- Safe on a fresh project; re-running it will error on existing policies.

-- ======================================================================
-- 0001_schema.sql
-- ======================================================================

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


-- ======================================================================
-- 0002_functions.sql
-- ======================================================================

-- 0002_functions.sql
-- Every operation that must be atomic, or that a guest performs without an
-- account, lives here rather than in the application.

-- ------------------------------------------------------------- helpers --

-- Random, non-sequential reference token. A guest handed INQ-000431 can read
-- INQ-000430 by editing the URL; a random token removes that entirely.
create or replace function public.make_reference(prefix text)
returns text language sql volatile as $$
  select prefix || '-' || upper(encode(gen_random_bytes(5), 'hex'));
$$;

-- These two are SECURITY DEFINER on purpose. An RLS policy on `requests`
-- that selects from `staff` would otherwise be filtered by `staff`'s own
-- policies, which either blocks the check or recurses. Bypassing RLS inside
-- a definer function is the standard way out.
create or replace function public.is_staff_of(d department)
returns boolean language sql security definer stable
set search_path = public, pg_temp as $$
  select exists (
    select 1 from staff where user_id = auth.uid() and department = d
  );
$$;

create or replace function public.is_admin()
returns boolean language sql security definer stable
set search_path = public, pg_temp as $$
  select exists (select 1 from staff where user_id = auth.uid() and is_admin);
$$;

-- Keep profiles in step with auth.users.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- --------------------------------------------------------------- queue --

-- Daily, per-department numbering: REG-001 and TRE-001 both exist on the same
-- morning, so a global identity column cannot produce these.
--
-- The upsert is the whole point. ON CONFLICT ... DO UPDATE takes a row lock
-- and returns the updated value in one statement, so concurrent callers
-- serialise on the counter row instead of racing. Never derive the number
-- from count(*) -- one cancelled ticket makes counting emit a duplicate.
create or replace function public.next_queue_number(dept department)
returns text language plpgsql security definer
set search_path = public, pg_temp as $$
declare n int;
begin
  insert into queue_counters (department, service_date, last_number)
       values (dept, current_date, 1)
  on conflict (department, service_date)
    do update set last_number = queue_counters.last_number + 1
  returning last_number into n;

  return upper(left(dept::text, 3)) || '-' || lpad(n::text, 3, '0');
end; $$;

-- Issues a ticket and returns the whole row. Callable by a signed-in student
-- (for their own request) or by staff at a walk-in kiosk.
create or replace function public.issue_queue_ticket(
  dept       department,
  p_service  bigint default null,
  p_request  uuid   default null
)
returns queue_tickets language plpgsql security definer
set search_path = public, pg_temp as $$
declare t queue_tickets;
begin
  if auth.uid() is null then
    raise exception 'sign in required';
  end if;

  insert into queue_tickets (number, department, service_id, request_id)
  values (next_queue_number(dept), dept, p_service, p_request)
  returning * into t;

  return t;
end; $$;

-- Marks whoever is currently at this window as completed, then promotes the
-- oldest waiting ticket. Returns the newly-called ticket, or null if the
-- queue is empty.
create or replace function public.call_next(dept department, p_window bigint)
returns queue_tickets language plpgsql security definer
set search_path = public, pg_temp as $$
declare t queue_tickets;
begin
  if not (is_staff_of(dept) or is_admin()) then
    raise exception 'not authorised for %', dept;
  end if;

  update queue_tickets
     set state = 'completed', completed_at = now()
   where department = dept
     and service_date = current_date
     and window_id = p_window
     and state = 'serving';

  update queue_tickets
     set state = 'serving', window_id = p_window, called_at = now()
   where id = (
     select id from queue_tickets
      where department = dept
        and service_date = current_date
        and state = 'waiting'
      order by created_at
      limit 1
      for update skip locked        -- two windows can call at once safely
   )
  returning * into t;

  return t;
end; $$;

create or replace function public.set_ticket_state(p_ticket uuid, p_state queue_state)
returns queue_tickets language plpgsql security definer
set search_path = public, pg_temp as $$
declare t queue_tickets;
begin
  select * into t from queue_tickets where id = p_ticket;
  if t.id is null then raise exception 'no such ticket'; end if;
  if not (is_staff_of(t.department) or is_admin()) then
    raise exception 'not authorised';
  end if;

  update queue_tickets
     set state = p_state,
         completed_at = case when p_state = 'completed' then now() else completed_at end
   where id = p_ticket
  returning * into t;

  return t;
end; $$;

-- What the television shows. Public on purpose: it is already on a wall.
-- The display polls this every ten seconds as a backstop, because a dead
-- WebSocket looks exactly like a quiet morning.
create or replace function public.current_queue_state(dept department)
returns jsonb language sql stable
set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'department', dept,
    'serving', coalesce((
      select jsonb_agg(jsonb_build_object(
               'number', t.number, 'window', w.label, 'called_at', t.called_at)
               order by w.label)
        from queue_tickets t
        join service_windows w on w.id = t.window_id
       where t.department = dept
         and t.service_date = current_date
         and t.state = 'serving'
    ), '[]'::jsonb),
    'waiting', coalesce((
      select jsonb_agg(x.number order by x.created_at)
        from (select number, created_at
                from queue_tickets
               where department = dept
                 and service_date = current_date
                 and state = 'waiting'
               order by created_at
               limit 5) x
    ), '[]'::jsonb),
    'as_of', now()
  );
$$;

-- ------------------------------------------------------------ requests --

create or replace function public.submit_request(
  dept      department,
  p_service bigint,
  p_details text,
  p_email   text,
  p_phone   text default null,
  p_when    timestamptz default null
)
returns requests language plpgsql security definer
set search_path = public, pg_temp as $$
declare r requests;
begin
  if auth.uid() is null then
    raise exception 'sign in required';
  end if;

  insert into requests (reference, student_id, department, service_id,
                        details, contact_email, contact_phone, preferred_at)
  values (make_reference('REQ'), auth.uid(), dept, p_service,
          p_details, p_email, p_phone, p_when)
  returning * into r;

  insert into request_events (request_id, status, note, actor)
  values (r.id, 'submitted', 'Request received', auth.uid());

  return r;
end; $$;

create or replace function public.set_request_status(
  p_request uuid, p_status request_status, p_note text default null
)
returns requests language plpgsql security definer
set search_path = public, pg_temp as $$
declare r requests;
begin
  select * into r from requests where id = p_request;
  if r.id is null then raise exception 'no such request'; end if;
  if not (is_staff_of(r.department) or is_admin()) then
    raise exception 'not authorised';
  end if;

  update requests set status = p_status, updated_at = now()
   where id = p_request returning * into r;

  insert into request_events (request_id, status, note, actor)
  values (p_request, p_status, p_note, auth.uid());

  if r.student_id is not null then
    insert into notifications (user_id, title, body, href)
    values (r.student_id,
            'Request ' || r.reference || ' is now ' || p_status,
            coalesce(p_note, ''),
            '/track/' || r.reference);
  end if;

  return r;
end; $$;

-- ----------------------------------------------------------- inquiries --

-- Guests never touch a table directly. This runs as the definer, so the
-- anon role needs no insert privilege on `inquiries` at all.
create or replace function public.submit_inquiry(
  dept      department,
  p_name    text,
  p_email   text,
  p_subject text,
  p_body    text
)
returns text language plpgsql security definer
set search_path = public, pg_temp as $$
declare ref text;
begin
  if length(coalesce(p_name, '')) = 0 or length(coalesce(p_body, '')) = 0 then
    raise exception 'name and message are required';
  end if;

  insert into inquiries (reference, department, name, email, subject, body)
  values (make_reference('INQ'), dept, p_name, p_email,
          coalesce(nullif(p_subject, ''), 'General inquiry'), p_body)
  returning reference into ref;

  return ref;
end; $$;

create or replace function public.respond_to_inquiry(p_id uuid, p_response text)
returns inquiries language plpgsql security definer
set search_path = public, pg_temp as $$
declare i inquiries;
begin
  select * into i from inquiries where id = p_id;
  if i.id is null then raise exception 'no such inquiry'; end if;
  if not (is_staff_of(i.department) or is_admin()) then
    raise exception 'not authorised';
  end if;

  update inquiries
     set response = p_response, status = 'responded',
         responded_at = now(), assigned_to = auth.uid()
   where id = p_id returning * into i;

  return i;
end; $$;

-- ------------------------------------------------------------ tracking --

-- One lookup for both pipelines, keyed on the reference token. Definer so a
-- signed-out guest can read exactly one record and nothing around it.
create or replace function public.track(p_reference text)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp as $$
declare r requests; i inquiries; result jsonb;
begin
  select * into r from requests where reference = upper(p_reference);
  if r.id is not null then
    select jsonb_build_object(
      'kind', 'request',
      'reference', r.reference,
      'department', r.department,
      'status', r.status,
      'service', (select name from services where id = r.service_id),
      'created_at', r.created_at,
      'timeline', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'status', e.status, 'note', e.note, 'at', e.created_at)
                 order by e.created_at)
          from request_events e where e.request_id = r.id), '[]'::jsonb)
    ) into result;
    return result;
  end if;

  select * into i from inquiries where reference = upper(p_reference);
  if i.id is not null then
    return jsonb_build_object(
      'kind', 'inquiry',
      'reference', i.reference,
      'department', i.department,
      'status', i.status,
      'subject', i.subject,
      'response', i.response,
      'created_at', i.created_at,
      'responded_at', i.responded_at
    );
  end if;

  return null;
end; $$;

-- Guests are unauthenticated, so the anon role needs execute on exactly
-- these three and nothing else.
grant execute on function public.submit_inquiry(department, text, text, text, text) to anon;
grant execute on function public.track(text) to anon;
grant execute on function public.current_queue_state(department) to anon;


-- ======================================================================
-- 0003_rls.sql
-- ======================================================================

-- 0003_rls.sql
-- On this stack the browser talks to Postgres directly, so hiding a button is
-- not access control. A table with RLS left off is readable by anyone holding
-- the anon key -- which is everyone, because it ships in the JS bundle.
--
-- After running this, open Database -> Advisors in the Supabase dashboard and
-- confirm there are no "RLS disabled in public" warnings before you publish
-- the URL.

alter table profiles        enable row level security;
alter table staff           enable row level security;
alter table services        enable row level security;
alter table service_windows enable row level security;
alter table requests        enable row level security;
alter table request_events  enable row level security;
alter table appointments    enable row level security;
alter table queue_counters  enable row level security;
alter table queue_tickets   enable row level security;
alter table inquiries       enable row level security;
alter table notifications   enable row level security;

-- ------------------------------------------------------------- profiles --

create policy "read own profile" on profiles
  for select using (auth.uid() = id);

create policy "staff read profiles" on profiles
  for select using (is_staff_of('registrar') or is_staff_of('treasury'));

create policy "update own profile" on profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- ---------------------------------------------------------------- staff --

create policy "read own staff row" on staff
  for select using (auth.uid() = user_id);

create policy "admins manage staff" on staff
  for all using (is_admin()) with check (is_admin());

-- ------------------------------------------------------------ catalogue --

-- The request form has to render before anyone signs in.
create policy "services are public" on services
  for select using (true);

create policy "windows are public" on service_windows
  for select using (true);

create policy "admins manage services" on services
  for all using (is_admin()) with check (is_admin());

create policy "admins manage windows" on service_windows
  for all using (is_admin()) with check (is_admin());

-- ------------------------------------------------------------- requests --

create policy "students read own requests" on requests
  for select using (auth.uid() = student_id);

create policy "staff read department requests" on requests
  for select using (is_staff_of(department));

create policy "staff update department requests" on requests
  for update using (is_staff_of(department)) with check (is_staff_of(department));

-- Inserts go through submit_request(), which stamps student_id from
-- auth.uid(). This policy exists so a direct insert cannot forge one.
create policy "students file own requests" on requests
  for insert with check (auth.uid() = student_id);

create policy "read own request events" on request_events
  for select using (
    exists (select 1 from requests r
             where r.id = request_events.request_id
               and (r.student_id = auth.uid() or is_staff_of(r.department)))
  );

-- --------------------------------------------------------- appointments --

create policy "students read own appointments" on appointments
  for select using (auth.uid() = student_id);

create policy "staff read department appointments" on appointments
  for select using (
    exists (select 1 from service_windows w
             where w.id = appointments.window_id and is_staff_of(w.department))
  );

create policy "students book own appointments" on appointments
  for insert with check (auth.uid() = student_id);

create policy "students cancel own appointments" on appointments
  for update using (auth.uid() = student_id) with check (auth.uid() = student_id);

create policy "staff manage department appointments" on appointments
  for all using (
    exists (select 1 from service_windows w
             where w.id = appointments.window_id and is_staff_of(w.department))
  ) with check (
    exists (select 1 from service_windows w
             where w.id = appointments.window_id and is_staff_of(w.department))
  );

-- ---------------------------------------------------------------- queue --

-- Tickets carry a number, a department and a window. They are already
-- displayed on a wall in a public lobby, so public read is honest rather
-- than lax. Nothing personal is stored on the row.
create policy "queue is public" on queue_tickets
  for select using (true);

create policy "staff manage queue" on queue_tickets
  for all using (is_staff_of(department)) with check (is_staff_of(department));

-- Counters are an implementation detail; only the definer functions touch them.
create policy "admins read counters" on queue_counters
  for select using (is_admin());

-- ------------------------------------------------------------ inquiries --

-- Deliberately no public select. Guests read exactly one row through
-- track(), which is security definer and keyed on a random token.
create policy "staff read department inquiries" on inquiries
  for select using (is_staff_of(department));

create policy "staff update department inquiries" on inquiries
  for update using (is_staff_of(department)) with check (is_staff_of(department));

-- -------------------------------------------------------- notifications --

create policy "read own notifications" on notifications
  for select using (auth.uid() = user_id);

create policy "mark own notifications read" on notifications
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- ======================================================================
-- 0004_seed.sql
-- ======================================================================

-- 0004_seed.sql
-- Services and windows taken from the proposal. Safe to re-run.

insert into services (department, name, description) values
  ('registrar', 'Certificate request',        'Good moral, enrollment, graduation and similar certifications'),
  ('registrar', 'Transcript of records',      'Official transcript for board exams, transfer or employment'),
  ('registrar', 'Document inquiry',           'Questions about a document already filed or released'),
  ('registrar', 'Enrollment verification',    'Confirmation of enrollment status for third parties'),
  ('registrar', 'Other registrar service',    'Anything not covered above'),
  ('treasury',  'Payment inquiry',            'Questions about a payment already made'),
  ('treasury',  'Assessment or billing',      'Concerns about an assessment, balance or billing statement'),
  ('treasury',  'Official receipt',           'Reissue, correction or copy of an official receipt'),
  ('treasury',  'Other treasury service',     'Anything not covered above')
on conflict do nothing;

insert into service_windows (department, label) values
  ('registrar', 'Window 1'),
  ('registrar', 'Window 2'),
  ('treasury',  'Window 3'),
  ('treasury',  'Window 4')
on conflict do nothing;

-- Promote yourself to staff after signing up, replacing the email below:
--
--   insert into staff (user_id, department, is_admin)
--   select id, 'registrar', true from auth.users where email = 'you@example.com'
--   on conflict (user_id) do update
--     set department = excluded.department, is_admin = excluded.is_admin;


-- ======================================================================
-- 0005_appointments_reports.sql
-- ======================================================================

-- 0005_appointments_reports.sql
-- Appointment booking, inquiry workflow, and the reporting functions.

-- --------------------------------------------------------- appointments --

-- Office hours as data rather than as a hardcoded array in TypeScript:
-- 08:00-16:30 Manila time, half-hour slots, lunch hour excluded.
create or replace function public.available_slots(dept department, p_day date)
returns table (
  window_id    bigint,
  window_label text,
  starts_at    timestamptz,
  ends_at      timestamptz,
  taken        boolean
)
language sql stable
set search_path = public, pg_temp as $$
  with slots as (
    select w.id  as window_id,
           w.label as window_label,
           s       as starts_at,
           s + interval '30 minutes' as ends_at
      from service_windows w
      cross join generate_series(
             ((p_day + time '08:00') at time zone 'Asia/Manila'),
             ((p_day + time '16:30') at time zone 'Asia/Manila'),
             interval '30 minutes') as s
     where w.department = dept and w.active
  )
  select sl.window_id, sl.window_label, sl.starts_at, sl.ends_at,
         exists (
           select 1 from appointments a
            where a.window_id = sl.window_id
              and a.status <> 'cancelled'
              and tstzrange(a.starts_at, a.ends_at) && tstzrange(sl.starts_at, sl.ends_at)
         ) as taken
    from slots sl
   where extract(hour from (sl.starts_at at time zone 'Asia/Manila')) <> 12
   order by sl.window_label, sl.starts_at;
$$;

-- The booking path. Note there is no "is this slot free?" check here on
-- purpose: two requests would both read free and both insert. The exclusion
-- constraint from 0001 is what actually decides, and we translate its error
-- into something a student can act on.
create or replace function public.book_appointment(
  p_window bigint, p_start timestamptz, p_request uuid default null
)
returns appointments language plpgsql security definer
set search_path = public, pg_temp as $$
declare a appointments;
begin
  if auth.uid() is null then
    raise exception 'sign in required';
  end if;

  insert into appointments (request_id, student_id, window_id, starts_at, ends_at)
  values (p_request, auth.uid(), p_window, p_start, p_start + interval '30 minutes')
  returning * into a;

  insert into notifications (user_id, title, body, href)
  values (auth.uid(),
          'Appointment confirmed',
          to_char(a.starts_at at time zone 'Asia/Manila', 'FMMon FMDD, FMHH12:MI AM'),
          '/appointments');

  return a;
exception
  when exclusion_violation then
    raise exception 'That slot was just taken. Please choose another time.';
end; $$;

create or replace function public.cancel_appointment(p_id uuid)
returns appointments language plpgsql security definer
set search_path = public, pg_temp as $$
declare a appointments; d department;
begin
  select * into a from appointments where id = p_id;
  if a.id is null then raise exception 'no such appointment'; end if;

  select w.department into d from service_windows w where w.id = a.window_id;

  if a.student_id <> auth.uid() and not (is_staff_of(d) or is_admin()) then
    raise exception 'not authorised';
  end if;

  update appointments set status = 'cancelled' where id = p_id returning * into a;
  return a;
end; $$;

create or replace function public.set_appointment_status(
  p_id uuid, p_status appointment_status
)
returns appointments language plpgsql security definer
set search_path = public, pg_temp as $$
declare a appointments; d department;
begin
  select * into a from appointments where id = p_id;
  if a.id is null then raise exception 'no such appointment'; end if;

  select w.department into d from service_windows w where w.id = a.window_id;
  if not (is_staff_of(d) or is_admin()) then raise exception 'not authorised'; end if;

  update appointments set status = p_status where id = p_id returning * into a;
  return a;
end; $$;

-- ------------------------------------------------------------ inquiries --

create or replace function public.set_inquiry_status(p_id uuid, p_status inquiry_status)
returns inquiries language plpgsql security definer
set search_path = public, pg_temp as $$
declare i inquiries;
begin
  select * into i from inquiries where id = p_id;
  if i.id is null then raise exception 'no such inquiry'; end if;
  if not (is_staff_of(i.department) or is_admin()) then
    raise exception 'not authorised';
  end if;

  update inquiries
     set status = p_status,
         assigned_to = case when p_status = 'assigned' then auth.uid() else assigned_to end
   where id = p_id returning * into i;

  return i;
end; $$;

-- -------------------------------------------------------------- reports --

-- Definer functions, so the guard has to be explicit. Without these two
-- lines a signed-in student could read the whole department's figures.
create or replace function public.report_summary(dept department, p_from date, p_to date)
returns jsonb language plpgsql stable security definer
set search_path = public, pg_temp as $$
begin
  if not (is_staff_of(dept) or is_admin()) then raise exception 'not authorised'; end if;

  return (select jsonb_build_object(
    'requests_total', (select count(*) from requests
       where department = dept and created_at::date between p_from and p_to),
    'requests_completed', (select count(*) from requests
       where department = dept and status = 'completed'
         and created_at::date between p_from and p_to),
    'requests_open', (select count(*) from requests
       where department = dept and status not in ('completed', 'cancelled')
         and created_at::date between p_from and p_to),
    'appointments', (select count(*) from appointments a
       join service_windows w on w.id = a.window_id
      where w.department = dept and a.status <> 'cancelled'
        and (a.starts_at at time zone 'Asia/Manila')::date between p_from and p_to),
    'tickets', (select count(*) from queue_tickets
       where department = dept and service_date between p_from and p_to),
    'tickets_served', (select count(*) from queue_tickets
       where department = dept and state = 'completed'
         and service_date between p_from and p_to),
    'tickets_skipped', (select count(*) from queue_tickets
       where department = dept and state = 'skipped'
         and service_date between p_from and p_to),
    'avg_wait_minutes', (select round(
         avg(extract(epoch from (called_at - created_at)) / 60)::numeric, 1)
       from queue_tickets
      where department = dept and called_at is not null
        and service_date between p_from and p_to),
    'inquiries', (select count(*) from inquiries
       where department = dept and created_at::date between p_from and p_to),
    'inquiries_closed', (select count(*) from inquiries
       where department = dept and status = 'closed'
         and created_at::date between p_from and p_to)
  ));
end; $$;

-- One row per calendar day in the range, including days with no activity --
-- generate_series rather than group-by, so the chart has no gaps to guess at.
create or replace function public.report_daily(dept department, p_from date, p_to date)
returns table (day date, filed bigint, completed bigint, tickets bigint)
language plpgsql stable security definer
set search_path = public, pg_temp as $$
begin
  if not (is_staff_of(dept) or is_admin()) then raise exception 'not authorised'; end if;

  return query
    select d::date,
      (select count(*) from requests r
        where r.department = dept and r.created_at::date = d::date),
      (select count(*) from request_events e
         join requests r on r.id = e.request_id
        where r.department = dept and e.status = 'completed'
          and e.created_at::date = d::date),
      (select count(*) from queue_tickets t
        where t.department = dept and t.service_date = d::date)
      from generate_series(p_from, p_to, interval '1 day') d;
end; $$;


-- ======================================================================
-- 0006_attachments_kiosk_announcements.sql
-- ======================================================================

-- 0006_attachments_kiosk_announcements.sql
-- Closes the remaining gaps against the proposal: supporting documents,
-- walk-in ticket issuance, queue announcements, and reminder scheduling.

-- ----------------------------------------------------- supporting files --

insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict (id) do nothing;

create table if not exists request_attachments (
  id          bigint generated always as identity primary key,
  request_id  uuid not null references requests on delete cascade,
  path        text not null,
  filename    text not null,
  size_bytes  bigint not null default 0,
  uploaded_by uuid references auth.users on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists request_attachments_request_idx
  on request_attachments (request_id);

alter table request_attachments enable row level security;

create policy "read own or department attachments" on request_attachments
  for select using (
    exists (select 1 from requests r
             where r.id = request_attachments.request_id
               and (r.student_id = auth.uid() or is_staff_of(r.department)))
  );

create policy "attach to own request" on request_attachments
  for insert with check (
    exists (select 1 from requests r
             where r.id = request_attachments.request_id
               and r.student_id = auth.uid())
  );

-- Files live under <user-id>/<request-id>/<filename>, so the first path
-- segment is the owner and these policies need no join back to requests.
create policy "upload own attachments" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "read own attachments" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "staff read all attachments" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'attachments'
    and (is_staff_of('registrar') or is_staff_of('treasury') or is_admin())
  );

create or replace function public.attach_to_request(
  p_request uuid, p_path text, p_name text, p_size bigint
)
returns request_attachments language plpgsql security definer
set search_path = public, pg_temp as $$
declare a request_attachments; r requests;
begin
  select * into r from requests where id = p_request;
  if r.id is null then raise exception 'no such request'; end if;
  if r.student_id <> auth.uid() then raise exception 'not your request'; end if;

  insert into request_attachments (request_id, path, filename, size_bytes, uploaded_by)
  values (p_request, p_path, p_name, p_size, auth.uid())
  returning * into a;

  return a;
end; $$;

-- ------------------------------------------------------- queue tickets --

-- A ticket needs its own owner. Deriving it by joining through requests
-- would lose every walk-in number, which is most of them: taking a number
-- at the counter does not require having filed a request first.
alter table queue_tickets
  add column if not exists student_id uuid references auth.users on delete set null;

create index if not exists queue_tickets_student_idx
  on queue_tickets (student_id, service_date);

-- The student-facing path. Refuses a second live ticket in the same
-- department on the same day, which is what stops one person taking five
-- numbers "to be safe" and stretching everyone else's wait.
create or replace function public.take_queue_number(
  dept department, p_service bigint default null, p_request uuid default null
)
returns queue_tickets language plpgsql security definer
set search_path = public, pg_temp as $$
declare t queue_tickets;
begin
  if auth.uid() is null then
    raise exception 'sign in required';
  end if;

  if exists (
    select 1 from queue_tickets q
     where q.department = dept
       and q.service_date = current_date
       and q.state in ('waiting', 'serving')
       and q.student_id = auth.uid()
  ) then
    raise exception 'You already hold a number in this queue today.';
  end if;

  insert into queue_tickets (number, department, service_id, request_id, student_id)
  values (next_queue_number(dept), dept, p_service, p_request, auth.uid())
  returning * into t;

  insert into notifications (user_id, title, body, href)
  values (auth.uid(), 'Queue number ' || t.number,
          'Watch the lobby screen. You will be called to a window.',
          '/queue');

  return t;
end; $$;

-- The counter-facing path for someone who walked in without an account.
create or replace function public.issue_walkin_ticket(
  dept department, p_service bigint default null
)
returns queue_tickets language plpgsql security definer
set search_path = public, pg_temp as $$
declare t queue_tickets;
begin
  if not (is_staff_of(dept) or is_admin()) then
    raise exception 'not authorised for %', dept;
  end if;

  insert into queue_tickets (number, department, service_id)
  values (next_queue_number(dept), dept, p_service)
  returning * into t;

  return t;
end; $$;

-- Where a student stands right now, and how many are ahead of them.
create or replace function public.my_queue_position(dept department)
returns jsonb language plpgsql stable security definer
set search_path = public, pg_temp as $$
declare t queue_tickets; ahead int;
begin
  select q.* into t
    from queue_tickets q
   where q.department = dept
     and q.service_date = current_date
     and q.state in ('waiting', 'serving')
     and q.student_id = auth.uid()
   order by q.created_at
   limit 1;

  if t.id is null then return null; end if;

  select count(*) into ahead
    from queue_tickets
   where department = dept
     and service_date = current_date
     and state = 'waiting'
     and created_at < t.created_at;

  return jsonb_build_object(
    'number', t.number,
    'state', t.state,
    'ahead', ahead,
    'window', (select label from service_windows where id = t.window_id)
  );
end; $$;

-- ------------------------------------------------------- announcements --

create table if not exists queue_announcements (
  id         bigint generated always as identity primary key,
  department department not null,
  message    text not null,
  active     boolean not null default true,
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now()
);

alter table queue_announcements enable row level security;

-- Shown on a screen in a public lobby, so public read is the honest setting.
create policy "announcements are public" on queue_announcements
  for select using (true);

create policy "staff manage announcements" on queue_announcements
  for all using (is_staff_of(department)) with check (is_staff_of(department));

create or replace function public.post_announcement(dept department, p_message text)
returns queue_announcements language plpgsql security definer
set search_path = public, pg_temp as $$
declare a queue_announcements;
begin
  if not (is_staff_of(dept) or is_admin()) then raise exception 'not authorised'; end if;

  update queue_announcements set active = false
   where department = dept and active;

  if length(trim(coalesce(p_message, ''))) = 0 then
    return null;   -- empty message just clears the banner
  end if;

  insert into queue_announcements (department, message, created_by)
  values (dept, trim(p_message), auth.uid())
  returning * into a;

  return a;
end; $$;

-- current_queue_state gains the banner, so the television needs no second
-- request and the polling backstop keeps announcements fresh too.
create or replace function public.current_queue_state(dept department)
returns jsonb language sql stable
set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'department', dept,
    'serving', coalesce((
      select jsonb_agg(jsonb_build_object(
               'number', t.number, 'window', w.label, 'called_at', t.called_at)
               order by w.label)
        from queue_tickets t
        join service_windows w on w.id = t.window_id
       where t.department = dept
         and t.service_date = current_date
         and t.state = 'serving'
    ), '[]'::jsonb),
    'waiting', coalesce((
      select jsonb_agg(x.number order by x.created_at)
        from (select number, created_at
                from queue_tickets
               where department = dept
                 and service_date = current_date
                 and state = 'waiting'
               order by created_at
               limit 5) x
    ), '[]'::jsonb),
    'announcement', (
      select message from queue_announcements
       where department = dept and active
       order by created_at desc limit 1
    ),
    'as_of', now()
  );
$$;

grant execute on function public.current_queue_state(department) to anon;

-- --------------------------------------------------- reminder scheduling --

-- Writes an in-app notification for every appointment starting tomorrow.
-- Idempotent: re-running it does not double-notify.
create or replace function public.queue_appointment_reminders()
returns int language plpgsql security definer
set search_path = public, pg_temp as $$
declare n int := 0;
begin
  insert into notifications (user_id, title, body, href)
  select a.student_id,
         'Appointment tomorrow',
         to_char(a.starts_at at time zone 'Asia/Manila', 'FMHH12:MI AM')
           || ' at ' || w.label,
         '/appointments'
    from appointments a
    join service_windows w on w.id = a.window_id
   where a.status = 'booked'
     and a.student_id is not null
     and (a.starts_at at time zone 'Asia/Manila')::date
         = ((now() at time zone 'Asia/Manila')::date + 1)
     and not exists (
       select 1 from notifications x
        where x.user_id = a.student_id
          and x.title = 'Appointment tomorrow'
          and x.created_at > now() - interval '20 hours'
     );

  get diagnostics n = row_count;
  return n;
end; $$;

-- Enable the nightly run. pg_cron rather than Vercel Cron: the free Vercel
-- plan allows two jobs at once-daily granularity, and this wants to sit next
-- to the data anyway.
--
--   create extension if not exists pg_cron;
--   select cron.schedule(
--     'appointment-reminders', '0 10 * * *',        -- 18:00 Manila
--     $job$ select public.queue_appointment_reminders(); $job$
--   );
--
-- And the keep-alive that stops Supabase pausing a free project after seven
-- idle days -- the failure that eats defense demos:
--
--   select cron.schedule(
--     'keep-alive', '0 3 * * *',
--     $job$ select count(*) from services; $job$
--   );

-- ------------------------------------------------- admin cross-department --

-- is_staff_of() is department-scoped, so an administrator attached to the
-- registrar could not read treasury rows -- which broke the proposal's
-- separate "registrar transactions" and "treasury transactions" reports.
-- These add the administrator to each read path without widening staff.

create policy "admins read all requests" on requests
  for select using (is_admin());

create policy "admins read all inquiries" on inquiries
  for select using (is_admin());

create policy "admins read all appointments" on appointments
  for select using (is_admin());

create policy "admins read all attachments" on request_attachments
  for select using (is_admin());


-- ======================================================================
-- 0007_profile_media.sql
-- ======================================================================

-- 0007_profile_media.sql
-- Profile pictures, banners, and the rest of the fields a person expects to
-- be able to set about themselves.

-- ------------------------------------------------------- profile fields --

alter table profiles
  add column if not exists avatar_path    text,
  add column if not exists banner_path    text,
  add column if not exists bio            text,
  add column if not exists program        text,
  add column if not exists year_level     text,
  add column if not exists contact_number text,
  add column if not exists updated_at     timestamptz not null default now();

-- ------------------------------------------------------- media storage --

-- Public read, unlike the attachments bucket. An avatar is rendered in the
-- nav on every page load; minting a signed URL each time would add a round
-- trip to every render for an image that is not sensitive. Writes are still
-- restricted to the owner's own folder.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

create policy "upload own profile media" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "replace own profile media" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "remove own profile media" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Keep updated_at honest without the client having to remember.
create or replace function public.touch_profile()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

drop trigger if exists profiles_touch on profiles;
create trigger profiles_touch
  before update on profiles
  for each row execute function public.touch_profile();


-- ======================================================================
-- 0009_roles_and_assignment.sql
-- ======================================================================

-- 0009_roles_and_assignment.sql
-- Two levels inside each office, and a way to hand work to a person.
--
--   role = 'staff'   counter staff. Works the concerns assigned to them and
--                    can claim anything unclaimed in their own office.
--   role = 'head'    office administrator -- the registrar admin, the
--                    treasury admin. Sees everything in their office, hands
--                    work out, and runs its reports.
--   is_admin = true  system administrator, spanning both offices. Unchanged.
--
-- A head is not a system admin: the registrar's head runs the registrar and
-- has no business in treasury records.

do $$ begin
  create type staff_role as enum ('staff', 'head');
exception when duplicate_object then null;
end $$;

alter table staff
  add column if not exists role staff_role not null default 'staff';

-- Anyone who was already flagged as a system admin was, in practice, running
-- their office too.
update staff set role = 'head' where is_admin;

-- ------------------------------------------------------------ assignment --

alter table requests
  add column if not exists assigned_to uuid references auth.users on delete set null;

create index if not exists requests_assigned_idx on requests (assigned_to);
create index if not exists inquiries_assigned_idx on inquiries (assigned_to);

create or replace function public.is_head_of(d department)
returns boolean language sql security definer stable
set search_path = public, pg_temp as $$
  select exists (
    select 1 from staff
     where user_id = auth.uid()
       and department = d
       and (role = 'head' or is_admin)
  );
$$;

-- --------------------------------------------------------------- claiming --

-- Taking an unclaimed concern. Deliberately refuses to steal one that
-- somebody else already holds: reassignment is a head's decision, not a
-- race between two people at two windows.
create or replace function public.claim_request(p_request uuid)
returns requests language plpgsql security definer
set search_path = public, pg_temp as $$
declare r requests;
begin
  select * into r from requests where id = p_request;
  if r.id is null then raise exception 'no such request'; end if;
  if not (is_staff_of(r.department) or is_admin()) then
    raise exception 'not your office';
  end if;
  if r.assigned_to is not null and r.assigned_to <> auth.uid() then
    raise exception 'Somebody else is already handling this one.';
  end if;

  update requests set assigned_to = auth.uid(), updated_at = now()
   where id = p_request returning * into r;
  return r;
end; $$;

create or replace function public.claim_inquiry(p_id uuid)
returns inquiries language plpgsql security definer
set search_path = public, pg_temp as $$
declare i inquiries;
begin
  select * into i from inquiries where id = p_id;
  if i.id is null then raise exception 'no such inquiry'; end if;
  if not (is_staff_of(i.department) or is_admin()) then
    raise exception 'not your office';
  end if;
  if i.assigned_to is not null and i.assigned_to <> auth.uid() then
    raise exception 'Somebody else is already handling this one.';
  end if;

  update inquiries
     set assigned_to = auth.uid(),
         status = case when status = 'submitted' then 'assigned' else status end
   where id = p_id returning * into i;
  return i;
end; $$;

-- ------------------------------------------------------------- assigning --

-- Handing work to someone else. A head does the handing out; anybody may
-- put back a concern they are holding themselves, which is how the 'Put
-- back' button releases one without needing a head.
create or replace function public.assign_request(p_request uuid, p_user uuid)
returns requests language plpgsql security definer
set search_path = public, pg_temp as $$
declare r requests;
begin
  select * into r from requests where id = p_request;
  if r.id is null then raise exception 'no such request'; end if;
  if not (
    is_head_of(r.department) or is_admin()
    or (p_user is null and r.assigned_to = auth.uid())
  ) then
    raise exception 'only an office head can hand work out';
  end if;
  if p_user is not null and not exists (
    select 1 from staff where user_id = p_user and department = r.department
  ) then
    raise exception 'that person does not work in this office';
  end if;

  update requests set assigned_to = p_user, updated_at = now()
   where id = p_request returning * into r;

  if p_user is not null then
    insert into notifications (user_id, title, body, href)
    values (p_user, 'Request ' || r.reference || ' assigned to you',
            left(r.details, 120), '/staff/inbox');
  end if;

  return r;
end; $$;

create or replace function public.assign_inquiry(p_id uuid, p_user uuid)
returns inquiries language plpgsql security definer
set search_path = public, pg_temp as $$
declare i inquiries;
begin
  select * into i from inquiries where id = p_id;
  if i.id is null then raise exception 'no such inquiry'; end if;
  if not (
    is_head_of(i.department) or is_admin()
    or (p_user is null and i.assigned_to = auth.uid())
  ) then
    raise exception 'only an office head can hand work out';
  end if;
  if p_user is not null and not exists (
    select 1 from staff where user_id = p_user and department = i.department
  ) then
    raise exception 'that person does not work in this office';
  end if;

  update inquiries
     set assigned_to = p_user,
         status = case
                    when p_user is not null and status = 'submitted' then 'assigned'
                    else status
                  end
   where id = p_id returning * into i;

  if p_user is not null then
    insert into notifications (user_id, title, body, href)
    values (p_user, 'Inquiry ' || i.reference || ' assigned to you',
            i.subject, '/staff/inbox');
  end if;

  return i;
end; $$;

-- ------------------------------------------------------------- the inbox --

-- One list of concerns for one person: requests and inquiries together,
-- because at a counter they are the same job. `mine` separates what is on
-- you from what is still going spare.
create or replace function public.my_inbox(p_mine boolean default true)
returns table (
  kind text,
  id uuid,
  reference text,
  title text,
  detail text,
  status text,
  department department,
  assigned_to uuid,
  created_at timestamptz
)
language sql stable security definer
set search_path = public, pg_temp as $$
  with mine as (select auth.uid() as uid)
  select 'request', r.id, r.reference,
         coalesce(s.name, 'Request'), r.details, r.status::text,
         r.department, r.assigned_to, r.created_at
    from requests r
    left join services s on s.id = r.service_id, mine
   where r.status not in ('completed', 'cancelled')
     and (is_staff_of(r.department) or is_admin())
     and (case when p_mine then r.assigned_to = mine.uid
               else r.assigned_to is null end)

  union all

  select 'inquiry', i.id, i.reference,
         i.subject, i.body, i.status::text,
         i.department, i.assigned_to, i.created_at
    from inquiries i, mine
   where i.status <> 'closed'
     and (is_staff_of(i.department) or is_admin())
     and (case when p_mine then i.assigned_to = mine.uid
               else i.assigned_to is null end)

   order by created_at;
$$;
