import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Package, FolderTree, Warehouse,
  ShoppingCart, Settings, Store, ChevronLeft, Tag, Star, BarChart3, Building2, LogOut, Menu,
} from 'lucide-react';
import { useWebshop } from '@/webshop';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { useOwnerClientsList } from '@/hooks/use-owner-clients';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Overzicht', end: true },
  { to: '/dashboard/products', icon: Package, label: 'Producten' },
  { to: '/dashboard/categories', icon: FolderTree, label: 'Categorieën' },
  { to: '/dashboard/inventory', icon: Warehouse, label: 'Voorraad' },
  { to: '/dashboard/orders', icon: ShoppingCart, label: 'Orders' },
  { to: '/dashboard/discounts', icon: Tag, label: 'Kortingscodes' },
  { to: '/dashboard/reviews', icon: Star, label: 'Beoordelingen' },
  { to: '/dashboard/analytics', icon: BarChart3, label: 'Analytics' },
  { to: '/dashboard/settings', icon: Settings, label: 'Instellingen' },
];

export default function DashboardLayout() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { state, shopBasePath, clientId, setOwnerDashboardClientId } = useWebshop();
  const { isOwner, signOut, user } = useAuth();
  const { data: ownerClients = [] } = useOwnerClientsList(isOwner);
  const navigate = useNavigate();
  const lowStockCount = state.products.filter(p => p.active && p.totalStock > 0 && p.totalStock <= p.lowStockThreshold).length;
  const newOrderCount = state.orders.filter(o => o.status === 'new').length;
  const pendingReviews = state.reviews.filter(r => !r.approved).length;

  // Close drawer first, then navigate so the sheet dismissal doesn't overlap the page swap.
  const closeMobileAndNavigate = (to: string) => {
    setMobileNavOpen(false);
    // Small delay lets the sheet start its 150ms exit before the Outlet swaps.
    setTimeout(() => navigate(to, { viewTransition: true }), 80);
  };

  const closeMobile = () => setMobileNavOpen(false);

  // isMobile: determines whether to use the close-then-navigate pattern or a plain NavLink
  const sidebarInner = (mobile = false) => (
    <>
      <div className="p-4 border-b border-border space-y-3">
        <div className="flex items-center gap-2">
          <Store className="h-5 w-5 text-primary" />
          <span className="font-bold text-card-foreground">Webshop Dashboard</span>
        </div>
        {isOwner && ownerClients.length > 0 && (
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Actieve klant</span>
            <Select
              value={clientId ?? ''}
              onValueChange={id => setOwnerDashboardClientId(id)}
            >
              <SelectTrigger className="w-full h-9 text-xs">
                <SelectValue placeholder="Kies klant" />
              </SelectTrigger>
              <SelectContent>
                {ownerClients.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {isOwner && (
          <NavLink
            to="/owner/clients"
            viewTransition
            onClick={mobile ? (e) => { e.preventDefault(); closeMobileAndNavigate('/owner/clients'); } : undefined}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2 text-xs font-medium px-2 py-2 rounded-md',
                isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground'
              )
            }
          >
            <Building2 className="h-3.5 w-3.5" />
            Klanten & webshops
          </NavLink>
        )}
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/dashboard'}
            viewTransition
            onClick={mobile ? (e) => { e.preventDefault(); closeMobileAndNavigate(item.to); } : undefined}
            className={({ isActive }) => cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent'
            )}
          >
            <item.icon className="h-4 w-4 flex-shrink-0" />
            <span className="flex-1">{item.label}</span>
            {item.label === 'Voorraad' && lowStockCount > 0 && (
              <span className="bg-destructive text-destructive-foreground text-xs px-1.5 py-0.5 rounded-full font-bold">
                {lowStockCount}
              </span>
            )}
            {item.label === 'Orders' && newOrderCount > 0 && (
              <span className="bg-primary text-primary-foreground text-xs px-1.5 py-0.5 rounded-full font-bold">
                {newOrderCount}
              </span>
            )}
            {item.label === 'Beoordelingen' && pendingReviews > 0 && (
              <span className="bg-accent text-accent-foreground text-xs px-1.5 py-0.5 rounded-full font-bold">
                {pendingReviews}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="p-3 border-t border-border space-y-2">
        <NavLink
          to={shopBasePath}
          viewTransition
          onClick={mobile ? (e) => { e.preventDefault(); closeMobileAndNavigate(shopBasePath); } : undefined}
          className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Terug naar shop
        </NavLink>
        {user && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground"
            onClick={() => {
              if (mobile) closeMobile();
              void signOut();
            }}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Uitloggen
          </Button>
        )}
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col lg:flex-row">
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-4 lg:hidden">
          <div className="flex min-w-0 items-center gap-2">
            <Store className="h-5 w-5 shrink-0 text-primary" />
            <span className="truncate font-semibold text-card-foreground">Webshop</span>
          </div>
          <SheetTrigger asChild>
            <Button type="button" variant="outline" size="icon" aria-label="Menu openen">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
        </header>
        <SheetContent side="left" className="flex w-[min(100vw,20rem)] flex-col gap-0 p-0">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-card">{sidebarInner(true)}</div>
        </SheetContent>
      </Sheet>

      {/* Sidebar — desktop */}
      <aside className="hidden min-h-screen w-64 shrink-0 flex-col border-r border-border bg-card lg:flex lg:flex-col">
        {sidebarInner(false)}
      </aside>

      {/* Main content */}
      <main className="min-h-0 flex-1 overflow-auto">
        <div className="mx-auto max-w-7xl p-4 sm:p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
