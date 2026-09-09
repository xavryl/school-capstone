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
