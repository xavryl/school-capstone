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

### 3. Configure the environment

```bash
cp .env.local.example .env.local
```

Fill in the three values from **Project Settings → API**. The service role key
must stay in the unprefixed variable — see the comments in that file.

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
| `/inquiry` | Guests | Send an inquiry without an account |
| `/track`, `/track/[reference]` | Anyone with a reference | Status and history |
| `/display/registrar`, `/display/treasury` | Lobby TV | Full-screen queue display |
| `/staff` | Registrar/treasury staff | Queue console, requests, inquiries |

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

## Not built yet

Deliberately left, in rough order of how much a panel will ask about it:

1. **Appointment booking UI.** The table, the exclusion constraint, and the
   policies are all in place; the slot picker and the staff schedule manager
   are not.
2. **Reports.** Add `/staff/reports` reading from `request_events` — it is an
   append-only audit trail, so daily counts, completion times, and queue
   statistics are each one `GROUP BY` away. Stream CSV rather than generating a
   PDF server-side: free Vercel functions stop at ten seconds.
3. **Email delivery.** `notifications` rows are written on every status change;
   wire a Brevo SMTP call into a `pg_cron` drain job.
4. **In-app notification bell.** Table and policies exist, UI does not.
5. **Inquiry reply box.** `respond_to_inquiry()` works; the staff page lists
   inquiries without a reply form.

SMS is not on this list on purpose — no provider is free. If you want it for the
demo, roughly ₱500 of Semaphore credits buys about a thousand messages, and it
slots in as one more channel behind the same notification call.
