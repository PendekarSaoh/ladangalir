-- Client access for the static GitHub Pages build. Run once after 202609150001.
--
-- The app is served as static files, so there is no server to hold a secret key. The browser
-- sends the publishable key plus the signed-in user's token and calls these functions directly.
-- Both are SECURITY DEFINER, and the owner always comes from auth.uid(), never from a parameter.
-- Tables stay closed to anon and authenticated: no policies exist, and nothing is granted to them.

drop function if exists public.ladang_commit(uuid, bigint, uuid, jsonb);
drop function if exists public.ladang_read(uuid);

create function public.ladang_read_self() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('version', 1, 'farmId', f.id, 'revision', f.revision, 'data', jsonb_build_object(
    'crops', coalesce((select jsonb_agg(c.payload order by c.position) from public.ladang_crops c where c.farm_id = f.id), '[]'::jsonb),
    'plots', coalesce((select jsonb_agg(p.payload order by p.position) from public.ladang_plots p where p.farm_id = f.id), '[]'::jsonb),
    'plantings', coalesce((select jsonb_agg(p.payload || jsonb_build_object('rekod', coalesce(l.payload, '{}'::jsonb)) order by p.position)
      from public.ladang_plantings p left join public.ladang_logs l on l.farm_id = p.farm_id and l.planting_id = p.id where p.farm_id = f.id), '[]'::jsonb)
  )) from public.ladang_farms f where f.owner_id = auth.uid();
$$;

-- Row lock + revision check make validation and commit atomic across devices.
-- request_id is retained for deduplication after network failures.
-- p_replace marks the deliberate full replacement used by "Pulihkan Dari Fail".
create function public.ladang_commit_self(p_expected bigint, p_request uuid, p_data jsonb, p_replace boolean default false) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_owner uuid := auth.uid(); f public.ladang_farms; receipt public.ladang_requests; item jsonb; pos bigint; signature text; blocked text;
begin
  if v_owner is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if p_request is null or p_expected is null or p_replace is null or p_expected < 0 or
    jsonb_typeof(p_data->'crops') is distinct from 'array' or jsonb_typeof(p_data->'plots') is distinct from 'array' or jsonb_typeof(p_data->'plantings') is distinct from 'array' then
    raise exception 'invalid_document' using errcode = '22023';
  end if;
  if p_expected = 0 then
    insert into public.ladang_farms(owner_id) values (v_owner) on conflict (owner_id) do nothing;
  end if;
  select * into f from public.ladang_farms where owner_id = v_owner for update;
  if not found then raise exception 'revision_conflict' using errcode = '40001'; end if;
  signature := md5(p_data::text || ':' || p_expected::text);
  select * into receipt from public.ladang_requests where farm_id = f.id and request_id = p_request;
  if found then
    if receipt.fingerprint <> signature then raise exception 'request_reused' using errcode = '22023'; end if;
    return public.ladang_read_self();
  end if;
  if f.revision <> p_expected then raise exception 'revision_conflict' using errcode = '40001'; end if;

  -- Accident guard, not an access boundary: an ordinary save may add a planting or change its
  -- record, but it may not rewrite the dates, plot or crop of a planting that already exists.
  -- Value rules for records are enforced by the app on the paths that write them.
  if not p_replace then
    select p.id into blocked
    from public.ladang_plantings p
    join jsonb_array_elements(p_data->'plantings') x on x->>'id' = p.id
    where p.farm_id = f.id and p.payload is distinct from (x - 'rekod')
    limit 1;
    if blocked is not null then
      raise exception 'Tarikh dan petak jadual sedia ada tidak boleh diubah melalui simpanan log.' using errcode = '23514';
    end if;
  end if;

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
  return public.ladang_read_self();
end;
$$;

revoke all on function public.ladang_read_self() from public, anon;
revoke all on function public.ladang_commit_self(bigint, uuid, jsonb, boolean) from public, anon;
grant execute on function public.ladang_read_self() to authenticated;
grant execute on function public.ladang_commit_self(bigint, uuid, jsonb, boolean) to authenticated;
