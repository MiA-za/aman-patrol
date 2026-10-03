# Supabase Setup — for non-technical people

**You do NOT need Supabase to try Aman Patrol.** The demo you have now runs
entirely on your phone/laptop. Supabase is only needed when you want the
**real thing**: multiple people, real accounts, data that syncs between
everyone's phones, and photos stored in the cloud.

Budget: **about 10–15 minutes**, once off. Cost: **free** (Supabase's free tier
is more than enough for a neighbourhood watch — it allows 50,000 signups and
500 MB of photos).

---

## What is Supabase (in plain words)?

Think of it as a **safe filing cabinet in the cloud** plus a **security guard**.
It stores your tables (volunteers, shifts, incidents, pins) and checks, on every
single request, *who is asking* — so a volunteer can never see another
volunteer's address or date of birth. That's the "Row Level Security" you'll
see mentioned. You don't have to configure it by hand — the file I gave you
(`supabase/schema.sql`) sets it all up in one paste.

---

## Step 1 — Create your free account

1. Go to **https://supabase.com** in your browser.
2. Click **Start your project** (top right).
3. Sign up with your email (or "Continue with GitHub" if you have a GitHub
   account — either is fine).
4. Confirm your email if it asks you to.

## Step 2 — Create the project

1. Click **New project**.
2. It may ask you to create an *organisation* first — just name it
   `Aman Patrol` and continue.
3. Fill in:
   - **Name**: `aman-patrol`
   - **Database Password**: click **Generate**, then **COPY AND SAVE THIS
     PASSWORD** somewhere safe (a note on your phone is fine). You rarely need
     it, but if you lose it you can't get it back.
   - **Region**: choose the one closest to Johannesburg — if you see
     **South Africa (Cape Town)**, pick that. Otherwise pick something in
     Europe, e.g. **Frankfurt** or **West EU (London)**.
4. Click **Create new project** and wait ~2 minutes while it builds.

## Step 3 — Load the Aman Patrol tables (one paste)

1. In the left sidebar, click **SQL Editor** (it looks like a terminal icon).
2. Click **New query**.
3. Open the file **`supabase/schema.sql`** (in the `supabase` folder of this
   project) in any text editor — Notepad is fine. Select **everything**
   (Ctrl+A), copy (Ctrl+C).
4. Paste it into the SQL Editor and click **Run**.
5. You should see **"Success. No rows returned"** — that is GOOD, it means it
   worked. (If you see an error in red, don't panic: copy the error text and
   send it to me.)

You have just created the volunteers table, shifts, incidents, map pins, the
security rules, and a private photo store.

## Step 4 — Make sign-up friendlier (one toggle)

1. In the sidebar, click the **Project Settings** (bottom left), then
   **Authentication**.
2. Under **Email**, find **"Confirm email"** and turn it **OFF**.

Why? Because Aman Patrol already has its own gate: the coordinator approves
every new volunteer. Making people also click an email link is double admin
for you. (You can turn it back on later if you prefer.)

## Step 5 — Get your two keys

Still in **Project Settings**:

1. Click **API** in the settings menu.
2. You'll see:
   - **Project URL** — looks like `https://abcd1234.supabase.co`
   - **anon public** key — a long string starting with `eyJ...`
3. Copy **both** and keep them. These are the two values the app needs.

> **Are these secret?** The anon key is *designed* to be used inside an app —
> it's safe because all the security rules you loaded in Step 3 protect the
> data. Still, don't post it on Facebook or WhatsApp groups. Your **service
> role** key (further down the same page) IS secret — never share that one,
> and never paste it into the app.

## Step 6 — Make yourself the coordinator

After I connect the app to Supabase (next step), you'll register in the app
like any volunteer. Then, one last time in the SQL Editor, paste this —
replacing the email with the one you registered with — and click **Run**:

```sql
update public.profiles
set role = 'coordinator', status = 'approved'
where email = 'your@email.com';
```

Now you can approve everyone else from inside the app itself — no more SQL.

> **Easier / if the update above is refused:** the app has an
> anti-tampering guard that can block that manual update with
> "Only the coordinator can change role or status." If that happens
> (or if you prefer one step), use **`supabase/make_admin.sql`**:
> fill in your details in the one line at the top and Run it once —
> it creates your login AND makes you the approved coordinator,
> skipping the registration form entirely.

> **Recommended extra — Addendum C:** run **`supabase/addendum_c.sql`**
> once. It schedules a daily cleanup that automatically deletes
> registrations still pending (or declined) after 30 days — their
> details don't linger if nobody reviews them. Approved patrollers
> are never deleted.

## Step 7 — Send me the two keys

Come back to the chat and paste:

- Project URL: `https://....supabase.co`
- Anon key: `eyJ...`

I will then connect the app to your Supabase (registration, login, live roster,
incident reports with photo upload to the cloud, and the coordinator
dashboard — all syncing between everyone's phones). Nothing you've seen in the
demo will change — same screens, same look — the data will just become real
and shared.

---

## Common problems

| What you see | What it means |
|---|---|
| "Success. No rows returned" after pasting the SQL | It worked. That's normal. |
| Red error mentioning "already exists" | You (or I) ran the schema twice. Mostly harmless — send it to me to check. |
| Forgot the database password | You don't need it for anything in this guide. Ignore it. |
| "Region" list doesn't show Cape Town | Pick Frankfurt/London — perfectly fine. |
| Free plan warnings about pausing | Supabase pauses *inactive* free projects after ~1 week of nobody using them. Once the app is live and used weekly, it stays awake. If it ever pauses, open the dashboard and click Restore. |

---

## What stays private once we go live

- Volunteers can **never** see each other's date of birth, home address,
  WhatsApp number or emergency contact. Only the coordinator screen shows
  those.
- Incident photos go into a **private** storage bucket — visible only to the
  person who took them and the coordinator.
- Aman Patrol never sells or shares data with anyone. It's your community's
  data, full stop.
