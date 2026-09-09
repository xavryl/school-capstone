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

Open **SQL Editor** in the Supabase dashboard and run these four files in order.
Order matters — later files reference earlier ones.

| File | What it creates |
|---|---|
| `supabase/migrations/0001_schema.sql` | Tables, enums, and the appointment exclusion constraint |
| `supabase/migrations/0002_functions.sql` | Queue numbering, guest inquiry, tracking, status transitions |
| `supabase/migrations/0003_rls.sql` | Row level security policies on every table |
| `supabase/migrations/0004_seed.sql` | The nine services and four windows from the proposal |
| `supabase/migrations/0005_appointments_reports.sql` | Slot generation, booking, inquiry workflow, report queries |

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
| `/request` | Students | File a transaction request |
| `/appointments` | Students | Book a half-hour window slot, cancel bookings |
| `/inquiry` | Guests | Send an inquiry without an account |
| `/track`, `/track/[reference]` | Anyone with a reference | Status and history |
| `/notifications` | Signed-in users | Every status change, with an unread badge in the nav |
| `/display/registrar`, `/display/treasury` | Lobby TV | Full-screen queue display |
| `/staff` | Registrar/treasury staff | Queue console, today's appointments, requests, inquiry replies |
| `/staff/reports` | Staff | Summary tiles, daily chart, CSV export |

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

Everything in the proposal is built. What remains is either a judgement call or
needs credentials:

1. **Appointment reminders.** `pg_cron` is the place for it — schedule a job
   that reads tomorrow's bookings and inserts notification rows. Vercel's free
   cron is capped at two once-daily jobs, which is why this belongs in Supabase.
2. **SMS.** Not free from any provider, so the notification matrix is in-app and
   email only. Roughly ₱500 of Semaphore credits buys about a thousand messages
   if you want it working for the demo; it slots in as one more channel inside
   `src/lib/email.ts`'s sibling.
3. **Walk-in kiosk page.** `issue_queue_ticket()` exists and works; there is no
   dedicated touch screen for the lobby yet. Staff can issue tickets from the
   console.
4. **Admin service editor.** Services and windows are seeded by SQL and the RLS
   policies already allow admins to change them; there is no form for it.

The system runs without any of these.
