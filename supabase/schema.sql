create extension if not exists pgcrypto;

create table if not exists public.registrations (
  id uuid primary key default gen_random_uuid(),
  church_name text not null,
  pastor_name text not null,
  contact_person text not null,
  contact_number text not null,
  attendee_count integer not null check (attendee_count > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.campers (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.registrations(id) on delete cascade,
  full_name text not null,
  age integer not null check (age > 0),
  participant_level text not null,
  created_at timestamptz not null default now()
);

alter table public.registrations enable row level security;
alter table public.campers enable row level security;

drop policy if exists "anon can insert registrations" on public.registrations;
create policy "anon can insert registrations"
on public.registrations
for insert
to anon, authenticated
with check (
  char_length(trim(church_name)) > 0
  and char_length(trim(pastor_name)) > 0
  and char_length(trim(contact_person)) > 0
  and char_length(trim(contact_number)) > 0
  and attendee_count > 0
);

drop policy if exists "anon can insert campers" on public.campers;
create policy "anon can insert campers"
on public.campers
for insert
to anon, authenticated
with check (
  registration_id is not null
  and char_length(trim(full_name)) > 0
  and age > 0
  and char_length(trim(participant_level)) > 0
);

drop policy if exists "authenticated can read registrations" on public.registrations;
create policy "authenticated can read registrations"
on public.registrations
for select
to authenticated
using (true);

drop policy if exists "authenticated can read campers" on public.campers;
create policy "authenticated can read campers"
on public.campers
for select
to authenticated
using (true);

create or replace view public.registration_export_rows
with (security_invoker = true) as
select
  r.id as registration_id,
  r.created_at as submitted_at,
  r.church_name,
  r.pastor_name,
  r.contact_person,
  r.contact_number,
  r.attendee_count,
  c.full_name as camper_name,
  c.age as camper_age,
  c.participant_level
from public.registrations r
left join public.campers c on c.registration_id = r.id
order by r.created_at desc, r.church_name asc, c.full_name asc;

create or replace view public.registration_summary
with (security_invoker = true) as
select
  r.id as registration_id,
  r.created_at as submitted_at,
  r.church_name,
  r.pastor_name,
  r.contact_person,
  r.contact_number,
  r.attendee_count,
  count(c.id) as listed_campers
from public.registrations r
left join public.campers c on c.registration_id = r.id
group by r.id;
