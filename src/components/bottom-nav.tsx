"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Plus, Target, History, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/", label: "Beranda", icon: Home },
  { href: "/history", label: "Riwayat", icon: History },
  { href: "/add", label: "Catat", icon: Plus, primary: true },
  { href: "/goals", label: "Goals", icon: Target },
  { href: "/settings", label: "Atur", icon: Settings },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Navigasi utama"
      className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-card/95 backdrop-blur-md transition-colors"
    >
      <div className="mx-auto max-w-md flex justify-around items-center h-20 px-2">
        {items.map(({ href, label, icon: Icon, primary }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              prefetch={false}
              className={cn(
                "flex flex-col items-center justify-center rounded-xl transition-all w-16 h-14 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                active
                  ? primary
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-accent text-accent-foreground font-semibold"
                  : primary
                    ? "text-primary hover:bg-accent/70 active:scale-95"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted active:scale-95"
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[11px] font-medium mt-0.5">
                {label}
              </span>
            </Link>
          );
        })}
      </div>
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
