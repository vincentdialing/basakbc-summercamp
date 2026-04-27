# Backend Setup

This project is ready to save RSVP data into Supabase and export it later by church or pastor.

## Why this structure works

- `registrations`: one row per submitted church form
- `campers`: one row per individual camper under that registration
- `registration_export_rows` view: best for CSV export
- `registration_summary` view: best for quick dashboard review

Because each church submission stores `church_name` and `pastor_name`, you can filter before export.

## Setup steps

1. Create a Supabase project.
2. In Supabase SQL Editor, run [supabase/schema.sql](/Users/apple/Desktop/BBCCamp/supabase/schema.sql:1).
3. Copy `.env.example` to `.env`.
4. Fill in:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Start the site with `npm run dev`.

## If Supabase warns about `Security Definer View`

Rerun the updated view definitions from [supabase/schema.sql](/Users/apple/Desktop/BBCCamp/supabase/schema.sql:1). The export views now use `security_invoker = true`, which is the safer configuration and should remove that warning.

## If Supabase warns about `RLS Policy Always True`

Rerun the insert policies from [supabase/schema.sql](/Users/apple/Desktop/BBCCamp/supabase/schema.sql:1). They now check `auth.role() = 'anon'` instead of using a plain `true`, which keeps public form submissions working while satisfying the linter better.

## Export by church or pastor

In Supabase Table Editor or SQL Editor, use:

```sql
select *
from public.registration_export_rows
where church_name = 'Basak Baptist Church'
order by submitted_at desc, camper_name asc;
```

Or by pastor:

```sql
select *
from public.registration_export_rows
where pastor_name = 'Ptr. Dennis H. Dialing'
order by submitted_at desc, camper_name asc;
```

Then export the result to CSV.

## Suggested workflow later

- Accept submissions from the public site using the anon key
- Review data in Supabase dashboard
- Filter by church or pastor
- Export CSV when needed

## Important note

The current SQL allows public inserts only, not public reading. That means visitors can submit forms, but they cannot browse your registration database from the frontend.
