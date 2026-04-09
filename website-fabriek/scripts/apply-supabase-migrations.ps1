# Voert supabase/migrations uit via Node (geen psql nodig).
# Zet DATABASE_URL in .env.local (Supabase → Database → Connection string → URI).
# Of: $env:DATABASE_URL = "postgresql://..." ; .\scripts\apply-supabase-migrations.ps1

$ErrorActionPreference = "Stop"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $repoRoot
node scripts/apply-supabase-migrations.mjs
exit $LASTEXITCODE
