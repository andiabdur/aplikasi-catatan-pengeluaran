# Loading & Transition Effects

## Goal

Make the app feel responsive and professional during page navigation and data loading. Currently there's no visual feedback — pages appear blank/frozen until server data resolves.

## Approach

Next.js native `loading.tsx` + CSS animations. Zero new dependencies.

## Components

### 1. Navigation Progress Bar

**File**: `src/components/navigation-progress.tsx` (client component)

A thin bar at the very top of the viewport that animates on route changes.

- Uses `usePathname()` to detect navigation start/end
- 3px height, brand green (`bg-brand-500`), `z-50`, fixed top
- Animation: quick fill to ~80% (300ms ease-out), then slow crawl, then snap to 100% + fade out when page loads
- Pure CSS `@keyframes` + state toggle — no library needed
- Mounted in `layout.tsx` body, above `{children}`

### 2. Per-Page Skeleton Screens via `loading.tsx`

Next.js App Router automatically wraps each route's `page.tsx` in `<Suspense fallback={<Loading />}>` when a `loading.tsx` file exists. This is the skeleton.

Each skeleton mimics the real page layout with shimmer placeholders:

#### `src/app/loading.tsx` (Dashboard)
- Header placeholder (greeting text block)
- Period selector placeholder bar
- 3 stat cards (Wallet/Income/Delta) as shimmer rectangles
- Category breakdown: 4 rows with circle + bar + amount
- Recent transactions: 4 rows with dot + text lines + amount

#### `src/app/history/loading.tsx`
- Filter bar placeholder (period selector + category dropdown)
- Search bar placeholder
- 6 transaction row skeletons (dot + 2 text lines + amount)

#### `src/app/add/loading.tsx`
- Form skeleton: amount input block, category grid (8 rounded pills), date input, description input, submit button

#### `src/app/goals/loading.tsx`
- 3 goal card skeletons: title bar + progress bar + amount text

#### `src/app/settings/loading.tsx`
- 4 settings section skeletons: section title + 2-3 row items each

#### `src/app/events/loading.tsx`
- Header with back arrow placeholder
- Form skeleton (3 inputs + button)
- 3 event card skeletons

All skeletons:
- Use `PageShell` wrapper (except events which has its own layout) for consistent header/nav
- Shimmer effect via a shared CSS class `.skeleton` that uses a gradient animation
- Respect dark mode via Tailwind dark: variants

### 3. Slide-Up + Fade Content Animation

**File**: CSS in `globals.css` + wrapper in `page-shell.tsx`

When content replaces the skeleton, it enters with a subtle slide-up + fade animation:

- `@keyframes slideUpFadeIn`: from `opacity: 0; translateY(8px)` to `opacity: 1; translateY(0)`
- Duration: 300ms, ease-out
- Applied to `<main>` content inside `PageShell`
- CSS-only, no JS animation library needed

### 4. Shimmer Animation

**File**: `globals.css`

```css
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

.skeleton {
  @apply bg-slate-200 dark:bg-slate-700 rounded-lg;
  background-image: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255,255,255,0.4) 50%,
    transparent 100%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
}

.dark .skeleton {
  background-image: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255,255,255,0.08) 50%,
    transparent 100%
  );
}
```

## File Changes Summary

| Action | File |
|--------|------|
| Create | `src/components/navigation-progress.tsx` |
| Create | `src/app/loading.tsx` |
| Create | `src/app/history/loading.tsx` |
| Create | `src/app/add/loading.tsx` |
| Create | `src/app/goals/loading.tsx` |
| Create | `src/app/settings/loading.tsx` |
| Create | `src/app/events/loading.tsx` |
| Modify | `src/app/layout.tsx` — add `<NavigationProgress />` |
| Modify | `src/app/globals.css` — add shimmer keyframes, skeleton class, slideUpFadeIn keyframes |
| Modify | `src/components/page-shell.tsx` — add slideUpFadeIn animation class to `<main>` |

## Non-Goals

- No third-party animation libraries (Framer Motion, etc.)
- No changes to data fetching logic
- No loading states for client-side fetches within pages (those already have "Memuat..." text — can be improved separately)
