import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { rememberBookingsAppSlug } from "@/lib/bookings-app-persistence";

/**
 * `/booking-app/dashboard` zonder slug: prompt voor studio-slug (zelfde als portaal / boek-URL).
 */
export default function DashboardSlugPrompt() {
  const [slug, setSlug] = useState("");

  function go(e: React.FormEvent) {
    e.preventDefault();
    const s = slug.trim().toLowerCase();
    if (!s) return;
    rememberBookingsAppSlug(s);
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    window.location.assign(`${base}/dashboard/${encodeURIComponent(s)}`);
  }

  return (
    <div className="min-h-screen bg-background px-4 py-16">
      <div className="mx-auto max-w-md space-y-6">
        <div>
          <h1 className="font-heading text-2xl font-bold">Boekingen-app</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Dit is het <strong>boekingen-dashboard</strong> (los van het Gentrix-klantportaal). Vul je studio-slug in (zoals in{" "}
            <code className="rounded bg-muted px-1">gentrix.nl/portal/jouw-slug</code>). Log in met hetzelfde portaalaccount; data komt uit je
            Gentrix-agenda.
          </p>
        </div>
        <form onSubmit={go} className="space-y-3 rounded-xl border bg-card p-6">
          <label className="text-sm font-medium" htmlFor="dash-slug">
            Studio-slug
          </label>
          <Input
            id="dash-slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="bijv. mosham"
            autoCapitalize="none"
            autoComplete="off"
          />
          <Button type="submit" className="w-full">
            Open dashboard
          </Button>
        </form>
        <p className="text-center text-sm text-muted-foreground">
          <Link className="text-primary underline" to="..">
            ← Terug naar start
          </Link>
        </p>
      </div>
    </div>
  );
}
