alter table public.clients
  add column if not exists social_gallery_settings jsonb not null default '{"enabled": true, "provider": "instagram"}'::jsonb,
  add column if not exists social_gallery_items jsonb not null default '[]'::jsonb;

update public.clients
set social_gallery_settings = jsonb_build_object(
  'enabled',
  coalesce((social_gallery_settings ->> 'enabled')::boolean, true),
  'provider',
  coalesce(nullif(social_gallery_settings ->> 'provider', ''), 'instagram'),
  'accountId',
  social_gallery_settings ->> 'accountId',
  'accountHandle',
  social_gallery_settings ->> 'accountHandle',
  'accessToken',
  social_gallery_settings ->> 'accessToken',
  'lastSyncAt',
  social_gallery_settings ->> 'lastSyncAt',
  'lastSyncStatus',
  social_gallery_settings ->> 'lastSyncStatus'
);
