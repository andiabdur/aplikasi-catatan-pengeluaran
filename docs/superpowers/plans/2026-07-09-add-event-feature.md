# Event Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create an "Event" feature to group expenses (e.g., trips, specific goals) so users can track total spending for specific occasions alongside normal categories.

**Architecture:** We will add a new `events` table connecting to `households`. We will update the existing `expenses` table to add a nullable `event_id` foreign key. Event data has a start and optional end date and status ("active", "completed"). An `ExpenseForm` UI update will allow tagging an expense to an active event. The voice AI prompt will be updated to correctly tag voice notes if an active event exists.

**Tech Stack:** Next.js (App router), React, Supabase (SQL, pgRouting), TypeScript, Tailwind CSS.

---

### Task 1: Database Migration for Events Table

**Files:**
- Create: `supabase/migrations/0007_events.sql`
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Write SQL Migration file**

```sql
-- Create events table
CREATE TABLE IF NOT EXISTS public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add event_id to expenses table
ALTER TABLE public.expenses
ADD COLUMN event_id UUID REFERENCES public.events(id) ON DELETE SET NULL;
```

- [ ] **Step 2: Update TypeScript definitions**

Modify `src/lib/types.ts` to add the `Event` type and update `Expense`.

```typescript
// Add new type Event:
export type EventStatus = "active" | "completed";
export type Event = {
  id: string;
  household_id: string;
  name: string;
  start_date: string;
  end_date: string | null;
  status: EventStatus;
  created_at: string;
};

// Update Expense to include event_id:
export type Expense = {
  id: string;
  household_id: string;
  category_id: string;
  event_id: string | null; // <--- Added field
  spent_at: string;
  description: string;
  amount: number;
  note: string | null;
  goal_id: string | null;
  created_by: string | null;
  created_at: string;
};
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0007_events.sql src/lib/types.ts
git commit -m "feat: add events table and related types"
```

### Task 2: Create Events Actions & API

**Files:**
- Create: `src/app/actions/events.ts`

- [ ] **Step 1: Create Server Actions for Events**

Create `src/app/actions/events.ts` for handling database operations.

```typescript
"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentHouseholdId } from "@/lib/supabase/household";
import { revalidatePath } from "next/cache";

export async function createEvent(formData: FormData) {
  const supabase = await createClient();
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return { error: "No household selected" };

  const name = formData.get("name") as string;
  const start_date = formData.get("start_date") as string;

  if (!name || !start_date) return { error: "Name and start date are required" };

  const { error } = await supabase.from("events").insert({
    household_id: householdId,
    name,
    start_date,
    status: "active"
  });

  if (error) return { error: error.message };
  
  revalidatePath("/events");
  revalidatePath("/");
  return { success: true };
}

export async function finishEvent(eventId: string, end_date: string) {
  const supabase = await createClient();
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return { error: "No household selected" };

  const { error } = await supabase
    .from("events")
    .update({ status: "completed", end_date })
    .eq("id", eventId)
    .eq("household_id", householdId);

  if (error) return { error: error.message };
  
  revalidatePath("/events");
  revalidatePath("/");
  return { success: true };
}

export async function deleteEvent(eventId: string) {
  const supabase = await createClient();
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return { error: "No household selected" };

  const { error } = await supabase
    .from("events")
    .delete()
    .eq("id", eventId)
    .eq("household_id", householdId);

  if (error) return { error: error.message };
  
  revalidatePath("/events");
  revalidatePath("/");
  return { success: true };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/actions/events.ts
git commit -m "feat: add server actions for events"
```

### Task 3: Update `ExpenseForm` to Support Events

**Files:**
- Modify: `src/components/expense-form.tsx`

- [ ] **Step 1: Update ExpenseForm Component Signature**

Add `events` prop to `ExpenseForm` props to accept active events.
*Assume `events?: Event[];` is added to props.*

```tsx
// Inside src/components/expense-form.tsx imports, add Event type if needed
import type { Category, Budget, GoalWithProgress, Event } from "@/lib/types";

// Update the props definition:
export function ExpenseForm({
  categories,
  budgets,
  activeGoals,
  savedExpenses,
  userId,
  activeEvents = [], // <--- added prop
}: {
  categories: Category[];
  budgets: Budget[];
  activeGoals: GoalWithProgress[];
  savedExpenses: SavedExpense[];
  userId: string | null;
  activeEvents?: Event[];
}) {
  // Add state for event
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  // ... 
```
*Note: Ensure to add UI element (like a `<select>` or switch button) to select `selectedEventId` inside the form before saving.*

- [ ] **Step 2: Update manual save logic to include `event_id`**

When saving the regular expense input, include `event_id: selectedEventId`.

```tsx
// Inside the handleSave function:
        const response = await fetch("/api/expenses", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                amount: Math.round(Number(amount)),
                category_id: selectedCategory,
                description: description || "Pengeluaran",
                spent_at: date.toISOString(),
                event_id: selectedEventId, // <--- Add this line
            }),
        });
```

