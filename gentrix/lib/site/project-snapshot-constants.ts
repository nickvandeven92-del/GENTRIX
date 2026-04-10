/** Harde limieten — snapshot / export / diff-vriendelijk. */
export const SNAPSHOT_DOCUMENT_TITLE_MAX = 120;
export const SNAPSHOT_DESCRIPTION_MAX = 1000;
export const SNAPSHOT_EDITOR_NOTES_MAX = 2000;
export const SNAPSHOT_COPY_INTENT_MAX = 500;
/** Min. zinvolle copyIntent (AI-patch); korter = weglaten. */
export const SNAPSHOT_COPY_INTENT_MIN_MEANINGFUL = 3;
/** Schema-hard max (grote legacy sites); lint waarschuwt lager. */
export const SNAPSHOT_CUSTOM_CSS_MAX = 48_000;
export const SNAPSHOT_CUSTOM_JS_MAX = 48_000;
/** Gegenereerde Tailwind-build (minified) voor live/preview zonder Play CDN — harde bovengrens voor JSON/DB. */
export const SNAPSHOT_TAILWIND_COMPILED_CSS_MAX = 600_000;
export const SNAPSHOT_LINT_CSS_SOFT_WARN = 20_000;
export const SNAPSHOT_LINT_JS_SOFT_WARN = 20_000;
export const SNAPSHOT_PROMPT_HASH_MAX = 128;
export const SNAPSHOT_BRIEF_FINGERPRINT_MAX = 128;
export const SNAPSHOT_LAST_MODEL_MAX = 120;
/** AI site-command: max aantal sectie-updates per patch (defensief). */
export const SNAPSHOT_AI_MAX_SECTION_UPDATES = 12;
/**
 * Max HTML per **AI-patch** field (niet de globale sectie-cap in tailwind schema).
 * Bewust lager dan 120k: minder ruimte voor dubbele DOM / junk. Tune op metrics (p50/p95/p99 sectiegrootte;
 * hoe vaak edits > 20–40k) en zo nodig verder verlagen.
 */
export const SNAPSHOT_AI_MAX_HTML_CHARS_PER_SECTION = 40_000;
