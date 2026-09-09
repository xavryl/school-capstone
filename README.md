# Registrar & Treasury One-Stop Service System

Online transaction requests, appointment booking, walk-in queueing with a lobby
display, and guest inquiries for the registrar and treasury offices.

Built on the zero-budget stack: **Next.js + Supabase + Vercel**, all free tiers.

---

## Setup

### 1. Create the Supabase project

Sign up at [supabase.com](https://supabase.com), create a project, and pick the
region closest to you.

### 2. Run the migrations

Open **SQL Editor** in the Supabase dashboard and run these six files in order.
Order matters — later files reference earlier ones.

| File | What it creates |
|---|---|
| `0001_schema.sql` | Tables, enums, and the appointment exclusion constraint |
| `0002_functions.sql` | Queue numbering, guest inquiry, tracking, status transitions |
| `0003_rls.sql` | Row level security policies on every table |
| `0004_seed.sql` | The nine services and four windows from the proposal |
| `0005_appointments_reports.sql` | Slot generation, booking, inquiry workflow, report queries |
| `0006_attachments_kiosk_announcements.sql` | Document storage, queue issuance, announcements, reminders |

The last file also contains the two `pg_cron` schedules — appointment reminders
and the keep-alive — commented out at the bottom. Uncomment and run them once
your project is live.

### 3. Configure the environment

**`.env.local` already exists** with placeholders and comments — just open it
and paste your three values from **Project Settings → API**. Restart
`npm run dev` afterwards; Next.js reads that file at startup.

The service role key must stay in the *unprefixed* variable. Anything named
`NEXT_PUBLIC_*` is compiled into the browser bundle.

Email is optional. Leave `BREVO_API_KEY` blank and `sendMail()` logs what it
would have sent instead of failing, so nothing breaks before you set it up.

### 4. Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000.

### 5. Make yourself staff

Sign up through `/login`, then run this in the SQL editor with your email:

```sql
insert into staff (user_id, department, is_admin)
select id, 'registrar', true from auth.users where email = 'you@example.com'
on conflict (user_id) do update
  set department = excluded.department, is_admin = excluded.is_admin;
```

Reload `/staff` and the console appears.

---

## Routes

| Route | Who | What |
|---|---|---|
| `/` | Anyone | Landing, department selection |
| `/login` | Students, staff | Sign in and sign up |
| `/request` | Students | File a request, attaching supporting documents |
| `/queue` | Students | Take a queue number and watch your position live |
| `/appointments` | Students | Book a half-hour window slot, cancel bookings |
| `/inquiry` | Guests | Send an inquiry without an account |
| `/track`, `/track/[reference]` | Anyone with a reference | Status and history |
| `/profile` | Signed-in users | Name, student number, secure sign-out |
| `/notifications` | Signed-in users | Every status change, with an unread badge in the nav |
| `/display/registrar`, `/display/treasury` | Lobby TV | Full-screen queue display |
| `/staff` | Registrar/treasury staff | Queue console, walk-in tickets, announcements, appointments, requests, inquiry replies |
| `/staff/reports` | Staff | Summary tiles, daily chart, CSV export; admins switch department |

Open a display route full-screen (F11) on the television. It needs no sign-in.

---

## How the tricky parts work

**Appointments cannot double-book.** `0001_schema.sql` puts an `EXCLUDE USING
gist` constraint on `appointments`, so two overlapping bookings at the same
window are refused by Postgres itself. A check-then-insert in application code
loses that race; the database cannot.

**Queue numbers are atomic.** `next_queue_number()` upserts a per-department,
per-day counter row with `ON CONFLICT ... DO UPDATE`, which takes a row lock and
returns the new value in one statement. Numbers are never derived from
`count(*)` — one cancelled ticket would make that emit a duplicate.

**Two staff can call at once.** `call_next()` selects the oldest waiting ticket
`FOR UPDATE SKIP LOCKED`, so windows 1 and 2 pressing *Call next* simultaneously
get different people rather than deadlocking or both getting the same one.

**The display survives a dead socket.** `DisplayClient.tsx` subscribes to a
Supabase broadcast channel as the primary path *and* polls `current_queue_state`
every ten seconds. A WebSocket that dies silently looks exactly like a quiet
morning, so the screen repairs itself. The last snapshot is cached in
`localStorage`, so an internet outage freezes the screen on a real number
instead of showing an error page to a lobby full of people.

**Announcements use no audio files.** The browser's built-in `SpeechSynthesis`
reads the call aloud.

**Guests never touch a table.** `submit_inquiry()` and `track()` are
`SECURITY DEFINER`, and the anon role has `EXECUTE` on exactly those two plus
`current_queue_state`. Reference tokens are random (`INQ-9F3A2B7C1D`), not
sequential — a guest cannot read someone else's inquiry by decrementing a number.

**Policies avoid recursion.** An RLS policy on `requests` that selects from
`staff` would itself be filtered by `staff`'s policies. `is_staff_of()` and
`is_admin()` are `SECURITY DEFINER`, which is the standard way out.

---

## Before you deploy

- [ ] **Check the RLS advisor.** Supabase dashboard → Database → Advisors.
      There must be no "RLS disabled in public" warnings. A table without RLS
      is readable by anyone holding the anon key, which ships in the JS bundle.
- [ ] **Keep the free project awake.** Supabase pauses a free project after
      seven days of inactivity, and waking it takes minutes. Add a `pg_cron`
      job that touches one row daily, or your defense demo opens on a spinner.
- [ ] **Set the environment variables in Vercel**, not just locally.
- [ ] Vercel's Hobby plan excludes commercial use — fine for a capstone demo,
      not for a registrar office actually serving students.

Deploy by pushing to GitHub and importing the repo at vercel.com. Every pull
request gets its own preview URL.

---

## Still open

Every function in the proposal is implemented. Three things remain, and none of
them blocks a demo:

1. **SMS.** Not free from any provider, so the notification matrix is in-app and
   email only. Roughly ₱500 of Semaphore credits buys about a thousand messages
   if you want it working for the defense; it slots in beside `sendMail()` in
   `src/lib/email.ts` as one more channel behind the same call.
2. **Admin editor for services and windows.** Both are seeded by SQL, and the
   RLS policies already permit an admin to change them — there is no form yet,
   so office hours and window counts are edited in the SQL editor.
3. **Blocking out individual appointment slots.** Slots are generated from
   active windows and fixed office hours in `available_slots()`. Closing a
   window for an afternoon means deactivating it, not blanking one slot.

## Notes on a few design choices

**Documents upload from the browser, not through the server.** `RequestForm`
sends files straight to Supabase Storage with the anon key. Routing them
through a Server Action would spend Vercel function time on bytes that never
need to reach our server, and would hit the request body limit.

**Signed URLs are minted on click.** A staff console listing fifty requests
would otherwise generate hundreds of URLs nobody opens.

**Queue tickets carry their own `student_id`.** Deriving the owner by joining
through `requests` would lose every walk-in number — and most numbers are
walk-ins, since taking one does not require having filed a request.
