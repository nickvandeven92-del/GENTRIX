import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useOwnerClientsList, useCreatePlaceholderClient, useUpdateClientFlags, useAssignClientAdminRole } from '@/hooks/use-owner-clients';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { ArrowLeft, Building2, Plus, ExternalLink } from 'lucide-react';
import RequireOwner from '@/components/RequireOwner';

function OwnerClientsContent() {
  const { data: clients = [], isLoading } = useOwnerClientsList(true);
  const createPlaceholder = useCreatePlaceholderClient();
  const updateFlags = useUpdateClientFlags();
  const assignAdmin = useAssignClientAdminRole();
  const [adminUserId, setAdminUserId] = useState('');

  const defaultSlug = import.meta.env.VITE_DEFAULT_CLIENT_SLUG ?? 'demo-kapper';

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4 flex items-center gap-4">
        <Link to="/dashboard" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-sm">
          <ArrowLeft className="h-4 w-4" /> Dashboard
        </Link>
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold text-foreground">Klanten & webshops</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <p className="text-muted-foreground">
            Maak een placeholder-klant aan, schakel de webshop in of uit, en kies eenvoudige of volledige modus per tenant.
          </p>
          <Button
            onClick={() =>
              createPlaceholder.mutate(undefined, {
                onSuccess: c => toast.success(`Placeholder aangemaakt: ${c.slug}`),
                onError: e => toast.error(e.message),
              })
            }
            disabled={createPlaceholder.isPending}
          >
            <Plus className="h-4 w-4 mr-2" />
            Placeholder klant
          </Button>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground">Laden…</p>
        ) : (
          <ul className="space-y-6">
            {clients.map(c => (
              <li key={c.id} className="border border-border rounded-lg p-6 bg-card space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-card-foreground">{c.name}</h2>
                    <p className="text-sm text-muted-foreground font-mono">/{c.slug}</p>
                    <p className="text-sm text-muted-foreground mt-1">{c.shop_name}</p>
                  </div>
                  <a
                    href={`/shop/c/${c.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    Winkel bekijken <ExternalLink className="h-3 w-3" />
                  </a>
                </div>

                <div className="grid sm:grid-cols-2 gap-6">
                  <div className="flex items-center justify-between gap-4 rounded-md border border-border p-4">
                    <div>
                      <Label htmlFor={`web-${c.id}`} className="text-card-foreground font-medium">
                        Webshop actief
                      </Label>
                      <p className="text-xs text-muted-foreground">Zichtbaar voor bezoekers</p>
                    </div>
                    <Switch
                      id={`web-${c.id}`}
                      checked={c.webshop_enabled}
                      onCheckedChange={checked =>
                        updateFlags.mutate(
                          { id: c.id, webshop_enabled: checked },
                          { onError: e => toast.error(e.message) }
                        )
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between gap-4 rounded-md border border-border p-4">
                    <div>
                      <Label htmlFor={`simple-${c.id}`} className="text-card-foreground font-medium">
                        Eenvoudige webshop
                      </Label>
                      <p className="text-xs text-muted-foreground">Aan = simpel; uit = volledige shop</p>
                    </div>
                    <Switch
                      id={`simple-${c.id}`}
                      checked={c.simple_mode}
                      disabled={!c.webshop_enabled}
                      onCheckedChange={checked =>
                        updateFlags.mutate(
                          { id: c.id, simple_mode: checked },
                          { onError: e => toast.error(e.message) }
                        )
                      }
                    />
                  </div>
                </div>

                <div className="border-t border-border pt-4 space-y-2">
                  <Label className="text-card-foreground">Client admin koppelen (user UUID)</Label>
                  <p className="text-xs text-muted-foreground">
                    Vul het <code className="text-foreground">auth.users.id</code> van de klant in en wijs de rol toe.
                  </p>
                  <div className="flex gap-2 flex-col sm:flex-row">
                    <Input
                      placeholder="00000000-0000-0000-0000-000000000000"
                      value={adminUserId}
                      onChange={e => setAdminUserId(e.target.value)}
                      className="font-mono text-sm"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        if (!adminUserId.trim()) {
                          toast.error('Vul een user UUID in');
                          return;
                        }
                        assignAdmin.mutate(
                          { userId: adminUserId.trim(), clientId: c.id },
                          {
                            onSuccess: () => toast.success('Rol client_admin toegekend'),
                            onError: e => toast.error(e.message),
                          }
                        );
                      }}
                      disabled={assignAdmin.isPending}
                    >
                      Rol toewijzen
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        <p className="text-sm text-muted-foreground border-t border-border pt-6">
          Demo storefront:{' '}
          <Link to={`/shop/c/${defaultSlug}`} className="text-primary hover:underline">
            /shop/c/{defaultSlug}
          </Link>
        </p>
      </main>
    </div>
  );
}

export default function OwnerClientsPage() {
  return (
    <RequireOwner>
      <OwnerClientsContent />
    </RequireOwner>
  );
}
