# Registrar & Treasury One-Stop Service System

Online transaction requests, appointment booking, walk-in queueing with a lobby
display, a shared staff inbox, and guest inquiries for the registrar and
treasury offices.

Built on the zero-budget stack: **Next.js 16 + Supabase + Vercel**, all free
tiers. Three runtime dependencies — Next, React, and the Supabase client.
Everything else is a build tool.

---

## Setup

### 1. Create the Supabase project

Sign up at [supabase.com](https://supabase.com) and create a project.

**Note which region you pick.** Your Vercel functions have to run in the same
one, or every page waits on database round trips across an ocean — see
[Deploying](#deploying) for what that cost here, measured.

### 2. Run the migrations

Open **SQL Editor** and run these in order. Order matters: later files
reference earlier ones. (There is no `0008`; it was never used.)

| File | What it creates |
|---|---|
| `0001_schema.sql` | Tables, enums, and the appointment exclusion constraint |
| `0002_functions.sql` | Queue numbering, guest inquiry, tracking, status transitions |
| `0003_rls.sql` | Row level security policies on every table |
| `0004_seed.sql` | The nine services and four windows from the proposal |
| `0005_appointments_reports.sql` | Slot generation, booking, inquiry workflow, report queries |
| `0006_attachments_kiosk_announcements.sql` | Document storage, queue issuance, announcements, reminders |
| `0007_profile_media.sql` | Profile pictures, banners, and the rest of the profile fields |
| `0009_roles_and_assignment.sql` | `staff.role`, claiming, assignment, the office head level |
| `0010_office_roster_and_realtime.sql` | Heads can read their own roster; four tables published to Realtime |
| `0011_inbox_view.sql` | `office_inbox()` — requests and inquiries as one list |
| `0012_guest_queue.sql` | Queue numbers without an account |

Or paste `supabase/run-all-migrations.sql` once — it is all of them
concatenated in order, and safe to re-run on a fresh project.

`0006` also contains the two `pg_cron` schedules — appointment reminders and
the keep-alive — commented out at the bottom. Uncomment and run them once your
project is live.

### 3. Two Supabase settings that are easy to miss

**Authentication → Providers → Email**: uncheck **Confirm email**. Office
accounts live on `@school.local`, a domain that deliberately does not resolve,
so a confirmation link would never arrive.

**Authentication → URL Configuration**: add `/reset-password` to **Redirect
URLs**, or the password reset link lands on the wrong page.

### 4. Configure the environment

**`.env.local` already exists** with placeholders and comments — open it and
paste your values from **Project Settings → API**.

| Variable | Needed for |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Everything |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Everything |
| `SUPABASE_SERVICE_ROLE_KEY` | Queue broadcasts, and opening staff accounts |
| `NEXT_PUBLIC_SITE_URL` | Password reset links |
| `BREVO_API_KEY`, `MAIL_FROM` | Email (optional) |

The service role key must stay in the *unprefixed* variable. Anything named
`NEXT_PUBLIC_*` is compiled into the browser bundle, and that key bypasses
every RLS policy.

Email is optional: leave `BREVO_API_KEY` blank and `sendMail()` logs what it
would have sent instead of failing.

### 5. Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000.

### 6. Make the first accounts

Create three logins under **Authentication → Users → Add user**. The passwords
are yours to choose, and there is no email to confirm:

| Email | Becomes |
|---|---|
| `admin@school.local` | System administrator, both offices |
| `registrar@school.local` | Registrar administrator |
| `treasury@school.local` | Treasury administrator |

Then run `supabase/set-office-roles.sql`. It assigns all three, and refuses to
run if `admin@school.local` does not exist yet — demoting both offices while no
system administrator exists would lock everyone out of the accounts page.

They sign in with the username alone: `registrar`, not the full address.

Everything after that happens in the app. An office administrator opens
accounts for their own counter staff under **Staff accounts**.

---

## Who sees what

Five levels, carried by two columns. `staff.department` says which office,
`staff.role` says counter or administrator, and `is_admin` is the one flag that
spans both offices.

| Level | Sees | Set by |
|---|---|---|
| **Guest** | Take a queue number, send an inquiry, track either by reference | no `staff` row |
| **Student** | Own requests, appointments, notifications | no `staff` row |
| **Office staff** | Their office's inbox and queue, and what is assigned to them | `role = 'staff'` |
| **Office administrator** | Everything their office handles, plus its reports and staff accounts | `role = 'head'` |
| **System administrator** | Both offices, and who is what | `is_admin = true` |

An office administrator is **not** a system administrator with a smaller job.
`is_admin` is what widens the query scope to both departments, so giving it to
an office head would hand them the other office's records. They are separate
columns because they are separate powers.

---

## Routes

| Route | Who | What |
|---|---|---|
| `/` | Anyone | Landing, department picker |
| `/login`, `/reset-password` | Anyone | Sign in, register, reset a password |
| `/request` | Students | File a request, attaching supporting documents |
| `/queue` | **Anyone** | Take a number — no account needed — and watch your position |
| `/appointments` | Students | Book a half-hour slot, cancel bookings |
| `/inquiry` | Guests | Send an inquiry without an account |
| `/track`, `/track/[reference]` | Anyone with a reference | Status and history |
| `/profile` | Signed-in users | Picture and banner with a cropper, name, number, program, bio |
| `/notifications` | Signed-in users | Every status change, with an unread badge |
| `/display/registrar`, `/display/treasury` | Lobby TV | Full-screen queue display |
| `/staff` | All staff | Today at a glance: tiles and three charts |
| `/staff/inbox` | All staff | Requests and inquiries as one mail-style list |
| `/staff/queue` | All staff | Call the next number, walk-ins, announcements, your own work |
| `/staff/requests`, `/staff/inquiries`, `/staff/appointments` | All staff | The office's full lists |
| `/staff/reports` | Administrators | Period comparison, six charts, CSV export |
| `/staff/people` | Administrators | Open accounts for the counter; system admins set levels |

Open a display route full-screen (F11) on the television. It needs no sign-in.

---

## How the tricky parts work

**Appointments cannot double-book.** `0001_schema.sql` puts an `EXCLUDE USING
gist` constraint on `appointments`, so two overlapping bookings at the same
window are refused by Postgres itself. `book_appointment()` does no pre-check at
all — it attempts the insert and lets the constraint decide. A check-then-insert
in application code loses that race; the database cannot.

**Queue numbers are atomic.** `next_queue_number()` upserts a per-department,
per-day counter row with `ON CONFLICT ... DO UPDATE`, which takes a row lock and
returns the new value in one statement. Numbers are never derived from
`count(*)` — one cancelled ticket would make that emit a duplicate.

**Two staff can call at once.** `call_next()` selects the oldest waiting ticket
`FOR UPDATE SKIP LOCKED`, so windows 1 and 2 pressing *Call next* simultaneously
get different people rather than deadlocking or both getting the same one.

**Two staff cannot cater the same person.** Taking a concern in the inbox writes
your name on it, and `claim_request()` refuses outright to steal one somebody
else already holds — reassignment is a head's decision, not a race between two
windows. The coloured dot on every row carries it: green nobody has it, yellow
somebody is on it, red it is finished.

**The console keeps itself current.** `Live.tsx` subscribes to row changes on
`requests`, `inquiries`, `appointments` and `queue_tickets` and calls
`router.refresh()`, so the same query that drew the page draws the update rather
than a second client-side copy that can drift. Realtime applies the same
policies a query would, so a registrar administrator is woken by registrar rows
and never learns a treasury row moved. A 25-second poll runs underneath in case
the socket never connects.

**The display survives a dead socket.** `DisplayClient.tsx` subscribes to a
Supabase broadcast channel as the primary path *and* polls `current_queue_state`
every ten seconds. A WebSocket that dies silently looks exactly like a quiet
morning, so the screen repairs itself. The last snapshot is cached in
`localStorage`, so an internet outage freezes the screen on a real number
instead of showing an error page to a lobby full of people.

**Announcements use no audio files.** The browser's built-in `SpeechSynthesis`
reads the call aloud. The lobby banner staff post from `/staff/queue` shows on
that office's display only, one at a time, and arrives on the same broadcast.

**Guests never touch a table.** `submit_inquiry()`, `track()`,
`take_guest_number()` and `guest_queue_position()` are `SECURITY DEFINER`, and
the anon role has `EXECUTE` on exactly those plus `current_queue_state`.
Reference tokens are random (`INQ-9F3A2B7C1D`), not sequential — a guest cannot
read someone else's inquiry by decrementing a number. A guest queue ticket is an
ordinary row with no `student_id`; the ticket id in `localStorage` is the only
proof of ownership, which is why a stale one reads as "no number" rather than as
yesterday's place in the line.

**Policies avoid recursion.** An RLS policy on `requests` that selects from
`staff` would itself be filtered by `staff`'s policies. `is_staff_of()`,
`is_admin()` and `is_head_of()` are `SECURITY DEFINER`, which is the standard
way out. Note that `is_staff_of()` matches **one** department exactly — an
administrator does not pass it, and reaches the other office through the
separate policies in `0006`.

**Pictures are cropped before upload.** `ImageCropper.tsx` draws the visible
region of the frame onto a canvas, so a 4 MB phone photo is stored as a 512px
square rather than four megabytes the browser re-downloads on every page that
shows an avatar. No library — a crop is a rectangle and a scale.

**Charts are hand-written SVG.** Nine of them, server-rendered, with no client
JavaScript and no charting dependency. Every one carries a legend or an axis
with the real figures, which is also what a screen reader gets.

---

## Deploying

Push to GitHub and import the repo at vercel.com. Every pull request gets its
own preview URL.

**Set the function region to match your database.** `vercel.json` pins it to
`sin1` (Singapore) because this project's Supabase lives in AWS
`ap-southeast-1`. Left on the default it ran in Washington DC, and clicking
anything took five to ten seconds. Measured on the deployment before the fix:

| | Server time |
|---|---|
| Anonymous `/login` | 447 ms |
| Signed-in `/staff` | 3,842 ms |
| One click, wall clock | 9,030 ms |

Two causes. Every query crossed the Pacific, and a signed-in page makes about a
dozen in sequence. And Next prefetches a `<Link>` as it scrolls into view —
nearly free for a static route, a full server render for a dynamic one, and
every route here is `force-dynamic` because every route reads the session. One
navigation fired fourteen prefetches, and the click queued behind them. Nav,
sidebar, back bar and landing links now carry `prefetch={false}`.

Check it worked: the `X-Vercel-Id` response header should read `sin1::sin1`,
not `sin1::iad1`. If it still says `iad1`, set the region in the dashboard under
**Settings → Functions** — a dashboard override wins over `vercel.json`.

### Before you deploy

- [ ] **Check the RLS advisor.** Supabase dashboard → Database → Advisors.
      There must be no "RLS disabled in public" warnings. A table without RLS
      is readable by anyone holding the anon key, which ships in the JS bundle.
- [ ] **Keep the free project awake.** Supabase pauses a free project after
      seven days of inactivity, and waking it takes minutes. Uncomment the
      `pg_cron` keep-alive in `0006`, or your defense demo opens on a spinner.
- [ ] **Set the environment variables in Vercel**, not just locally — including
      `SUPABASE_SERVICE_ROLE_KEY`, or opening a staff account fails in
      production while working on your machine.
- [ ] Vercel's Hobby plan excludes commercial use — fine for a capstone demo,
      not for a registrar office actually serving students.

---

## Still open

Every function in the proposal is implemented. These remain, and none of them
blocks a demo:

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
4. **Guest queue numbers have no per-person limit.** A signed-in student is
   blocked from holding two live numbers in one office; a guest cannot be,
   because there is no person to count. In practice a bogus number is one
   *Skip* at the counter.
5. **Lobby announcements reach only the lobby.** They show on the television and
   nowhere on the public site, so "Treasury closes at 3:00 PM today" does not
   reach anyone who has not already travelled in. The table is publicly
   readable, so surfacing it on `/queue` is a display change, not a schema one.

---

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

**Marking a concern catered goes through the status actions**, not a direct
table update. Those actions write the audit trail, the in-app notification and
the email; a raw update would finish the ticket and tell nobody.

**Usernames map onto a domain that does not resolve.** Supabase Auth is keyed on
email, so `registrar` becomes `registrar@school.local`. Anything containing an
`@` is left alone, so students who prefer their real address keep using it.

**One stylesheet, no component library.** `globals.css` is CSS custom properties
with light and dark palettes, 18px body text and 48px controls, because the
people using this include parents and grandparents. Retro-fitting that floor
into someone else's components was more work than writing them.
