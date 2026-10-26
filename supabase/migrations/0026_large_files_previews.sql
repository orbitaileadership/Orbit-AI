-- Large private uploads are processed outside the request path.
-- Apply before deploying code or the document worker. The Storage global limit must
-- separately be at least 512 MiB; bucket limits cannot exceed that global setting.
alter table public.files drop constraint if exists files_status_check;
alter table public.files add constraint files_status_check
  check (status in ('queued', 'processing', 'ready', 'failed', 'needs_ocr'));

alter table public.files add column if not exists preview_path text;
alter table public.files add column if not exists preview_status text;
alter table public.files drop constraint if exists files_preview_status_check;
alter table public.files add constraint files_preview_status_check
  check (preview_status is null or preview_status in ('queued', 'processing', 'ready', 'failed'));
alter table public.files add column if not exists processing_started_at timestamptz;
alter table public.files add column if not exists processing_attempts integer not null default 0;
alter table public.files add constraint files_processing_attempts_check
  check (processing_attempts between 0 and 3) not valid;
-- Keep privileged worker paths tied to the row owner and file ID. Audit and validate
-- legacy rows in staging before validating these constraints on the shared database.
alter table public.files add constraint files_storage_path_owner_check
  check (storage_path like user_id::text || '/' || id::text || '/%' and position('..' in storage_path) = 0) not valid;
alter table public.files add constraint files_preview_path_owner_check
  check (preview_path is null or preview_path like user_id::text || '/' || id::text || '/%') not valid;

create or replace function public.protect_file_processing_fields()
returns trigger language plpgsql set search_path = public as $$
begin
  if auth.role() = 'authenticated' and (
    new.storage_path is distinct from old.storage_path or
    new.preview_path is distinct from old.preview_path or
    new.preview_status is distinct from old.preview_status or
    new.processing_started_at is distinct from old.processing_started_at or
    new.processing_attempts is distinct from old.processing_attempts
  ) then
    raise exception 'file processing fields are server managed';
  end if;
  return new;
end;
$$;
drop trigger if exists protect_file_processing_fields on public.files;
create trigger protect_file_processing_fields before update on public.files
  for each row execute function public.protect_file_processing_fields();
create index if not exists files_processing_idx on public.files (status, preview_status, created_at);

-- Existing Office files had no preview state. Queue only readable originals.
update public.files set preview_status = 'queued'
where preview_status is null and status = 'ready'
  and mime in (
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );

-- Each write checks the current attempt while holding the file row lock. A recovered
-- worker cannot append chunks after a replacement has claimed the same file.
create or replace function public.begin_document_index(p_file_id uuid, p_attempt integer)
returns void language plpgsql security invoker set search_path = public as $$
begin
  if not exists (select 1 from public.files where id = p_file_id and status = 'processing'
    and processing_attempts = p_attempt for update) then
    raise exception 'document_claim_lost';
  end if;
  delete from public.file_chunks where file_id = p_file_id;
end;
$$;
revoke all on function public.begin_document_index(uuid, integer) from public, anon, authenticated;
grant execute on function public.begin_document_index(uuid, integer) to service_role;

create or replace function public.append_document_chunks(p_file_id uuid, p_attempt integer, p_chunks jsonb)
returns void language plpgsql security invoker set search_path = public as $$
declare owner_id uuid;
begin
  select user_id into owner_id from public.files where id = p_file_id and status = 'processing'
    and processing_attempts = p_attempt for update;
  if owner_id is null then raise exception 'document_claim_lost'; end if;
  insert into public.file_chunks(file_id, user_id, page, chunk_index, content)
    select p_file_id, owner_id, part.page, part.chunk_index, part.content
    from jsonb_to_recordset(p_chunks) as part(page integer, chunk_index integer, content text);
end;
$$;
revoke all on function public.append_document_chunks(uuid, integer, jsonb) from public, anon, authenticated;
grant execute on function public.append_document_chunks(uuid, integer, jsonb) to service_role;

update storage.buckets set file_size_limit = 536870912 where id = 'uploads';
