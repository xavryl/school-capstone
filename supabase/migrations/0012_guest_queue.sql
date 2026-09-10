-- 0012_guest_queue.sql
-- A queue number without an account.
--
-- Somebody who has walked in and just wants to be seen should not have to
-- register first. They get a number and a place in the same line as everyone
-- else -- the counter cannot tell the difference, and neither can the lobby
-- screen. What they do not get is the things an account is actually for:
-- filing a request, attaching documents, appointments, notifications, and a
-- history to look back at.
--
-- Identity is the ticket id, which is a random uuid the browser keeps. Holding
-- it is what proves the ticket is yours; there is nothing else to steal and
-- nothing about anyone else it can read.

create or replace function public.take_guest_number(
  dept department, p_service bigint default null
)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp as $$
declare t queue_tickets;
begin
  -- A service from the other office would put the wrong name on the counter's
  -- screen, so it is dropped rather than trusted.
  if p_service is not null and not exists (
    select 1 from services
     where id = p_service and department = dept and active
  ) then
    p_service := null;
  end if;

  insert into queue_tickets (number, department, service_id)
  values (next_queue_number(dept), dept, p_service)
  returning * into t;

  return jsonb_build_object(
    'id', t.id,
    'number', t.number,
    'department', t.department,
    'state', t.state
  );
end; $$;

-- Where a guest stands, looked up by the ticket id their browser is holding.
-- Deliberately returns nothing for a ticket that is finished or from an
-- earlier day, so a stale id in localStorage reads as "no number" rather than
-- as yesterday's place in the line.
create or replace function public.guest_queue_position(p_ticket uuid)
returns jsonb language plpgsql stable security definer
set search_path = public, pg_temp as $$
declare t queue_tickets; ahead int;
begin
  select q.* into t
    from queue_tickets q
   where q.id = p_ticket
     and q.service_date = current_date
     and q.state in ('waiting', 'serving');

  if t.id is null then return null; end if;

  select count(*) into ahead
    from queue_tickets
   where department = t.department
     and service_date = current_date
     and state = 'waiting'
     and created_at < t.created_at;

  return jsonb_build_object(
    'id', t.id,
    'number', t.number,
    'department', t.department,
    'state', t.state,
    'ahead', ahead,
    'window', (select label from service_windows where id = t.window_id)
  );
end; $$;

-- Both are reachable without an account; that is the point of them.
grant execute on function public.take_guest_number(department, bigint) to anon, authenticated;
grant execute on function public.guest_queue_position(uuid) to anon, authenticated;
