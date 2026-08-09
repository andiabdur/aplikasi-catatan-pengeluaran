# Loading & Transition Effects Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a navigation progress bar, per-page skeleton loading screens with shimmer, and slide-up + fade content animations to make the app feel responsive during page transitions.

**Architecture:** Use Next.js App Router `loading.tsx` convention for automatic Suspense-based skeleton screens. A client-side `NavigationProgress` component detects route changes via `usePathname()` and renders an animated top bar. CSS `@keyframes` in `globals.css` powers shimmer and slide-up-fade animations — zero new dependencies.

**Tech Stack:** Next.js 15 App Router, React 19, Tailwind CSS 3, CSS `@keyframes`

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `src/components/navigation-progress.tsx` | Client component: animated progress bar on route changes |
| Modify | `src/app/globals.css` | Add `@keyframes shimmer`, `.skeleton` class, `@keyframes slideUpFadeIn`, `.animate-slide-up` class, `@keyframes progressBar` |
| Modify | `src/app/layout.tsx` | Mount `<NavigationProgress />` in body |
| Modify | `src/components/page-shell.tsx` | Add `animate-slide-up` class to `<main>` |
| Create | `src/app/loading.tsx` | Dashboard skeleton |
| Create | `src/app/history/loading.tsx` | History skeleton |
| Create | `src/app/add/loading.tsx` | Add expense form skeleton |
| Create | `src/app/goals/loading.tsx` | Goals skeleton |
| Create | `src/app/settings/loading.tsx` | Settings skeleton |
| Create | `src/app/events/loading.tsx` | Events skeleton |

---

### Task 1: Add CSS Animations to globals.css

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Add shimmer keyframes, skeleton class, slideUpFadeIn keyframes, and progress bar keyframes**

Add AFTER the existing `@layer components { ... }` block at the end of the file:

```css
@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

@keyframes slideUpFadeIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes progressGrow {
  0% {
    width: 0%;
  }
  80% {
    width: 80%;
  }
  100% {
    width: 95%;
  }
}

@keyframes progressFinish {
  from {
    width: 95%;
    opacity: 1;
  }
  to {
    width: 100%;
    opacity: 0;
  }
}

@layer components {
  .skeleton {
    @apply rounded-lg;
    background: linear-gradient(
      90deg,
      theme(colors.slate.200) 0%,
      theme(colors.slate.100) 50%,
      theme(colors.slate.200) 100%
    );
    background-size: 200% 100%;
    animation: shimmer 1.5s ease-in-out infinite;
  }

  .dark .skeleton {
    background: linear-gradient(
      90deg,
      theme(colors.slate.700) 0%,
      theme(colors.slate.600) 50%,
      theme(colors.slate.700) 100%
    );
    background-size: 200% 100%;
    animation: shimmer 1.5s ease-in-out infinite;
  }

  .animate-slide-up {
    animation: slideUpFadeIn 300ms ease-out both;
  }
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `cd "/Users/andi/DevOps Workload/family-expense-tracker" && npx tailwindcss --input src/app/globals.css --content "src/**/*.tsx" --output /dev/null 2>&1 | head -5`

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: add shimmer, slideUpFadeIn, and progress bar CSS animations"
```

---

### Task 2: Create NavigationProgress Component

**Files:**
- Create: `src/components/navigation-progress.tsx`

- [ ] **Step 1: Create the navigation progress bar component**

Create `src/components/navigation-progress.tsx`:

```tsx
"use client";

import { useEffect, useState, useRef } from "react";
import { usePathname } from "next/navigation";

export function NavigationProgress() {
  const pathname = usePathname();
  const [state, setState] = useState<"idle" | "loading" | "finishing">("idle");
  const prevPathname = useRef(pathname);

  useEffect(() => {
    if (pathname !== prevPathname.current) {
      prevPathname.current = pathname;
      setState("finishing");
      const t = setTimeout(() => setState("idle"), 300);
      return () => clearTimeout(t);
    }
  }, [pathname]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("http")) return;
      if (href === pathname) return;
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
```

How this works:
- Listens to link clicks on the document to detect navigation start (`"loading"` state)
- Watches `usePathname()` changes to detect navigation end (`"finishing"` → `"idle"`)
- During `"loading"`: bar grows from 0% to 95% over 2s (CSS `progressGrow`)
- During `"finishing"`: bar snaps 95% → 100% and fades out (CSS `progressFinish`)
- Returns `null` when idle — zero DOM overhead

- [ ] **Step 2: Commit**

```bash
git add src/components/navigation-progress.tsx
git commit -m "feat: create NavigationProgress component for route change indication"
```

---