- [ ] **Step 3: Render Dropdown for Active Events**

Below the category list (or inside advanced settings if it exists, let's just put it below categories for simplicity):

```tsx
        {activeEvents.length > 0 && (
          <div className="mb-4">
            <span className="text-sm text-foreground/70 mb-2 block font-medium">Tautkan ke Event (Opsional)</span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSelectedEventId(null)}
                className={`px-4 py-2 rounded-xl border text-sm font-medium transition-colors ${
                  selectedEventId === null 
                  ? "bg-primary text-primary-foreground border-primary" 
                  : "bg-surface/50 border-input text-foreground hover:bg-surface"
                }`}
              >
                Tanpa Event
              </button>
              {activeEvents.map((evt) => (
                <button
                  key={evt.id}
                  type="button"
                  onClick={() => setSelectedEventId(evt.id)}
                  className={`px-4 py-2 rounded-xl border text-sm font-medium transition-colors ${
                    selectedEventId === evt.id 
                    ? "bg-primary text-primary-foreground border-primary" 
                    : "bg-surface/50 border-input text-foreground hover:bg-surface"
                  }`}
                >
                  {evt.name}
                </button>
              ))}
            </div>
          </div>
        )}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/expense-form.tsx
git commit -m "feat: add event selection UI to ExpenseForm"
```


### Task 4: Upgrade Voice Expense AI Prompt

**Files:**
- Modify: `src/app/api/voice-expense/route.ts`

- [ ] **Step 1: Pass events to AI logic**

Currently `voice-expense` does not know about events. We need it to return `event_id` if mentioned, or default to an active one.
Since `useVoiceRecorder` hooks into `voice-expense`, let's just make the Voice API aware of available events. The client sends `{ audio: ..., activeEvents: [...] }` if doing this properly, but since standard form data is used, it's easier to fetch active events directly server-side in the API.

Modify `src/app/api/voice-expense/route.ts` near where it fetches categories:

```typescript
// Fetch categories...
    const { data: categories } = await supabase
      .from("categories")
      .select("id, name")
      .eq("household_id", householdId);
      
// New: Fetch active events
    const { data: events } = await supabase
      .from("events")
      .select("id, name")
      .eq("household_id", householdId)
      .eq("status", "active");

    const categoryList = categories?.map((c) => `- ${c.name} (ID: ${c.id})`).join("\n");
    const eventList = events && events.length > 0 
      ? events.map((e) => `- ${e.name} (ID: ${e.id})`).join("\n") 
      : "Tidak ada event aktif.";
```

- [ ] **Step 2: Update System Prompt for DeepSeek**

Inject `eventList` and require `event_id` in JSON output:

```typescript
    const deepseekResponse = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${deepseekKey}`,
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: [
          {
            role: "system",
            content: `Anda asisten pencatat pengeluaran. Ekstrak 'amount' (angka tanpa tanda baca/currency, misal 50000), 'description' (deskripsi singkat barang/jasa), 'category_id' dari daftar ini:
${categoryList}
Dan jika user menyebutkan sesuatu yang berbau "liburan", "kondangan", periksa apakah ada event aktif yang cocok:
Acara Aktif:
${eventList}
Tentukan 'event_id' yang sesuai. Jika tidak ada yang cocok atau tidak disebutkan, set null.
Return WAJIB format JSON murni TANPA markdown tags, dengan format: {"amount":50000,"description":"Nasi Goreng","category_id":"...","event_id":"..."}`,
          },
          { role: "user", content: text },
        ],
        temperature: 0,
      }),
    });
```
*Note: Make sure the validation/insert layer in API takes `event_id` and saves it!*

- [ ] **Step 3: Update insert logic for `voice-expense` API**

In `src/app/api/voice-expense/route.ts` where it saves to Supabase:
```typescript
    // Validate output structure JSON
    const expenseData = JSON.parse(content);
    // ...
    
    // Insert ke DB (add event_id field)
    const { data, error } = await supabase
      .from("expenses")
      .insert({
        household_id: householdId,
        category_id: expenseData.category_id || (categories && categories[0]?.id),
        event_id: expenseData.event_id || null, // <--- Add this
        amount: Number(expenseData.amount),
        description: expenseData.description,
        spent_at: new Date().toISOString(),
        created_by: user.user.id,
      })
      .select()
      .single();
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/voice-expense/route.ts
git commit -m "feat: AI voice assistant can tag active events"
```

### Task 5: Build the Events Page

**Files:**
- Create: `src/app/events/page.tsx`
- Create: `src/components/events-list.tsx`

- [ ] **Step 1: Create `events-list.tsx` Component**

```tsx
"use client";

import { deleteEvent, finishEvent } from "@/app/actions/events";
import type { Event } from "@/lib/types";

