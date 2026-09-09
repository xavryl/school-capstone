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
