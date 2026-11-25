begin;

-- Serialize the initial copy with application writes so no review is missed.
lock table public.application_state in share row exclusive mode;

create table if not exists public.reviews (
  id text primary key check (char_length(id) > 0),
  author_id text not null check (char_length(author_id) > 0),
  author_name text not null,
  rating integer not null check (rating between 1 and 5),
  text text not null check (char_length(btrim(text)) between 10 and 1000),
  created_at timestamptz not null
);

comment on table public.reviews is
  'Read-only reporting copy of application_state.state.reviews. Add and change reviews through the application; edits to this copy do not change the site.';
comment on column public.reviews.author_id is
  'Original Supabase Auth user ID; retained with the review if the account is deleted.';

alter table public.reviews enable row level security;
revoke all on public.reviews from public, anon, authenticated, service_role;
grant select on public.reviews to service_role;

create or replace function public.skillbarter_sync_reviews_from_state()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if (new.state -> 'reviews') is not distinct from (old.state -> 'reviews') then
      return new;
    end if;
  end if;

  insert into public.reviews (id, author_id, author_name, rating, text, created_at)
  select entry.id, entry."authorId", entry.name, entry.rating, entry.text, entry.date
  from pg_catalog.jsonb_to_recordset(coalesce(new.state -> 'reviews', '[]'::jsonb))
    as entry(id text, "authorId" text, name text, rating integer, text text, date timestamptz)
  on conflict (id) do update set
    author_id = excluded.author_id,
    author_name = excluded.author_name,
    rating = excluded.rating,
    text = excluded.text,
    created_at = excluded.created_at;

  -- Keep the reporting copy consistent if an administrator restores the source.
  delete from public.reviews as saved
  where not exists (
    select 1
    from pg_catalog.jsonb_array_elements(coalesce(new.state -> 'reviews', '[]'::jsonb)) as entry(value)
    where entry.value ->> 'id' = saved.id
  );
  return new;
end;
$$;

revoke all on function public.skillbarter_sync_reviews_from_state() from public, anon, authenticated, service_role;

drop trigger if exists skillbarter_reviews_from_state on public.application_state;
create trigger skillbarter_reviews_from_state
after insert or update of state on public.application_state
for each row execute function public.skillbarter_sync_reviews_from_state();

-- Existing reviews appear as ordinary rows immediately after this migration.
insert into public.reviews (id, author_id, author_name, rating, text, created_at)
select entry.id, entry."authorId", entry.name, entry.rating, entry.text, entry.date
from public.application_state as source
cross join lateral pg_catalog.jsonb_to_recordset(coalesce(source.state -> 'reviews', '[]'::jsonb))
  as entry(id text, "authorId" text, name text, rating integer, text text, date timestamptz)
where source.id = 1
on conflict (id) do update set
  author_id = excluded.author_id,
  author_name = excluded.author_name,
  rating = excluded.rating,
  text = excluded.text,
  created_at = excluded.created_at;

delete from public.reviews as saved
where not exists (
  select 1
  from public.application_state as source
  cross join lateral pg_catalog.jsonb_array_elements(coalesce(source.state -> 'reviews', '[]'::jsonb)) as entry(value)
  where source.id = 1 and entry.value ->> 'id' = saved.id
);

notify pgrst, 'reload schema';
commit;
