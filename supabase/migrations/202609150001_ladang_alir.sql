-- Run once in the selected Supabase project. Never put project keys in this file.
-- Browser roles have no table/RPC access. The authenticated app API owns writes.
create table public.ladang_farms (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users(id),
  revision bigint not null default 0 check (revision >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.ladang_crops (
  farm_id uuid not null references public.ladang_farms(id) on delete cascade,
  id text not null,
  position integer not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and payload->>'id' = id),
  primary key (farm_id, id)
);
create table public.ladang_plots (
  farm_id uuid not null references public.ladang_farms(id) on delete cascade,
  id text not null,
  position integer not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and payload->>'id' = id),
  primary key (farm_id, id)
);
create table public.ladang_plantings (
  farm_id uuid not null references public.ladang_farms(id) on delete cascade,
  id text not null,
  crop_id text not null,
  plot_id text not null,
  position integer not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and payload->>'id' = id),
  primary key (farm_id, id),
  foreign key (farm_id, crop_id) references public.ladang_crops(farm_id, id) deferrable initially deferred,
  foreign key (farm_id, plot_id) references public.ladang_plots(farm_id, id) deferrable initially deferred
);
create index ladang_plantings_plot on public.ladang_plantings(farm_id, plot_id);
create index ladang_plantings_crop on public.ladang_plantings(farm_id, crop_id);
create table public.ladang_logs (
  farm_id uuid not null,
  planting_id text not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  primary key (farm_id, planting_id),
  foreign key (farm_id, planting_id) references public.ladang_plantings(farm_id, id) on delete cascade
);
create table public.ladang_requests (
  farm_id uuid not null references public.ladang_farms(id) on delete cascade,
  request_id uuid not null,
  fingerprint text not null,
  committed_revision bigint not null,
  created_at timestamptz not null default now(),
  primary key (farm_id, request_id)
);
alter table public.ladang_farms enable row level security;
alter table public.ladang_crops enable row level security;
alter table public.ladang_plots enable row level security;
alter table public.ladang_plantings enable row level security;
alter table public.ladang_logs enable row level security;
alter table public.ladang_requests enable row level security;
revoke all on public.ladang_farms, public.ladang_crops, public.ladang_plots, public.ladang_plantings, public.ladang_logs, public.ladang_requests from public, anon, authenticated;
grant all on public.ladang_farms, public.ladang_crops, public.ladang_plots, public.ladang_plantings, public.ladang_logs, public.ladang_requests to service_role;

create function public.ladang_read(p_owner uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object('version', 1, 'farmId', f.id, 'revision', f.revision, 'data', jsonb_build_object(
    'crops', coalesce((select jsonb_agg(c.payload order by c.position) from public.ladang_crops c where c.farm_id = f.id), '[]'::jsonb),
    'plots', coalesce((select jsonb_agg(p.payload order by p.position) from public.ladang_plots p where p.farm_id = f.id), '[]'::jsonb),
    'plantings', coalesce((select jsonb_agg(p.payload || jsonb_build_object('rekod', coalesce(l.payload, '{}'::jsonb)) order by p.position)
      from public.ladang_plantings p left join public.ladang_logs l on l.farm_id = p.farm_id and l.planting_id = p.id where p.farm_id = f.id), '[]'::jsonb)
  )) from public.ladang_farms f where f.owner_id = p_owner;
$$;

-- Row lock + revision check make validation and commit atomic across all devices.
-- request_id is retained for deduplication after network failures.
create function public.ladang_commit(p_owner uuid, p_expected bigint, p_request uuid, p_data jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare f public.ladang_farms; receipt public.ladang_requests; item jsonb; pos bigint; signature text;
begin
  if p_owner is null or p_request is null or p_expected is null or p_expected < 0 or
    jsonb_typeof(p_data->'crops') is distinct from 'array' or jsonb_typeof(p_data->'plots') is distinct from 'array' or jsonb_typeof(p_data->'plantings') is distinct from 'array' then
    raise exception 'invalid_document' using errcode = '22023';
  end if;
  if p_expected = 0 then
    insert into public.ladang_farms(owner_id) values (p_owner) on conflict (owner_id) do nothing;
  end if;
  select * into f from public.ladang_farms where owner_id = p_owner for update;
  if not found then raise exception 'revision_conflict' using errcode = '40001'; end if;
  signature := md5(p_data::text || ':' || p_expected::text);
  select * into receipt from public.ladang_requests where farm_id = f.id and request_id = p_request;
  if found then
    if receipt.fingerprint <> signature then raise exception 'request_reused' using errcode = '22023'; end if;
    return public.ladang_read(p_owner);
  end if;
  if f.revision <> p_expected then raise exception 'revision_conflict' using errcode = '40001'; end if;

  delete from public.ladang_plantings p where farm_id = f.id and not exists (select 1 from jsonb_array_elements(p_data->'plantings') x where x->>'id' = p.id);
  delete from public.ladang_crops c where farm_id = f.id and not exists (select 1 from jsonb_array_elements(p_data->'crops') x where x->>'id' = c.id);
  delete from public.ladang_plots p where farm_id = f.id and not exists (select 1 from jsonb_array_elements(p_data->'plots') x where x->>'id' = p.id);
  for item, pos in select value, ordinality from jsonb_array_elements(p_data->'crops') with ordinality loop
    insert into public.ladang_crops values(f.id, item->>'id', pos, item)
    on conflict(farm_id, id) do update set payload = excluded.payload, position = excluded.position
    where ladang_crops.payload is distinct from excluded.payload or ladang_crops.position <> excluded.position;
  end loop;
  for item, pos in select value, ordinality from jsonb_array_elements(p_data->'plots') with ordinality loop
    insert into public.ladang_plots values(f.id, item->>'id', pos, item)
    on conflict(farm_id, id) do update set payload = excluded.payload, position = excluded.position
    where ladang_plots.payload is distinct from excluded.payload or ladang_plots.position <> excluded.position;
  end loop;
  for item, pos in select value, ordinality from jsonb_array_elements(p_data->'plantings') with ordinality loop
    insert into public.ladang_plantings values(f.id, item->>'id', item->>'cropId', item->>'plotId', pos, item - 'rekod')
    on conflict(farm_id, id) do update set crop_id = excluded.crop_id, plot_id = excluded.plot_id, position = excluded.position, payload = excluded.payload
    where ladang_plantings.payload is distinct from excluded.payload or ladang_plantings.position <> excluded.position;
    insert into public.ladang_logs values(f.id, item->>'id', coalesce(nullif(item->'rekod', 'null'::jsonb), '{}'::jsonb))
    on conflict(farm_id, planting_id) do update set payload = excluded.payload where ladang_logs.payload is distinct from excluded.payload;
  end loop;
  update public.ladang_farms set revision = revision + 1, updated_at = now() where id = f.id;
  insert into public.ladang_requests(farm_id, request_id, fingerprint, committed_revision) values(f.id, p_request, signature, f.revision + 1);
  return public.ladang_read(p_owner);
end;
$$;
revoke all on function public.ladang_read(uuid) from public, anon, authenticated;
revoke all on function public.ladang_commit(uuid, bigint, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.ladang_read(uuid) to service_role;
grant execute on function public.ladang_commit(uuid, bigint, uuid, jsonb) to service_role;
