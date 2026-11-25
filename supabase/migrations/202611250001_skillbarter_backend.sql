begin;

-- The Next.js server is the only reader/writer of private application data.
-- Browser clients receive only the filtered /api/state response.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  name text not null check (char_length(name) between 2 and 50),
  profile jsonb not null default '{}'::jsonb check (jsonb_typeof(profile) = 'object'),
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
revoke all on public.profiles from public, anon, authenticated;
grant select, insert, update, delete on public.profiles to service_role;

create function public.skillbarter_sync_auth_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  display_name text;
begin
  if new.email is null then return new; end if;
  display_name := btrim(coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)));
  if char_length(display_name) < 2 then display_name := 'Участник'; end if;
  display_name := left(display_name, 50);
  insert into public.profiles (id, email, name, role)
  values (new.id, lower(btrim(new.email)), display_name,
    case when new.raw_app_meta_data ->> 'role' = 'admin' then 'admin' else 'user' end)
  on conflict (id) do update set
    email = excluded.email,
    role = excluded.role,
    updated_at = now();
  return new;
end;
$$;

revoke all on function public.skillbarter_sync_auth_profile() from public, anon, authenticated;
create trigger skillbarter_auth_profile
after insert or update of email, raw_app_meta_data on auth.users
for each row execute function public.skillbarter_sync_auth_profile();

-- Existing Supabase users can use the app immediately after the migration.
insert into public.profiles (id, email, name, role)
select id, lower(btrim(email)),
  left(case when char_length(btrim(coalesce(raw_user_meta_data ->> 'name', split_part(email, '@', 1)))) < 2
    then 'Участник' else btrim(coalesce(raw_user_meta_data ->> 'name', split_part(email, '@', 1))) end, 50),
  case when raw_app_meta_data ->> 'role' = 'admin' then 'admin' else 'user' end
from auth.users where email is not null;

create table public.application_state (
  id smallint primary key check (id = 1),
  revision bigint not null default 0 check (revision >= 0),
  state jsonb not null check (jsonb_typeof(state) = 'object'),
  updated_at timestamptz not null default now()
);

insert into public.application_state (id, state)
values (1, '{"version":1,"ledger":{"version":1,"accounts":[],"transactions":[]},"catalog":{"version":1,"offers":[],"favorites":{}},"reviews":[]}'::jsonb);

alter table public.application_state enable row level security;
revoke all on public.application_state from public, anon, authenticated;
grant select, insert, update, delete on public.application_state to service_role;

-- Compare-and-swap commits the ledger, reservations, chat and catalog together.
-- A stale revision returns false so the server recomputes business validation.
create function public.skillbarter_commit_state(p_revision bigint, p_state jsonb)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  changed_rows integer;
begin
  if jsonb_typeof(p_state) <> 'object' or p_state ->> 'version' <> '1' then
    raise exception 'Invalid application state';
  end if;
  update public.application_state
  set state = p_state, revision = revision + 1, updated_at = now()
  where id = 1 and revision = p_revision;
  get diagnostics changed_rows = row_count;
  return changed_rows = 1;
end;
$$;

revoke all on function public.skillbarter_commit_state(bigint, jsonb) from public, anon, authenticated;
grant execute on function public.skillbarter_commit_state(bigint, jsonb) to service_role;

commit;
