import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export default function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/dashboard';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await signIn(email, password);
    setBusy(false);
    if (error) {
      toast.error(error.message || 'Inloggen mislukt');
      return;
    }
    toast.success('Welkom terug');
    navigate(from, { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-8 border border-border rounded-lg p-8 bg-card">
        <div>
          <h1 className="text-2xl font-bold text-card-foreground">Inloggen</h1>
          <p className="text-sm text-muted-foreground mt-1">Owner of klant-dashboard</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="password">Wachtwoord</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="mt-1"
            />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? 'Bezig…' : 'Inloggen'}
          </Button>
        </form>
        <p className="text-center text-sm text-muted-foreground">
          Nog geen account?{' '}
          <Link to="/register" className="text-primary hover:underline">
            Registreren
          </Link>
        </p>
        <p className="text-center text-sm">
          <Link to="/" className="text-muted-foreground hover:text-foreground">
            Terug naar home
          </Link>
        </p>
      </div>
    </div>
  );
}
