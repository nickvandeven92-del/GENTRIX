import { type NextRequest } from "next/server";
import { maybeRewriteCustomDomain } from "@/lib/supabase/middleware-custom-domain";
import { maybeRewritePrimaryLandingSite } from "@/lib/supabase/middleware-primary-landing";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const custom = await maybeRewriteCustomDomain(request);
  if (custom) {
    return custom;
  }
  const landing = maybeRewritePrimaryLandingSite(request);
  if (landing) {
    return landing;
  }
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static files and images.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
