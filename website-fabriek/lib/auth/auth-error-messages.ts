/** Supabase Auth → begrijpelijke Nederlandse teksten voor de login-UI. */
export function mapAuthErrorToDutch(message: string): string {
  const m = message.toLowerCase();

  if (m.includes("invalid login credentials") || m.includes("invalid_credentials")) {
    return "Onjuist e-mailadres of wachtwoord — of dit account bestaat nog niet in Supabase.";
  }
  if (m.includes("email not confirmed")) {
    return "E-mail nog niet bevestigd. Controleer je inbox of schakel tijdelijk ‘Confirm email’ uit in Supabase (Authentication → Providers → Email).";
  }
  if (m.includes("too many requests") || m.includes("rate limit")) {
    return "Te veel pogingen. Wacht even en probeer opnieuw.";
  }

  return message;
}
