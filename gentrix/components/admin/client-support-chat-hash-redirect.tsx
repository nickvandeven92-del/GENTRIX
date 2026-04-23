"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Oude links naar `#client-support-chat` op het overzicht sturen door naar de aparte support-pagina. */
export function ClientSupportChatHashRedirect({ supportHref }: { supportHref: string }) {
  const router = useRouter();
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash !== "#client-support-chat") return;
    router.replace(supportHref);
  }, [router, supportHref]);
  return null;
}
