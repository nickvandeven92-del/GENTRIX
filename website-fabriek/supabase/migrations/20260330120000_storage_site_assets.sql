-- Publieke bucket voor logo's / afbeeldingen uit de editor (upload via Next.js API + service role).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'site-assets',
  'site-assets',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "site_assets_public_read" on storage.objects;

create policy "site_assets_public_read"
  on storage.objects for select
  to public
  using (bucket_id = 'site-assets');
