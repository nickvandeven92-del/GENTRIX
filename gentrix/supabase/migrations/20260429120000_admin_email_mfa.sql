-- admin_email_mfa: bijhouden welke admin-gebruikers email-OTP MFA hebben ingeschakeld
create table if not exists admin_email_mfa (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  enabled_at timestamptz not null default now()
);

alter table admin_email_mfa enable row level security;

-- Gebruiker mag zijn eigen rij lezen (voor middleware-check via auth-client)
create policy "user kan eigen email-mfa status lezen"
  on admin_email_mfa for select
  using (auth.uid() = user_id);

-- Schrijven alleen via service-role (API routes)

-- admin_email_mfa_codes: tijdelijke OTP-codes
create table if not exists admin_email_mfa_codes (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references auth.users(id) on delete cascade,
  code_hash    text        not null,
  expires_at   timestamptz not null,
  consumed_at  timestamptz,
  created_at   timestamptz not null default now()
);

alter table admin_email_mfa_codes enable row level security;
-- Geen user-facing policies; alleen service-role schrijft/leest codes

create index if not exists admin_email_mfa_codes_user_idx    on admin_email_mfa_codes(user_id);
create index if not exists admin_email_mfa_codes_expires_idx on admin_email_mfa_codes(expires_at);
