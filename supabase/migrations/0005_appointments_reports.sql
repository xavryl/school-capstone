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
