"use client";

import { useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Camera, Loader2, Check, X, ScanLine } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type ProcessState = "idle" | "processing";
type SavedExpense = {
  id?: string;
  description: string;
  amount: number;
  categoryName: string;
  items: { name: string; price: number }[];
};

function formatIDR(n: number) {
  return "Rp " + n.toLocaleString("id-ID");
}

export function FloatingReceipt() {
  const pathname = usePathname();
  const router = useRouter();
  const [, startTransition] = useTransition();

  const fileRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<ProcessState>("idle");
  const [preview, setPreview] = useState<string | null>(null);
  const [savedExpenses, setSavedExpenses] = useState<SavedExpense[]>([]);
  const [merchant, setMerchant] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);

  if (pathname === "/add") return null;

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show preview
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target?.result as string);
    reader.readAsDataURL(file);

    processImage(file);
    // Reset input so the same file can be picked again
    e.target.value = "";
  }

  async function processImage(file: File) {
    setState("processing");
    setError(null);
    setSavedExpenses([]);
    setShowResult(false);

    try {
      const fd = new FormData();
      fd.append("image", file, file.name);
      const res = await fetch("/api/receipt-expense", { method: "POST", body: fd });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Gagal membaca struk.");
        setShowResult(true);
        setState("idle");
        return;
      }

      type Group = {
        description: string;
        amount: number;
        category_id: string | null;
        category_name: string | null;
        goal_id: string | null;
        items: { name: string; price: number }[];
        date?: string;
      };

      const groups: Group[] = Array.isArray(data.groups) ? data.groups : [];
      const spentAt = data.date || new Date().toISOString().slice(0, 10);
      setMerchant(data.merchant || "");

      const postable = groups.filter((g) => g.category_id && g.amount > 0);

      if (postable.length === 0) {
        setError(
          groups.length > 0
            ? "Ada item terbaca tapi kategori tidak cocok. Coba foto lebih jelas."
            : "Struk tidak terbaca. Pastikan foto jelas dan cukup terang.",
        );
        setShowResult(true);
        setState("idle");
        return;
      }

      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError("Belum login."); setState("idle"); return; }
      const { data: member } = await supabase
        .from("household_members").select("household_id").eq("user_id", user.id).single();
      if (!member) { setError("Household tidak ditemukan."); setState("idle"); return; }

      const saved: SavedExpense[] = [];
      for (const g of postable) {
        const { data: inserted } = await supabase
          .from("expenses")
          .insert({
            household_id: member.household_id,
            category_id: g.category_id,
            spent_at: spentAt,
            description: g.description,
            amount: g.amount,
            goal_id: g.goal_id || null,
            created_by: user.id,
          })
          .select("id")
          .single();

        saved.push({
          id: inserted?.id,
          description: g.description,
          amount: g.amount,
          categoryName: g.category_name ?? "",
          items: g.items ?? [],
        });
      }

      setSavedExpenses(saved);
      setShowResult(true);
      setState("idle");
      startTransition(() => router.refresh());
    } catch {
      setError("Gagal memproses. Cek koneksi.");
      setShowResult(true);
      setState("idle");
    }
  }

  async function undoSaved(id?: string) {
    if (!id) return;
    const supabase = createClient();
    await supabase.from("expenses").delete().eq("id", id);
    setSavedExpenses((prev) => prev.filter((e) => e.id !== id));
    startTransition(() => router.refresh());
  }

  async function undoAll() {
    const ids = savedExpenses.map((e) => e.id).filter(Boolean) as string[];
    if (!ids.length) return;
    const supabase = createClient();
    await supabase.from("expenses").delete().in("id", ids);
    setSavedExpenses([]);
    startTransition(() => router.refresh());
  }

  function dismiss() {
    setShowResult(false);
    setSavedExpenses([]);
    setError(null);
    setPreview(null);
    setMerchant("");
  }

  return (
    <>
      {/* Hidden file input — capture="environment" opens rear camera on mobile */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Result panel */}
      {showResult && (
        <div className="fixed bottom-[18rem] inset-x-4 z-50 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-3 pt-3 pb-2">
            <div className="flex items-center gap-2">
              {preview && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="struk" className="w-8 h-8 rounded-lg object-cover border border-slate-200 dark:border-slate-600" />
              )}
              <div>
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  {savedExpenses.length > 0
                    ? `${savedExpenses.length} pengeluaran tersimpan`
                    : "Tidak terdeteksi"}
                </p>
                {merchant && (
                  <p className="text-[11px] text-slate-400">{merchant}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {savedExpenses.length > 1 && (
                <button
                  onClick={undoAll}
                  className="text-xs font-medium text-red-500 hover:text-red-600"
                >
                  Batalkan semua
                </button>
              )}
              <button
                onClick={dismiss}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Expense rows */}
          <div className="px-3 pb-3 space-y-1.5">
            {savedExpenses.map((s, i) => (
              <div
                key={s.id ?? i}
                className="flex items-start gap-2 bg-green-50 dark:bg-green-900/20 rounded-xl px-2.5 py-2"
              >
                <Check className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                    {s.description}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {formatIDR(s.amount)} · {s.categoryName}
                  </p>
                  {s.items.length > 1 && (
                    <p className="text-[11px] text-slate-400 leading-snug mt-0.5">
                      {s.items.map((it) => `${it.name} ${formatIDR(it.price)}`).join(" + ")}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => undoSaved(s.id)}
                  className="p-1 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            {error && (
              <p className="text-xs text-red-600 dark:text-red-400 px-1">{error}</p>
            )}
          </div>
        </div>
      )}

      {/* Camera floating button */}
      <button
        onClick={() => {
          if (state === "idle") fileRef.current?.click();
        }}
        disabled={state === "processing"}
        aria-label="Foto struk pengeluaran"
        className={`fixed bottom-[9.5rem] right-4 z-40 w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-95 disabled:opacity-70 ${
          state === "processing"
            ? "bg-amber-500 shadow-amber-500/40"
            : "bg-slate-600 shadow-slate-600/30 dark:bg-slate-500 dark:shadow-slate-900/50"
        }`}
      >
        {state === "processing" ? (
          <Loader2 className="w-6 h-6 text-white animate-spin" />
        ) : (
          <Camera className="w-6 h-6 text-white" />
        )}
      </button>

      {/* Scanning indicator */}
      {state === "processing" && (
        <div className="fixed bottom-[13.8rem] right-3 z-50 bg-amber-500 text-white text-xs rounded-full px-2 py-0.5 shadow flex items-center gap-1">
          <ScanLine className="w-3 h-3" />
          Membaca...
        </div>
      )}
    </>
  );
}
