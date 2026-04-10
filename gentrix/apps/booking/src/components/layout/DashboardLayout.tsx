import { Link, Outlet, useLocation } from 'react-router-dom';
import { useBusiness } from '@/context/BusinessContext';
import {
  LayoutDashboard, Scissors, Users, Calendar, Clock, Coffee, CalendarOff, Settings, ArrowLeft
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { label: 'Overzicht', path: '/dashboard', icon: LayoutDashboard },
  { label: 'Diensten', path: '/dashboard/diensten', icon: Scissors },
  { label: 'Medewerkers', path: '/dashboard/medewerkers', icon: Users },
  { label: 'Roosters', path: '/dashboard/roosters', icon: Clock },
  { label: 'Pauzes', path: '/dashboard/pauzes', icon: Coffee },
  { label: 'Vrije dagen', path: '/dashboard/vrije-dagen', icon: CalendarOff },
  { label: 'Afspraken', path: '/dashboard/afspraken', icon: Calendar },
  { label: 'Instellingen', path: '/dashboard/instellingen', icon: Settings },
];

export function DashboardLayout() {
  const { business } = useBusiness();
  const location = useLocation();

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border hidden lg:flex flex-col shrink-0">
        <div className="p-4 border-b border-sidebar-border">
          <h2 className="font-heading font-bold text-sidebar-primary-foreground">{business.name}</h2>
          <p className="text-xs text-sidebar-foreground/60">{business.industry}</p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(item => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                  active ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : 'hover:bg-sidebar-accent/50'
                )}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-sidebar-border">
          <Link to="/" className="flex items-center gap-2 text-sm hover:text-sidebar-primary transition-colors">
            <ArrowLeft className="w-4 h-4" /> Terug naar website
          </Link>
        </div>
      </aside>

      {/* Mobile nav — horizontaal scrollbaar zodat alle items bereikbaar zijn */}
      <div
        className={cn(
          'lg:hidden fixed bottom-0 left-0 right-0 z-50 flex gap-0.5 overflow-x-auto border-t bg-card px-1 py-1',
          '[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          'pb-[max(0.5rem,env(safe-area-inset-bottom))]',
        )}
      >
        {navItems.map(item => {
          const active = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'flex min-w-[4.25rem] shrink-0 flex-col items-center justify-center rounded-lg px-1 py-2 text-[11px] leading-tight',
                active ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-muted-foreground',
              )}
            >
              <item.icon className="mb-0.5 h-4 w-4 shrink-0" />
              <span className="max-w-[4.25rem] text-center">{item.label}</span>
            </Link>
          );
        })}
      </div>

      {/* Content */}
      <main className="flex-1 overflow-auto pb-20 lg:pb-0">
        <Outlet />
      </main>
    </div>
  );
}
