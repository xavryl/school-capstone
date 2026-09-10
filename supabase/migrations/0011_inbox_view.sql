-- 0011_inbox_view.sql
-- The inbox as a mail client sees it: one list, newest first, every concern
-- carrying who sent it, who is dealing with it, and whether it is finished.
--
-- The three states the console shows as a coloured dot:
--
--   open      nobody has taken it        green   -- free to pick up
--   catering  somebody is dealing with it yellow -- leave it alone
--   catered   finished                   red     -- nothing left to do
--
-- Recently finished concerns stay in the list for a fortnight so the counter
-- can look up what was already answered instead of asking the person again.

drop function if exists public.my_inbox(boolean);

create or replace function public.office_inbox(p_days int default 14)
returns table (
  kind          text,
  id            uuid,
  reference     text,
  title         text,
  detail        text,
  status        text,
  state         text,
  department    department,
  assigned_to   uuid,
  assigned_name text,
  from_name     text,
  from_email    text,
  created_at    timestamptz
)
language sql stable security definer
set search_path = public, pg_temp as $$
  select
    'request',
    r.id,
    r.reference,
    coalesce(s.name, 'Request'),
    r.details,
    r.status::text,
    case
      when r.status in ('completed', 'cancelled') then 'catered'
      when r.assigned_to is not null              then 'catering'
      else                                             'open'
    end,
    r.department,
    r.assigned_to,
    coalesce(ap.full_name, ''),
    coalesce(nullif(sp.full_name, ''), 'A student'),
    coalesce(su.email, ''),
    r.created_at
  from requests r
  left join services s  on s.id = r.service_id
  left join profiles sp on sp.id = r.student_id
  left join auth.users su on su.id = r.student_id
  left join profiles ap on ap.id = r.assigned_to
  where (is_staff_of(r.department) or is_admin())
    and r.created_at > now() - make_interval(days => greatest(p_days, 1))

  union all

  select
    'inquiry',
    i.id,
    i.reference,
    i.subject,
    i.body,
    i.status::text,
    case
      when i.status in ('closed', 'responded') then 'catered'
      when i.assigned_to is not null           then 'catering'
      else                                          'open'
    end,
    i.department,
    i.assigned_to,
    coalesce(ap.full_name, ''),
    i.name,
    i.email,
    i.created_at
  from inquiries i
  left join profiles ap on ap.id = i.assigned_to
  where (is_staff_of(i.department) or is_admin())
    and i.created_at > now() - make_interval(days => greatest(p_days, 1))

  order by created_at desc;
$$;
