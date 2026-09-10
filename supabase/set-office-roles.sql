-- set-office-roles.sql
-- Three separate levels, three separate logins.
--
--   admin@school.local      system administrator -- sees both offices
--   registrar@school.local  registrar administrator -- registrar only
--   treasury@school.local   treasury administrator -- treasury only
--
-- Right now both office accounts are flagged is_admin, which is why signing
-- in as the registrar shows treasury's queue: is_admin is what widens the
-- scope to both. This takes that flag off them and puts it on one account
-- that is meant to have it.
--
-- BEFORE RUNNING: create the account in the Supabase dashboard under
-- Authentication -> Users -> Add user, with email admin@school.local and a
-- password you choose. The script refuses to run without it, on purpose --
-- demoting both offices while no system administrator exists would lock
-- everyone out of the Staff accounts page.
--
-- Run 0009_roles_and_assignment.sql first; this needs the `role` column.

do $$
declare
  v_admin uuid;
  v_reg   uuid;
  v_tre   uuid;
begin
  select id into v_admin from auth.users where lower(email) = 'admin@school.local';
  select id into v_reg   from auth.users where lower(email) = 'registrar@school.local';
  select id into v_tre   from auth.users where lower(email) = 'treasury@school.local';

  if v_admin is null then
    raise exception
      'No admin@school.local account. Create it under Authentication -> Users -> Add user, then run this again.';
  end if;

  -- The system administrator. `department` is only their home office; being
  -- is_admin is what lets them see either one.
  insert into staff (user_id, department, role, is_admin)
  values (v_admin, 'registrar', 'head', true)
  on conflict (user_id) do update
    set role = 'head', is_admin = true;

  if v_reg is not null then
    insert into staff (user_id, department, role, is_admin)
    values (v_reg, 'registrar', 'head', false)
    on conflict (user_id) do update
      set department = 'registrar', role = 'head', is_admin = false;
  end if;

  if v_tre is not null then
    insert into staff (user_id, department, role, is_admin)
    values (v_tre, 'treasury', 'head', false)
    on conflict (user_id) do update
      set department = 'treasury', role = 'head', is_admin = false;
  end if;
end $$;

-- What you should see: exactly one row with is_admin = true.
select u.email,
       s.department,
       s.role,
       s.is_admin,
       case
         when s.is_admin        then 'System administrator - both offices'
         when s.role = 'head'   then initcap(s.department::text) || ' administrator'
         else                        initcap(s.department::text) || ' staff'
       end as level
  from staff s
  join auth.users u on u.id = s.user_id
 order by s.is_admin desc, s.department, u.email;
