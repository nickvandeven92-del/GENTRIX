import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Startscherm: live boeking (Gentrix API) vs. mock-demo.
 */
export default function HomePage() {
  const [slug, setSlug] = useState("");
  const navigate = useNavigate();

  function goLive(e: React.FormEvent) {
    e.preventDefault();
    const s = slug.trim().toLowerCase();
    if (!s) return;
    navigate(`book/${encodeURIComponent(s)}`);
  }

  return (
    <div className="min-h-screen bg-background px-4 py-16">
      <div className="mx-auto max-w-lg space-y-10">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">GENTRIX — Boeking</h1>
          <p className="mt-2 text-muted-foreground">
            Publieke afspraken via dezelfde API als <code className="rounded bg-muted px-1">gentrix.nl/boek/…</code> (redirect naar
            deze app). Alleen bij aparte Vite-host: <code className="rounded bg-muted px-1">VITE_GENTRIX_API_BASE</code> + CORS op Next.
          </p>
        </div>

        <form onSubmit={goLive} className="space-y-3 rounded-2xl border bg-card p-6 shadow-sm">
          <h2 className="font-heading text-lg font-semibold">Live boeken</h2>
          <p className="text-sm text-muted-foreground">Studio-slug (zoals in het portaal / URL van de klant-site).</p>
          <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="bijv. mosham" autoCapitalize="none" />
          <Button type="submit" className="w-full">
            Open boekflow
          </Button>
        </form>

        <div className="rounded-2xl border border-dashed bg-muted/30 p-6 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Mock-data (los van Supabase)</p>
          <p className="mt-1">De originele demo met lokale JSON staat onder /booking-app/demo — handig voor UI-experimenten.</p>
          <Button variant="outline" className="mt-4" asChild>
            <Link to="demo">Naar mock-demo</Link>
          </Button>
          <Button variant="ghost" className="mt-2 block w-full" asChild>
            <Link to="dashboard">Dashboard (mock)</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
