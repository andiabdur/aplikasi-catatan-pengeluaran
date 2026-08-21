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
    <nav className="fixed bottom-0 inset-x-0 z-40 border-t-4 border-slate-950 dark:border-slate-100 bg-white dark:bg-surface-dark shadow-[0px_-4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[0px_-4px_0px_0px_rgba(255,255,255,1)] transition-colors">
      <div className="mx-auto max-w-md flex justify-around items-center h-20 px-2">
        {items.map(({ href, label, icon: Icon, primary }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              prefetch={false}
              className={cn(
                "flex flex-col items-center justify-center rounded-none transition-all w-16 h-14",
                active
                  ? "bg-slate-950 dark:bg-slate-100 text-white dark:text-slate-950 border-2 border-slate-950 dark:border-slate-100 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)]"
                  : "text-slate-700 dark:text-slate-300 border-2 border-transparent hover:border-slate-950 dark:hover:border-slate-100 hover:bg-slate-950 dark:hover:bg-slate-100 hover:text-white dark:hover:text-slate-950 active:scale-95"
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-headline font-bold uppercase tracking-wider mt-0.5">
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
