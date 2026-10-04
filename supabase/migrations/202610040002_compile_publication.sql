-- Compilation and evidence withdrawal serialize on the workspace's session row.
create or replace function public.tacit_publish_compiled_map(
  p_owner text, p_session text, p_source jsonb, p_data jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare source jsonb;
begin
  if p_source->>'id' is distinct from p_session
     or p_data->>'sessionId' is distinct from p_session then
    raise exception 'session mismatch' using errcode = '22023';
  end if;
  select data into source from sessions
    where owner_id = p_owner and id = p_session for update;
  if not found or source is distinct from p_source then return null; end if;
  return tacit_save_map(p_owner, p_session, p_data);
end;
$$;

create or replace function public.tacit_invalidate_withdrawn_map()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if old.data->'offRecord' is distinct from new.data->'offRecord'
    or exists (
      select 1 from jsonb_array_elements(coalesce(old.data->'frames', '[]')) f
      where not exists (
        select 1 from jsonb_array_elements(coalesce(new.data->'frames', '[]')) n
        where n->>'id' = f->>'id'
      )
    )
    or exists (
      select 1 from jsonb_array_elements(coalesce(old.data->'windows', '[]')) w
      where w->>'answerAudioId' is not null and not exists (
        select 1 from jsonb_array_elements(coalesce(new.data->'windows', '[]')) n
        where n->>'answerAudioId' = w->>'answerAudioId'
      )
    )
    or exists (
      select 1 from jsonb_array_elements(coalesce(old.data->'transcript', '[]')) s
      where not coalesce((s->>'redacted')::boolean, false) and not exists (
        select 1 from jsonb_array_elements(coalesce(new.data->'transcript', '[]')) n
        where n = s
      )
    ) then
    delete from work_maps where owner_id = new.owner_id and session_id = new.id;
  end if;
  return new;
end;
$$;

create trigger tacit_session_evidence_withdrawn
after update of data on public.sessions
for each row execute function public.tacit_invalidate_withdrawn_map();

revoke all on function public.tacit_publish_compiled_map(text,text,jsonb,jsonb) from public, anon, authenticated;
revoke all on function public.tacit_invalidate_withdrawn_map() from public, anon, authenticated;
grant execute on function public.tacit_publish_compiled_map(text,text,jsonb,jsonb) to service_role;
grant execute on function public.tacit_invalidate_withdrawn_map() to service_role;
