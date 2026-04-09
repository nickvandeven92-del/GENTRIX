import { Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

export default function RequireOwner({ children }: { children: React.ReactNode }) {
  const { user, loading, isOwner } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Laden…
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!isOwner) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
