-- Stabiele uitlees van AI-site-command runs voor dashboards (interpretation_json v1).
-- Pas views aan als interpretation-schema wijzigt.

CREATE OR REPLACE VIEW public.v_site_generation_ai_command AS
SELECT
  r.id,
  r.client_id,
  r.created_at,
  r.operation,
  r.model,
  r.status,
  r.outcome,
  (r.interpretation_json->>'schemaVersion')::int AS interpretation_schema_version,
  r.interpretation_json->>'kind' AS interpretation_kind,
  r.interpretation_json->>'command' AS command,
  r.interpretation_json->>'phase' AS phase,
  (r.interpretation_json->'metrics'->>'snapshotJsonCharsBefore')::bigint AS snapshot_chars_before,
  (r.interpretation_json->'metrics'->>'snapshotJsonCharsAfter')::bigint AS snapshot_chars_after,
  (r.interpretation_json->'metrics'->>'sectionUpdateCount')::int AS section_update_rows,
  (r.interpretation_json->'metrics'->>'distinctSectionsUpdated')::int AS distinct_sections_updated,
  r.interpretation_json->'metrics'->>'pageConfigMergeStrategy' AS page_config_merge_strategy,
  (r.interpretation_json->'metrics'->>'pageConfigKeysInPatch')::int AS page_config_keys_in_patch,
  r.interpretation_json->'metrics'->>'pageType' AS page_type,
  COALESCE(
    (r.interpretation_json->'metrics'->>'lintDiagnosticCount')::int,
    (r.interpretation_json->>'lintDiagnosticCount')::int
  ) AS lint_diagnostic_count,
  COALESCE(
    (r.interpretation_json->'metrics'->>'qualityDiagnosticCount')::int,
    (r.interpretation_json->>'qualityDiagnosticCount')::int
  ) AS quality_diagnostic_count
FROM public.site_generation_runs r
WHERE r.operation LIKE 'ai_command:%';

COMMENT ON VIEW public.v_site_generation_ai_command IS
  'Genormaliseerde velden uit interpretation_json voor ai_command-runs (schema v1).';
