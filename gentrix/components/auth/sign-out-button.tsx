"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";

type SignOutButtonProps = {
  /** `header`: compact voor topbar. */
  variant?: "sidebar" | "header";
  className?: string;
};

export function SignOutButton({ variant = "sidebar", className }: SignOutButtonProps) {
  const router = useRouter();

  async function signOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={() => void signOut()}
      className={cn(
        variant === "header"
          ? "inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
          : "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 dark:hover:bg-zinc-900 dark:hover:text-zinc-300",
        className,
      )}
    >
      <LogOut className="size-4 shrink-0" aria-hidden />
      Uitloggen
    </button>
  );
}