### Task 3: Mount NavigationProgress in Layout and Add Slide-Up Animation to PageShell

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/components/page-shell.tsx`

- [ ] **Step 1: Add NavigationProgress to layout.tsx**

In `src/app/layout.tsx`, add the import at the top:

```tsx
import { NavigationProgress } from "@/components/navigation-progress";
```

Then add `<NavigationProgress />` as the first child of `<body>`:

Change the `<body>` section from:

```tsx
      <body>
        <SWRegister />
        {children}
      </body>
```

To:

```tsx
      <body>
        <NavigationProgress />
        <SWRegister />
        {children}
      </body>
```

- [ ] **Step 2: Add slide-up animation to PageShell's main content**

In `src/components/page-shell.tsx`, change the `<main>` tag from:

```tsx
      <main className="mx-auto max-w-md px-4 py-4 space-y-4">{children}</main>
```

To:

```tsx
      <main className="mx-auto max-w-md px-4 py-4 space-y-4 animate-slide-up">{children}</main>
```

- [ ] **Step 3: Commit**

```bash
git add src/app/layout.tsx src/components/page-shell.tsx
git commit -m "feat: mount NavigationProgress in layout and add slide-up animation to PageShell"
```

---

### Task 4: Create Dashboard Skeleton (src/app/loading.tsx)

**Files:**
- Create: `src/app/loading.tsx`

- [ ] **Step 1: Create the dashboard skeleton**

This skeleton matches the dashboard layout: PageShell header → period selector → hero summary card → category breakdown → recent transactions.

Create `src/app/loading.tsx`:

```tsx
import { BottomNav } from "@/components/bottom-nav";

export default function DashboardLoading() {
  return (
    <div className="min-h-dvh pb-28">
      <header className="sticky top-0 z-20 bg-white/90 dark:bg-slate-900/90 backdrop-blur border-b border-slate-200 dark:border-slate-700">
        <div className="mx-auto max-w-md px-4 py-3 flex items-center justify-between">
          <div>
            <div className="skeleton h-5 w-36" />
            <div className="skeleton h-3 w-44 mt-1.5" />
          </div>
          <div className="skeleton h-8 w-8 rounded-full" />
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-4 space-y-4">
        {/* Period selector */}
        <div className="skeleton h-10 w-full rounded-xl" />

        {/* Hero summary card */}
        <div className="rounded-2xl bg-gradient-to-br from-brand-600/20 to-brand-700/20 dark:from-brand-900/30 dark:to-brand-800/30 p-5">
          <div className="skeleton h-4 w-32 !bg-brand-200/50 dark:!bg-brand-800/50" />
          <div className="skeleton h-8 w-48 mt-2 !bg-brand-200/50 dark:!bg-brand-800/50" />
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="skeleton h-16 rounded-xl !bg-brand-200/30 dark:!bg-brand-800/30" />
            <div className="skeleton h-16 rounded-xl !bg-brand-200/30 dark:!bg-brand-800/30" />
          </div>
        </div>

        {/* Category breakdown */}
        <section className="card p-0">
          <div className="p-4 flex items-center justify-between">
            <div className="skeleton h-4 w-32" />
            <div className="skeleton h-4 w-16" />
          </div>
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-700"
            >
              <div className="flex items-center gap-3">
                <div className="skeleton h-3 w-3 rounded-full" />
                <div className="skeleton h-4 w-24" />
              </div>
              <div className="skeleton h-4 w-20" />
            </div>
          ))}
        </section>

        {/* Recent transactions */}
        <section className="card p-0">
          <div className="p-4 flex items-center justify-between">
            <div className="skeleton h-4 w-40" />
            <div className="skeleton h-4 w-16" />
          </div>
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-700"
            >
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <div className="skeleton h-2 w-2 rounded-full" />
                  <div className="skeleton h-4 w-32" />
                </div>
                <div className="skeleton h-3 w-24 ml-4" />
              </div>
              <div className="skeleton h-4 w-20" />
            </div>
          ))}
        </section>
      </main>

      <BottomNav />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/loading.tsx
git commit -m "feat: add dashboard skeleton loading screen"
```

---

### Task 5: Create History Skeleton (src/app/history/loading.tsx)

**Files:**
- Create: `src/app/history/loading.tsx`

- [ ] **Step 1: Create the history skeleton**

This skeleton matches the history page: PageShell header → period selector + category filter → search bar → transaction rows.

Create `src/app/history/loading.tsx`:

```tsx
import { BottomNav } from "@/components/bottom-nav";

