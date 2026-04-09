import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export default function RegisterPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await signUp(email, password);
    setBusy(false);
    if (error) {
      toast.error(error.message || 'Registratie mislukt');
      return;
    }
    toast.success('Controleer je e-mail om je account te bevestigen (indien vereist).');
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-8 border border-border rounded-lg p-8 bg-card">
        <div>
          <h1 className="text-2xl font-bold text-card-foreground">Account aanmaken</h1>
          <p className="text-sm text-muted-foreground mt-1">Voor toegang tot het dashboard</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="reg-email">E-mail</Label>
            <Input
              id="reg-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="reg-password">Wachtwoord</Label>
            <Input
              id="reg-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
              className="mt-1"
            />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? 'Bezig…' : 'Registreren'}
          </Button>
        </form>
        <p className="text-center text-sm text-muted-foreground">
          Al een account?{' '}
          <Link to="/login" className="text-primary hover:underline">
            Inloggen
          </Link>
        </p>
      </div>
    </div>
  );
}
