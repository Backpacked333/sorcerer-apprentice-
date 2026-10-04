-- Preserve the upstream per-teach-session guard API without shared local files.
create table if not exists public.teach_guards (
  owner_id text not null,
  teach_session_id text not null,
  data jsonb not null,
  sequence bigint generated always as identity,
  primary key (owner_id, teach_session_id)
);
alter table public.teach_guards enable row level security;
revoke all on public.teach_guards from anon, authenticated;
grant all on public.teach_guards to service_role;

create or replace function public.tacit_save_guard(p_owner text, p_data jsonb)
returns void language sql security invoker set search_path = public as $$
  insert into teach_guards (owner_id, teach_session_id, data)
  values (p_owner, p_data->>'teachSessionId', p_data)
  on conflict (owner_id, teach_session_id) do update
    set data = excluded.data, sequence = excluded.sequence;
$$;

create or replace function public.tacit_set_invoices(p_owner text, p_invoices jsonb)
returns void language sql security invoker set search_path = public as $$
  insert into erp_state (owner_id, invoices, guard) values (p_owner, p_invoices, null)
  on conflict (owner_id) do update set invoices = excluded.invoices;
$$;
revoke all on function public.tacit_save_guard(text, jsonb) from public, anon, authenticated;
revoke all on function public.tacit_set_invoices(text, jsonb) from public, anon, authenticated;
grant execute on function public.tacit_save_guard(text, jsonb) to service_role;
grant execute on function public.tacit_set_invoices(text, jsonb) to service_role;
