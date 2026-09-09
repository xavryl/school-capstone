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
