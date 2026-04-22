-- Hardening: brute-force guard op e-mail MFA OTP.
--
-- Voegt een attempt-teller en max toe aan admin_email_mfa_codes. In de app-laag zit er óók
-- een in-memory fallback (zie lib/auth/mfa-attempt-limiter.ts) voor het geval deze migratie
-- nog niet is uitgevoerd.

ALTER TABLE public.admin_email_mfa_codes
  ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0;

ALTER TABLE public.admin_email_mfa_codes
  ADD COLUMN IF NOT EXISTS locked_at timestamptz;

COMMENT ON COLUMN public.admin_email_mfa_codes.attempts IS
  'Aantal foutieve pogingen; na 5 wordt locked_at gezet en is de code onbruikbaar.';
