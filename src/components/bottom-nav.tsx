"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Plus, History, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/", label: "Beranda", icon: Home },
  { href: "/add", label: "Catat", icon: Plus, primary: true },
  { href: "/history", label: "Riwayat", icon: History },
  { href: "/settings", label: "Atur", icon: Settings },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 inset-x-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="mx-auto max-w-md grid grid-cols-4">
        {items.map(({ href, label, icon: Icon, primary }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 py-2.5 text-xs",
                active ? "text-brand-600" : "text-slate-500",
              )}
            >
              <span
                className={cn(
                  "flex items-center justify-center rounded-full",
                  primary
                    ? "bg-brand-600 text-white w-12 h-12 -mt-6 shadow-lg shadow-brand-600/30"
                    : "w-8 h-8",
                  primary && active && "ring-4 ring-brand-100",
                )}
              >
                <Icon className={primary ? "w-6 h-6" : "w-5 h-5"} />
              </span>
              <span className={cn(primary && "text-brand-600 font-medium")}>{label}</span>
            </Link>
          );
        })}
      </div>
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
