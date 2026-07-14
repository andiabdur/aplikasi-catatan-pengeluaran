"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentUrl = `${pathname}${searchParams.size ? `?${searchParams.toString()}` : ""}`;
  const [state, setState] = useState<"idle" | "loading" | "finishing">("idle");
  const prevUrl = useRef(currentUrl);

  useEffect(() => {
    if (currentUrl !== prevUrl.current) {
      prevUrl.current = currentUrl;
      setState("finishing");
      const timer = window.setTimeout(() => setState("idle"), 300);
      return () => window.clearTimeout(timer);
    }
  }, [currentUrl]);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const anchor = (event.target as HTMLElement).closest("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("http")) return;
      if (href === currentUrl) return;

      setState("loading");
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [pathname]);

  if (state === "idle") return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 h-[3px]">
      <div
        className="h-full bg-brand-500 shadow-sm shadow-brand-500/50"
        style={{
          animation:
            state === "loading"
              ? "progressGrow 2s ease-out forwards"
              : "progressFinish 300ms ease-out forwards",
        }}
      />
    </div>
  );
}
