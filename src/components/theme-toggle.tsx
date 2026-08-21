"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
    setMounted(true);
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    if (next) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }

  // Avoid hydration mismatch — render placeholder until mounted
  if (!mounted) {
    return <div className="w-10 h-10" />;
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Aktifkan light mode" : "Aktifkan dark mode"}
      className="w-10 h-10 rounded-none border-2 border-slate-950 dark:border-slate-100 bg-white dark:bg-surface-dark text-slate-950 dark:text-slate-100 hover:bg-slate-950 dark:hover:bg-slate-100 hover:text-white dark:hover:text-slate-950 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all flex items-center justify-center shrink-0"
    >
      {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  );
}