export default function HistoryLoading() {
  return (
    <div className="min-h-dvh pb-28">
      <header className="sticky top-0 z-20 bg-white/90 dark:bg-slate-900/90 backdrop-blur border-b border-slate-200 dark:border-slate-700">
        <div className="mx-auto max-w-md px-4 py-3 flex items-center justify-between">
          <div>
            <div className="skeleton h-5 w-20" />
            <div className="skeleton h-3 w-36 mt-1.5" />
          </div>
          <div className="skeleton h-8 w-8 rounded-full" />
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-4 space-y-4">
        {/* Filter bar */}
        <div className="flex gap-2">
          <div className="skeleton h-10 flex-1 rounded-xl" />
          <div className="skeleton h-10 flex-1 rounded-xl" />
          <div className="skeleton h-10 flex-1 rounded-xl" />
        </div>

        {/* Search bar */}
        <div className="skeleton h-10 w-full rounded-xl" />

        {/* Summary card */}
        <div className="card">
          <div className="skeleton h-4 w-28 mb-2" />
          <div className="skeleton h-6 w-36" />
        </div>

        {/* Transaction rows */}
        <div className="card p-0">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700 last:border-0"
            >
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <div className="skeleton h-2 w-2 rounded-full" />
                  <div className="skeleton h-4 w-36" />
                </div>
                <div className="skeleton h-3 w-28 ml-4" />
              </div>
              <div className="skeleton h-4 w-20" />
            </div>
          ))}
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/history/loading.tsx
git commit -m "feat: add history page skeleton loading screen"
```

---

### Task 6: Create Add Expense Skeleton (src/app/add/loading.tsx)

**Files:**
- Create: `src/app/add/loading.tsx`

- [ ] **Step 1: Create the add expense form skeleton**

This skeleton matches the add page: PageShell header → amount input → category grid → date → description → submit button.

Create `src/app/add/loading.tsx`:

```tsx
import { BottomNav } from "@/components/bottom-nav";

export default function AddLoading() {
  return (
    <div className="min-h-dvh pb-28">
      <header className="sticky top-0 z-20 bg-white/90 dark:bg-slate-900/90 backdrop-blur border-b border-slate-200 dark:border-slate-700">
        <div className="mx-auto max-w-md px-4 py-3 flex items-center justify-between">
          <div>
            <div className="skeleton h-5 w-40" />
            <div className="skeleton h-3 w-44 mt-1.5" />
          </div>
          <div className="skeleton h-8 w-8 rounded-full" />
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-4 space-y-4">
        {/* Top categories */}
        <div className="flex gap-2 flex-wrap">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-8 w-20 rounded-full" />
          ))}
        </div>

        {/* Amount input */}
        <div>
          <div className="skeleton h-4 w-16 mb-1.5" />
          <div className="skeleton h-12 w-full rounded-xl" />
        </div>

        {/* Category grid */}
        <div>
          <div className="skeleton h-4 w-20 mb-1.5" />
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="skeleton h-10 rounded-xl" />
            ))}
          </div>
        </div>

        {/* Date */}
        <div>
          <div className="skeleton h-4 w-16 mb-1.5" />
          <div className="skeleton h-12 w-full rounded-xl" />
        </div>

        {/* Description */}
        <div>
          <div className="skeleton h-4 w-20 mb-1.5" />
          <div className="skeleton h-12 w-full rounded-xl" />
        </div>

        {/* Submit button */}
        <div className="skeleton h-12 w-full rounded-xl" />
      </main>

      <BottomNav />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/add/loading.tsx
git commit -m "feat: add expense form skeleton loading screen"
```

---

### Task 7: Create Goals Skeleton (src/app/goals/loading.tsx)

**Files:**
- Create: `src/app/goals/loading.tsx`

- [ ] **Step 1: Create the goals skeleton**

This skeleton matches the goals page: PageShell header → goal cards with title + progress bar + amounts.

Create `src/app/goals/loading.tsx`:

```tsx
import { BottomNav } from "@/components/bottom-nav";

export default function GoalsLoading() {
  return (
    <div className="min-h-dvh pb-28">
      <header className="sticky top-0 z-20 bg-white/90 dark:bg-slate-900/90 backdrop-blur border-b border-slate-200 dark:border-slate-700">
        <div className="mx-auto max-w-md px-4 py-3 flex items-center justify-between">
          <div>
            <div className="skeleton h-5 w-36" />
            <div className="skeleton h-3 w-48 mt-1.5" />
          </div>
          <div className="skeleton h-8 w-8 rounded-full" />
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-4 space-y-4">
        {/* Add goal button */}
        <div className="skeleton h-10 w-full rounded-xl" />

        {/* Goal cards */}
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="card space-y-3">
            <div className="flex items-center justify-between">
              <div className="skeleton h-5 w-32" />
              <div className="skeleton h-5 w-16 rounded-full" />
            </div>
            <div className="skeleton h-3 w-full rounded-full" />
            <div className="flex items-center justify-between">
              <div className="skeleton h-4 w-24" />
              <div className="skeleton h-4 w-28" />
            </div>
          </div>
        ))}
      </main>

      <BottomNav />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/goals/loading.tsx
