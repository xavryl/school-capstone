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
