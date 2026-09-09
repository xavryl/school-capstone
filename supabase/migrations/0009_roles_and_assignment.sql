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

do $ begin
  create type staff_role as enum ('staff', 'head');
exception when duplicate_object then null;
end $;

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