export function EventsList({ events }: { events: Event[] }) {
  const handleFinish = async (id: string) => {
    if (!confirm("Selesaikan event ini?")) return;
    const endDate = new Date().toISOString().split("T")[0];
    await finishEvent(id, endDate);
  };

  if (!events.length) return <div className="p-4 text-center text-foreground/60 border rounded-2xl">Belum ada event.</div>;

  return (
    <div className="space-y-4">
      {events.map(evt => (
        <div key={evt.id} className="p-4 rounded-2xl border bg-surface flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <div>
            <h3 className="font-semibold">{evt.name}</h3>
            <p className="text-sm text-foreground/60">
              {new Date(evt.start_date).toLocaleDateString("id-ID")}
               {evt.end_date ? ` - ${new Date(evt.end_date).toLocaleDateString("id-ID")}` : " - Sekarang"}
            </p>
            <span className={`inline-block mt-2 text-xs px-2 py-1 rounded-full ${evt.status === 'active' ? 'bg-green-500/20 text-green-700 dark:text-green-300' : 'bg-foreground/10 text-foreground'}`}>
              {evt.status === 'active' ? 'Sedang Berjalan' : 'Selesai'}
            </span>
          </div>
          <div className="flex gap-2">
             {evt.status === "active" && (
                <button onClick={() => handleFinish(evt.id)} className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg">
                  Akhiri
                </button>
             )}
             <button onClick={async () => {
                 if (confirm("Hapus event? Data tidak akan terhapus, tapi pengeluaran tidak punya event lagi.")) {
                     await deleteEvent(evt.id);
                 }
             }} className="px-3 py-1.5 text-sm bg-destructive/10 text-destructive rounded-lg">
               Hapus
             </button>
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create `page.tsx` for Events**

```tsx
import { createClient } from "@/lib/supabase/server";
import { getCurrentHouseholdId } from "@/lib/supabase/household";
import { EventsList } from "@/components/events-list";
import { redirect } from "next/navigation";
import { createEvent } from "@/app/actions/events";
import Link from "next/link";

export default async function EventsPage() {
  const supabase = await createClient();
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/login");

  const { data: events } = await supabase
    .from("events")
    .select("*")
    .eq("household_id", householdId)
    .order("start_date", { ascending: false });

  return (
    <div className="container max-w-lg mx-auto p-4 pb-32">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Daftar Event / Kegiatan</h1>
        <Link href="/" className="text-sm hover:underline">Selesai</Link>
      </div>

      <form action={createEvent} className="mb-6 p-4 rounded-2xl border bg-surface/50">
        <h2 className="font-semibold mb-3">Buat Event Baru</h2>
        <div className="space-y-3">
          <input required name="name" type="text" placeholder="Nama Event (Mis. Liburan Bali)" className="w-full bg-background border px-3 py-2 rounded-xl" />
          <input required name="start_date" type="date" defaultValue={new Date().toISOString().split("T")[0]} className="w-full bg-background border px-3 py-2 rounded-xl" />
          <button type="submit" className="w-full py-2 bg-primary text-primary-foreground rounded-xl font-medium">Tambah Event</button>
        </div>
      </form>

      <EventsList events={events || []} />
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/events-list.tsx src/app/events/page.tsx
git commit -m "feat: add Events management page"
```

### Task 6: Hook ExpenseForm up to Server Data

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/components/bottom-nav.tsx`

- [ ] **Step 1: Fetch active events in main page.tsx**

In `src/app/page.tsx`, we need to fetch active events and pass them down into `<ExpenseForm>`.

Modify `src/app/page.tsx` (around where it fetches categories/goals/budgets):
```typescript
  // Add this inside the parallel fetching group or separately:
  const eventsPromise = supabase
    .from("events")
    .select("*")
    .eq("household_id", householdId)
    .eq("status", "active")
    .order("start_date", { ascending: false });
    
  // Await the promise along with others
  // In `ExpenseForm` rendering, simply pass `activeEvents={eventsData || []}`
```
*(Exact insertion depends on `page.tsx`'s current structure, typically destructure from `Promise.all`.)*

- [ ] **Step 2: Add Navigation Link to `/events`**

In `src/components/bottom-nav.tsx`, consider adding an Events tab, or at least place the link in settings/etc. If there's no room on bottom nav, you can link to it from the Settings page (`src/app/settings/page.tsx`).

Modify `src/app/settings/page.tsx` (or equivalent location) by adding a simple list item to navigate to events:
```tsx
import Link from 'next/link';

// Inside Settings list mappings
<Link href="/events" className="flex items-center justify-between p-4 rounded-2xl border bg-surface">
    <span>Kelola Event / Perjalanan</span>
    <span>▶</span>
</Link>
```

- [ ] **Step 3: Commit**

```bash
git add src/app/page.tsx src/app/settings/page.tsx # or wherever navigation is updated
git commit -m "feat: integrate events with main page and settings"
```
