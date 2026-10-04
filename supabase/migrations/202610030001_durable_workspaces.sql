-- Private, cookie-scoped workspaces. Only the server service role has access.
create table public.sessions (
  owner_id text not null,
  id text not null,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  updated_at timestamptz not null default now(),
  primary key (owner_id, id)
);
create table public.work_maps (
  owner_id text not null,
  session_id text not null,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  revision integer not null default 1,
  updated_at timestamptz not null default now(),
  primary key (owner_id, session_id),
  foreign key (owner_id, session_id) references public.sessions(owner_id, id) on delete cascade
);
create table public.erp_state (
  owner_id text primary key,
  invoices jsonb not null default '[]'::jsonb,
  guard jsonb,
  updated_at timestamptz not null default now()
);
create table public.rate_limits (
  owner_id text not null,
  bucket text not null,
  window_start bigint not null,
  count integer not null,
  primary key (owner_id, bucket)
);
alter table public.sessions enable row level security;
alter table public.work_maps enable row level security;
alter table public.erp_state enable row level security;
alter table public.rate_limits enable row level security;
revoke all on public.sessions, public.work_maps, public.erp_state, public.rate_limits from anon, authenticated;
grant all on public.sessions, public.work_maps, public.erp_state, public.rate_limits to service_role;

create function public.tacit_save_map(p_owner text, p_session text, p_data jsonb)
returns jsonb language plpgsql set search_path = public as $$
declare result jsonb;
begin
  insert into work_maps(owner_id, session_id, data, revision)
  values (p_owner, p_session, jsonb_set(p_data, '{revision}', '1'::jsonb), 1)
  on conflict (owner_id, session_id) do update
    set revision = work_maps.revision + 1,
        data = jsonb_set(excluded.data, '{revision}', to_jsonb(work_maps.revision + 1)),
        updated_at = now()
    where coalesce((p_data->>'revision')::integer, 0) = 0
       or work_maps.revision = (p_data->>'revision')::integer
  returning data into result;
  if result is null then raise exception 'Work Map changed; reload before editing' using errcode = '40001'; end if;
  return result;
end;
$$;

create function public.tacit_rate_limit(p_owner text, p_bucket text, p_limit integer, p_seconds integer)
returns boolean language plpgsql set search_path = public as $$
declare current_window bigint; used integer;
begin
  if p_limit < 1 or p_seconds < 1 then raise exception 'Invalid rate limit'; end if;
  current_window := floor(extract(epoch from now()) / p_seconds);
  insert into rate_limits(owner_id, bucket, window_start, count)
  values (p_owner, p_bucket, current_window, 1)
  on conflict (owner_id, bucket) do update
    set window_start = current_window,
        count = case when rate_limits.window_start = current_window then rate_limits.count + 1 else 1 end
  returning count into used;
  return used <= p_limit;
end;
$$;

create function public.tacit_patch_invoice(p_owner text, p_id text, p_patch jsonb)
returns jsonb language plpgsql set search_path = public as $$
declare result jsonb; all_invoices jsonb;
begin
  select invoices into all_invoices from erp_state where owner_id = p_owner for update;
  select value || p_patch into result from jsonb_array_elements(all_invoices) where value->>'id' = p_id;
  if result is null then return null; end if;
  update erp_state set invoices = (
    select jsonb_agg(case when value->>'id' = p_id then result else value end order by ord)
    from jsonb_array_elements(all_invoices) with ordinality as items(value, ord)
  ), updated_at = now() where owner_id = p_owner;
  return result;
end;
$$;

revoke all on function public.tacit_save_map(text,text,jsonb) from public, anon, authenticated;
revoke all on function public.tacit_rate_limit(text,text,integer,integer) from public, anon, authenticated;
revoke all on function public.tacit_patch_invoice(text,text,jsonb) from public, anon, authenticated;
grant execute on function public.tacit_save_map(text,text,jsonb) to service_role;
grant execute on function public.tacit_rate_limit(text,text,integer,integer) to service_role;
grant execute on function public.tacit_patch_invoice(text,text,jsonb) to service_role;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('tacit-media', 'tacit-media', false, 3145728, array['audio/webm','video/webm','image/jpeg','image/png'])
on conflict (id) do nothing;
