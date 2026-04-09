-- Extra usage-operatie voor vision-extract vóór site-generatie.
alter table public.ai_usage_events drop constraint if exists ai_usage_events_operation_check;

alter table public.ai_usage_events add constraint ai_usage_events_operation_check check (
  operation in (
    'generate_site',
    'edit_site',
    'site_chat',
    'activity_journal',
    'extract_design_image'
  )
);
