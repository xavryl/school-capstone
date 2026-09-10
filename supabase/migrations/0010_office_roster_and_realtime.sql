-- 0010_office_roster_and_realtime.sql
-- Two things an office administrator needs that the schema did not allow yet.
--
--   1. Seeing their own people. The only select policy on `staff` was "your
--      own row", so a head could not list the staff they are supposed to be
--      handing work to -- the assign dropdown came back empty for them.
--   2. Live pages. The console reloads itself when a request, inquiry,
--      appointment or ticket changes, which needs those tables published to
--      Realtime.

-- --------------------------------------------------------- office roster --

-- A head sees the staff of their own office, and nobody else's. The system
-- administrator keeps the wider policy from 0003.
drop policy if exists "heads read office staff" on staff;
create policy "heads read office staff" on staff
  for select using (is_head_of(department));

-- Name and level for everyone in the offices you may manage, in one call.
-- Security definer because it joins profiles to staff, and the caller is not
-- allowed to read the staff table row by row.
create or replace function public.office_roster()
returns table (
  user_id    uuid,
  full_name  text,
  department department,
  role       staff_role,
  is_admin   boolean
)
language sql stable security definer
set search_path = public, pg_temp as $$
  select s.user_id,
         coalesce(p.full_name, ''),
         s.department,
         s.role,
         s.is_admin
    from staff s
    left join profiles p on p.id = s.user_id
   where is_head_of(s.department) or is_admin()
   order by s.is_admin desc, s.role desc, coalesce(p.full_name, '');
$$;

-- ------------------------------------------------------------- realtime --

-- Publishing a table twice is an error, so each is added only if absent.
do $$
declare
  t text;
begin
  foreach t in array array['requests', 'inquiries', 'appointments', 'queue_tickets']
  loop
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- Realtime applies the same policies to a subscriber that a query would, so a
-- registrar administrator is notified about registrar rows and never learns
-- that a treasury row changed.
