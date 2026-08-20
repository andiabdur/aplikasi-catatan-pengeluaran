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
    <nav className="fixed bottom-0 inset-x-0 z-30 border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 backdrop-blur shadow-[0px_-2px_0px_0px_rgba(0,0,0,0.03)] dark:shadow-[0px_-2px_0px_0px_rgba(0,0,0,0.5)]">
      <div className="mx-auto max-w-md grid grid-cols-5 h-16 px-1">
        {items.map(({ href, label, icon: Icon, primary }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              prefetch={false}
              className={cn(
                "relative flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-all",
                active
                  ? "text-brand-600 dark:text-brand-400 font-bold"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300",
              )}
            >
              {active && (
                <div className="absolute top-0 w-8 h-1 bg-brand-500 rounded-b-full shadow-sm" />
              )}
              <span
                className={cn(
                  "flex items-center justify-center rounded-xl transition-all",
                  primary
                    ? "bg-brand-600 dark:bg-brand-500 text-white w-10 h-10 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.2)] active:scale-95"
                    : "w-6 h-6",
                )}
              >
                <Icon className={cn(primary ? "w-5 h-5" : "w-5 h-5")} />
              </span>
              <span className={cn("leading-none", primary && "text-brand-600 dark:text-brand-400")}>{label}</span>
            </Link>
          );
        })}
      </div>
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