git commit -m "feat: add goals page skeleton loading screen"
```

---

### Task 8: Create Settings Skeleton (src/app/settings/loading.tsx)

**Files:**
- Create: `src/app/settings/loading.tsx`

- [ ] **Step 1: Create the settings skeleton**

This skeleton matches the settings page: PageShell header → settings sections with titles and row items.

Create `src/app/settings/loading.tsx`:

```tsx
import { BottomNav } from "@/components/bottom-nav";

export default function SettingsLoading() {
  return (
    <div className="min-h-dvh pb-28">
      <header className="sticky top-0 z-20 bg-white/90 dark:bg-slate-900/90 backdrop-blur border-b border-slate-200 dark:border-slate-700">
        <div className="mx-auto max-w-md px-4 py-3 flex items-center justify-between">
          <div>
            <div className="skeleton h-5 w-28" />
            <div className="skeleton h-3 w-48 mt-1.5" />
          </div>
          <div className="skeleton h-8 w-8 rounded-full" />
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-4 space-y-4">
        {/* Settings sections */}
        {Array.from({ length: 4 }).map((_, i) => (
          <section key={i} className="card p-0">
            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">
              <div className="skeleton h-4 w-28" />
            </div>
            {Array.from({ length: i < 2 ? 3 : 2 }).map((_, j) => (
              <div
                key={j}
                className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700 last:border-0"
              >
                <div className="skeleton h-4 w-32" />
                <div className="skeleton h-4 w-16" />
              </div>
            ))}
          </section>
        ))}
      </main>

      <BottomNav />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/settings/loading.tsx
git commit -m "feat: add settings page skeleton loading screen"
```

---

### Task 9: Create Events Skeleton (src/app/events/loading.tsx)

**Files:**
- Create: `src/app/events/loading.tsx`

- [ ] **Step 1: Create the events skeleton**

The events page does NOT use PageShell — it has its own layout with a back arrow and custom container. The skeleton must match that structure.

Create `src/app/events/loading.tsx`:

```tsx
export default function EventsLoading() {
  return (
    <div className="container max-w-lg mx-auto p-4 pb-32">
      {/* Header with back arrow */}
      <div className="flex items-center gap-3 mb-6">
        <div className="skeleton h-9 w-9 rounded-full" />
        <div className="skeleton h-6 w-48" />
      </div>

      {/* Create event form skeleton */}
      <div className="mb-6 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
        <div className="skeleton h-5 w-32 mb-3" />
        <div className="space-y-3">
          <div>
            <div className="skeleton h-3 w-20 mb-1" />
            <div className="skeleton h-10 w-full rounded-xl" />
          </div>
          <div>
            <div className="skeleton h-3 w-24 mb-1" />
            <div className="skeleton h-10 w-full rounded-xl" />
          </div>
          <div className="skeleton h-10 w-full rounded-xl" />
        </div>
      </div>

      {/* Event cards skeleton */}
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="skeleton h-5 w-32" />
              <div className="skeleton h-5 w-16 rounded-full" />
            </div>
            <div className="skeleton h-3 w-24 mb-1" />
            <div className="skeleton h-4 w-28" />
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/events/loading.tsx
git commit -m "feat: add events page skeleton loading screen"
```

---

### Task 10: Verify All Loading Screens Work

**Files:** (none — verification only)

- [ ] **Step 1: Start the dev server**

Run: `cd "/Users/andi/DevOps Workload/family-expense-tracker" && npm run dev`

Expected: Server starts on localhost:3000

- [ ] **Step 2: Test each route transition**

Open the app in a browser. Navigate between all routes using the bottom nav:
- `/` (Dashboard) — should show green hero skeleton card + category rows + transaction rows
- `/history` — should show filter bars + transaction row skeletons
- `/add` — should show form field skeletons
- `/goals` — should show goal card skeletons with progress bars
- `/settings` — should show settings section skeletons

For each, verify:
1. Progress bar appears at top (green, 3px) during navigation
2. Skeleton with shimmer effect shows while page loads
3. Content slides up + fades in when loaded
4. Dark mode skeletons look correct (toggle theme)

- [ ] **Step 3: Test events page**

Navigate to `/events` from settings. Verify the back-arrow + form + card skeletons render correctly (this page has a different layout — no PageShell).

- [ ] **Step 4: Final commit**

If any tweaks were needed during testing, commit them:

```bash
git add -A
git commit -m "fix: polish loading skeleton screens after visual testing"
```
