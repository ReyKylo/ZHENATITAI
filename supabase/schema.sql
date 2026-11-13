-- ZHEN ATITAI: each authenticated account owns one workspace, shared across its devices.
create table public.atitai_records (
  owner uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{"phones":[],"customers":[],"sales":[],"payments":[]}'::jsonb,
  version bigint not null default 1 check (version > 0),
  updated_at timestamptz not null default now(),
  constraint atitai_data_shape check (
    jsonb_typeof(data) = 'object'
    and data ?& array['phones','customers','sales','payments']
    and jsonb_typeof(data->'phones') = 'array'
    and jsonb_typeof(data->'customers') = 'array'
    and jsonb_typeof(data->'sales') = 'array'
    and jsonb_typeof(data->'payments') = 'array'
    and octet_length(data::text) <= 8000000
  )
);
alter table public.atitai_records enable row level security;
revoke all on table public.atitai_records from public, anon, authenticated;
grant select, insert, update on table public.atitai_records to authenticated;
create policy "Owners read their workspace" on public.atitai_records for select to authenticated
  using ((select auth.uid()) = owner);
create policy "Owners create their workspace" on public.atitai_records for insert to authenticated
  with check ((select auth.uid()) = owner);
create policy "Owners update their workspace" on public.atitai_records for update to authenticated
  using ((select auth.uid()) = owner) with check ((select auth.uid()) = owner);
