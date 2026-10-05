import { NextResponse } from "next/server";
import { extractBearerToken, verifyApiToken, getApiClient, VerifiedToken } from "@/lib/api-tokens";
import { currentPeriodLabelWithCustom, labelMonthKey, getPeriodRange, periodTitle } from "@/lib/period";
import { formatIDR } from "@/lib/format";
import { buildFinancialContext } from "@/lib/financial-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key, mcp-protocol-version",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(req: Request) {
  // Discovery / Ping endpoint
  const token = extractBearerToken(req);
  let authStatus = "No token provided";

  if (token) {
    const verified = await verifyApiToken(token);
    authStatus = verified ? `Authenticated as ${verified.tokenName}` : "Invalid token";
  }

  return NextResponse.json(
    {
      name: "catatan-keuangan-mcp",
      version: "1.0.0",
      protocol: "Model Context Protocol (JSON-RPC 2.0 / Streamable HTTP)",
      status: "online",
      auth: authStatus,
      description: "Server MCP untuk pencatatan dan analisa keuangan keluarga AAB",
      tools_count: 9,
    },
    { headers: CORS_HEADERS },
  );
}

// =====================================================================
// DEFINISI KATALOG TOOLS MCP (JSONSchema)
// =====================================================================
const MCP_TOOLS = [
  {
    name: "catat_pengeluaran",
    description: "Mencatat transaksi pengeluaran baru ke dalam catatan keuangan keluarga. Cerdas mengenali nama kategori, serta dapat menautkan ke Goal (tabungan) atau Event aktif jika ada.",
    inputSchema: {
      type: "object",
      properties: {
        deskripsi: {
          type: "string",
          description: "Nama barang, belanjaan, atau kebutuhan (contoh: 'Nasi padang', 'Bensin Pertamax', 'Popok bayi').",
        },
        nominal: {
          type: "number",
          description: "Jumlah uang dalam Rupiah tanpa titik/koma (contoh: 35000, 150000).",
        },
        kategori: {
          type: "string",
          description: "Nama kategori belanja (contoh: 'Makan', 'Transportasi', 'Kebutuhan Anak', 'Tagihan', 'Belanja'). Jika dikosongkan, sistem akan menebak kategori terbaik.",
        },
        tanggal: {
          type: "string",
          description: "Tanggal transaksi format YYYY-MM-DD (contoh: '2026-10-05'). Jika dikosongkan, otomatis menggunakan hari ini.",
        },
        nama_event: {
          type: "string",
          description: "Nama kegiatan/event aktif jika pengeluaran ini bagian dari event tertentu (contoh: 'Liburan Jogja').",
        },
        nama_goal: {
          type: "string",
          description: "Nama target tabungan jika pengeluaran ini dialokasikan ke tabungan/goal tertentu (contoh: 'Dana Darurat').",
        },
        catatan: {
          type: "string",
          description: "Catatan tambahan atau keterangan detail transaksi.",
        },
      },
      required: ["deskripsi", "nominal"],
    },
  },
  {
    name: "catat_pemasukan",
    description: "Mencatat pemasukan uang baru untuk periode gajian berjalan (contoh: Gaji, Bonus, Freelance, THR).",
    inputSchema: {
      type: "object",
      properties: {
        sumber: {
          type: "string",
          description: "Sumber atau deskripsi pemasukan (contoh: 'Gaji Abbi', 'Bonus Proyek', 'Freelance').",
        },
        nominal: {
          type: "number",
          description: "Nominal uang masuk dalam Rupiah (contoh: 5000000).",
        },
        bulan: {
          type: "string",
          description: "Bulan periode format YYYY-MM-01 (default: periode aktif berjalan).",
        },
      },
      required: ["sumber", "nominal"],
    },
  },
  {
    name: "lihat_ringkasan_keuangan",
    description: "Melihat ringkasan lengkap kondisi keuangan periode berjalan: total pemasukan, budget total, pengeluaran terpakai, sisa uang kas, persentase pemakaian, dan status kategori overbudget.",
    inputSchema: {
      type: "object",
      properties: {
        bulan: {
          type: "string",
          description: "Bulan periode format YYYY-MM-01 (default: periode gajian aktif).",
        },
      },
    },
  },
  {
    name: "cari_transaksi",
    description: "Mencari riwayat transaksi pengeluaran berdasarkan kata kunci nama barang, filter kategori, atau rentang tanggal tertentu.",
    inputSchema: {
      type: "object",
      properties: {
        kata_kunci: {
          type: "string",
          description: "Kata kunci yang dicari pada deskripsi transaksi (contoh: 'kopi', 'indomaret', 'bensin').",
        },
        kategori: {
          type: "string",
          description: "Filter nama kategori tertentu (contoh: 'Makan').",
        },
        dari_tanggal: {
          type: "string",
          description: "Format YYYY-MM-DD batas awal tanggal.",
        },
        sampai_tanggal: {
          type: "string",
          description: "Format YYYY-MM-DD batas akhir tanggal.",
        },
        limit: {
          type: "number",
          description: "Jumlah maksimal transaksi yang ditampilkan (default: 15).",
        },
      },
    },
  },
  {
    name: "kelola_budget",
    description: "Melihat alokasi pagu anggaran (budget) per kategori atau memperbarui nominal budget kategori untuk periode berjalan / periode berikutnya.",
    inputSchema: {
      type: "object",
      properties: {
        aksi: {
          type: "string",
          enum: ["lihat", "ubah"],
          description: "'lihat' untuk melihat daftar budget saat ini, 'ubah' untuk memperbarui budget.",
        },
        kategori: {
          type: "string",
          description: "Nama kategori yang ingin diubah (wajib jika aksi='ubah').",
        },
        nominal: {
          type: "number",
          description: "Nominal budget baru dalam Rupiah (wajib jika aksi='ubah').",
        },
        bulan: {
          type: "string",
          description: "Bulan periode format YYYY-MM-01 (default: periode berjalan).",
        },
      },
      required: ["aksi"],
    },
  },
  {
    name: "kelola_kategori",
    description: "Melihat daftar seluruh kategori pengeluaran aktif dalam keluarga atau menambahkan kategori baru.",
    inputSchema: {
      type: "object",
      properties: {
        aksi: {
          type: "string",
          enum: ["daftar", "tambah"],
          description: "'daftar' untuk melihat semua kategori, 'tambah' untuk membuat kategori baru.",
        },
        nama_kategori: {
          type: "string",
          description: "Nama kategori baru (wajib jika aksi='tambah').",
        },
        warna: {
          type: "string",
          description: "Kode warna hex (contoh: '#3b82f6'). Default: '#16a34a'.",
        },
      },
      required: ["aksi"],
    },
  },
  {
    name: "kelola_goals_tabungan",
    description: "Melihat progres target impian/tabungan keluarga (misal: Dana Darurat, Umroh, Liburan), atau membuat target baru.",
    inputSchema: {
      type: "object",
      properties: {
        aksi: {
          type: "string",
          enum: ["daftar", "tambah_goal"],
          description: "'daftar' untuk melihat semua tabungan & progres saldonya, 'tambah_goal' untuk membuat target baru.",
        },
        nama_goal: {
          type: "string",
          description: "Nama target tabungan (contoh: 'Dana Darurat 2026', 'Liburan Jepang').",
        },
        target_nominal: {
          type: "number",
          description: "Nominal target dana yang ingin dicapai (dalam Rupiah).",
        },
        target_tanggal: {
          type: "string",
          description: "Estimasi tanggal tercapai format YYYY-MM-DD.",
        },
      },
      required: ["aksi"],
    },
  },
  {
    name: "kelola_events",
    description: "Melihat daftar kegiatan/event keluarga yang sedang berjalan beserta akumulasi biaya pengeluaran yang telah dicatat.",
    inputSchema: {
      type: "object",
      properties: {
        aksi: {
          type: "string",
          enum: ["daftar", "buat_event"],
          description: "'daftar' untuk melihat event aktif, 'buat_event' untuk membuat event baru.",
        },
        nama_event: {
          type: "string",
          description: "Nama kegiatan (contoh: 'Liburan Jogja', 'Renovasi Kamar').",
        },
        tanggal_mulai: {
          type: "string",
          description: "Tanggal mulai format YYYY-MM-DD (default: hari ini).",
        },
      },
      required: ["aksi"],
    },
  },
  {
    name: "analisa_cfo",
    description: "Menjalankan audit mendalam oleh persona Chief Financial Officer (CFO) & Senior Financial Planner (CFP) berbasis data real 3 periode terakhir: diagnosa kesehatan cashflow, evaluasi kebocoran anggaran, savings rate, burn rate harian, dan 3-5 langkah aksi konkret.",
    inputSchema: {
      type: "object",
      properties: {
        pertanyaan_spesifik: {
          type: "string",
          description: "Pertanyaan atau fokus evaluasi khusus dari pengguna (contoh: 'kenapa bulan ini boncos?', 'apakah aman buat beli laptop?').",
        },
      },
    },
  },
];

// =====================================================================
// POST HANDLER (JSON-RPC 2.0)
// =====================================================================
export async function POST(req: Request) {
  // 1. Verifikasi Token Akses
  const token = extractBearerToken(req);
  if (!token) {
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32000,
          message: "Autentikasi gagal: Access Token wajib disertakan melalui header 'Authorization: Bearer <token>' atau query '?token=<token>'.",
        },
      },
      { status: 401, headers: CORS_HEADERS },
    );
  }

  const verified = await verifyApiToken(token);
  if (!verified) {
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32000,
          message: "Token akses tidak valid atau telah dicabut. Buat token baru di halaman Pengaturan.",
        },
      },
      { status: 403, headers: CORS_HEADERS },
    );
  }

  // 2. Parse Body JSON-RPC
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id: null,
        error: { code: -32700, message: "Parse error: Body bukan JSON yang valid." },
      },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  const { jsonrpc, id, method, params } = body as {
    jsonrpc?: string;
    id?: string | number | null;
    method?: string;
    params?: Record<string, unknown>;
  };

  const reqId = id !== undefined ? id : null;

  // 3. Routing Method Protokol MCP
  switch (method) {
    case "initialize": {
      return NextResponse.json(
        {
          jsonrpc: "2.0",
          id: reqId,
          result: {
            protocolVersion: "2024-11-05",
            capabilities: {
              tools: { listChanged: false },
              resources: { subscribe: false, listChanged: false },
            },
            serverInfo: {
              name: "catatan-keuangan-mcp",
              version: "1.0.0",
            },
            instructions:
              "Server MCP Keuangan Keluarga AAB. Gunakan tools yang tersedia untuk mencatat transaksi dan menganalisa keuangan keluarga. Format nominal dalam Rupiah.",
          },
        },
        { headers: CORS_HEADERS },
      );
    }

    case "notifications/initialized":
    case "ping": {
      return NextResponse.json(
        {
          jsonrpc: "2.0",
          id: reqId,
          result: {},
        },
        { headers: CORS_HEADERS },
      );
    }

    case "tools/list": {
      return NextResponse.json(
        {
          jsonrpc: "2.0",
          id: reqId,
          result: {
            tools: MCP_TOOLS,
          },
        },
        { headers: CORS_HEADERS },
      );
    }

    case "tools/call": {
      const toolName = typeof params?.name === "string" ? params.name : "";
      const args = (params?.arguments && typeof params.arguments === "object" ? params.arguments : {}) as Record<string, unknown>;

      try {
        const textResult = await executeTool(toolName, args, verified);
        return NextResponse.json(
          {
            jsonrpc: "2.0",
            id: reqId,
            result: {
              content: [
                {
                  type: "text",
                  text: textResult,
                },
              ],
              isError: false,
            },
          },
          { headers: CORS_HEADERS },
        );
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : "Terjadi kesalahan saat mengeksekusi tool.";
        return NextResponse.json(
          {
            jsonrpc: "2.0",
            id: reqId,
            result: {
              content: [
                {
                  type: "text",
                  text: `Error: ${errMsg}`,
                },
              ],
              isError: true,
            },
          },
          { headers: CORS_HEADERS },
        );
      }
    }

    default: {
      return NextResponse.json(
        {
          jsonrpc: "2.0",
          id: reqId,
          error: {
            code: -32601,
            message: `Method '${method}' tidak didukung oleh server MCP ini.`,
          },
        },
        { status: 400, headers: CORS_HEADERS },
      );
    }
  }
}

// =====================================================================
// IMPLEMENTASI EKSEKUSI TOOLS
// =====================================================================
async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  tokenInfo: VerifiedToken,
): Promise<string> {
  const supabase = getApiClient();
  const householdId = tokenInfo.householdId;
  const userId = tokenInfo.userId;

  switch (toolName) {
    // 1. Catat Pengeluaran
    case "catat_pengeluaran": {
      const deskripsi = String(args.deskripsi || "").trim();
      const nominal = Number(args.nominal);
      const catInput = typeof args.kategori === "string" ? args.kategori.trim() : "";
      const tanggal = typeof args.tanggal === "string" && args.tanggal ? args.tanggal : new Date().toISOString().slice(0, 10);
      const namaEvent = typeof args.nama_event === "string" ? args.nama_event.trim() : "";
      const namaGoal = typeof args.nama_goal === "string" ? args.nama_goal.trim() : "";
      const catatan = typeof args.catatan === "string" ? args.catatan.trim() : null;

      if (!deskripsi) throw new Error("Deskripsi pengeluaran tidak boleh kosong.");
      if (isNaN(nominal) || nominal <= 0) throw new Error("Nominal pengeluaran harus berupa angka positif.");

      // Ambil daftar kategori household
      const { data: categories } = await supabase
        .from("categories")
        .select("id, name")
        .eq("household_id", householdId)
        .eq("is_archived", false);

      const allCats = categories ?? [];
      let matchedCategory = allCats.find(
        (c) => c.name.toLowerCase() === catInput.toLowerCase(),
      );

      // Jika belum cocok, cari kecocokan substring
      if (!matchedCategory && catInput) {
        matchedCategory = allCats.find(
          (c) => c.name.toLowerCase().includes(catInput.toLowerCase()) || catInput.toLowerCase().includes(c.name.toLowerCase()),
        );
      }

      // Default jika tidak ada: cari kategori umum/kebutuhan rumah tangga/makan
      if (!matchedCategory) {
        matchedCategory =
          allCats.find((c) => /makan/i.test(c.name)) ||
          allCats.find((c) => /rumah tangga/i.test(c.name)) ||
          allCats[0];
      }

      // Cari Event jika ada
      let eventId: string | null = null;
      if (namaEvent) {
        const { data: events } = await supabase
          .from("events")
          .select("id, name")
          .eq("household_id", householdId)
          .eq("status", "active");
        const matchedEvent = (events ?? []).find(
          (e) => e.name.toLowerCase().includes(namaEvent.toLowerCase()),
        );
        if (matchedEvent) eventId = matchedEvent.id;
      }

      // Cari Goal jika ada
      let goalId: string | null = null;
      if (namaGoal) {
        const { data: goals } = await supabase
          .from("goals")
          .select("id, name")
          .eq("household_id", householdId)
          .eq("status", "active");
        const matchedGoal = (goals ?? []).find(
          (g) => g.name.toLowerCase().includes(namaGoal.toLowerCase()),
        );
        if (matchedGoal) goalId = matchedGoal.id;
      }

      // Simpan transaksi
      const { data: inserted, error: insertErr } = await supabase
        .from("expenses")
        .insert({
          household_id: householdId,
          created_by: userId,
          description: deskripsi,
          amount: nominal,
          category_id: matchedCategory?.id,
          spent_at: tanggal,
          event_id: eventId,
          goal_id: goalId,
          note: catatan,
        })
        .select("id")
        .single();

      if (insertErr || !inserted) {
        throw new Error(insertErr?.message || "Gagal menyimpan pengeluaran ke database.");
      }

      const catName = matchedCategory ? matchedCategory.name : "Tanpa Kategori";
      let resText = `Berhasil mencatat pengeluaran: "${deskripsi}" sebesar ${formatIDR(nominal)} pada tanggal ${tanggal} (Kategori: ${catName}).`;
      if (namaEvent && eventId) resText += ` Ditautkan ke Event: "${namaEvent}".`;
      if (namaGoal && goalId) resText += ` Dialokasikan ke Goal: "${namaGoal}".`;

      return resText;
    }

    // 2. Catat Pemasukan
    case "catat_pemasukan": {
      const sumber = String(args.sumber || "").trim();
      const nominal = Number(args.nominal);
      const bulanInput = typeof args.bulan === "string" ? args.bulan.trim() : "";

      if (!sumber) throw new Error("Sumber pemasukan wajib diisi.");
      if (isNaN(nominal) || nominal <= 0) throw new Error("Nominal pemasukan harus angka positif.");

      // Hitung bulan periode
      let targetMonth = bulanInput;
      if (!targetMonth) {
        const { data: hh } = await supabase.from("households").select("pay_day_of_month").eq("id", householdId).maybeSingle();
        const { data: cp } = await supabase.from("custom_periods").select("label_month, start_date, end_date").eq("household_id", householdId);
        const payDay = hh?.pay_day_of_month ?? 25;
        targetMonth = labelMonthKey(currentPeriodLabelWithCustom(payDay, cp ?? []));
      }

      const { error: insErr } = await supabase.from("incomes").insert({
        household_id: householdId,
        source: sumber,
        amount: nominal,
        month: targetMonth,
      });

      if (insErr) throw new Error(insErr.message);

      return `Berhasil mencatat pemasukan: "${sumber}" sebesar ${formatIDR(nominal)} untuk periode ${targetMonth}.`;
    }

    // 3. Lihat Ringkasan Keuangan
    case "lihat_ringkasan_keuangan": {
      const { data: hh } = await supabase.from("households").select("pay_day_of_month").eq("id", householdId).maybeSingle();
      const { data: cp } = await supabase.from("custom_periods").select("label_month, start_date, end_date").eq("household_id", householdId);
      const payDay = hh?.pay_day_of_month ?? 25;
      const customPeriods = cp ?? [];

      const targetMonth =
        typeof args.bulan === "string" && args.bulan
          ? args.bulan
          : labelMonthKey(currentPeriodLabelWithCustom(payDay, customPeriods));

      const [summaryRes, incomesRes] = await Promise.all([
        supabase.rpc("f_period_summary", {
          p_household_id: householdId,
          p_label_month: targetMonth,
        }),
        supabase.from("incomes").select("source, amount").eq("household_id", householdId).eq("month", targetMonth),
      ]);

      const summaryRows = summaryRes.data ?? [];
      const incomes = incomesRes.data ?? [];

      const totalIncome = incomes.reduce((acc, i) => acc + Number(i.amount), 0);
      const totalBudget = summaryRows.reduce((acc: number, r: { budget: number }) => acc + Number(r.budget || 0), 0);
      const totalSpent = summaryRows.reduce((acc: number, r: { spent: number }) => acc + Number(r.spent || 0), 0);
      const sisaUang = totalIncome - totalSpent;
      const usagePct = totalBudget > 0 ? ((totalSpent / totalBudget) * 100).toFixed(1) : "0";

      const overbudget = summaryRows.filter((r: { remaining: number }) => Number(r.remaining) < 0);

      const periodRange = getPeriodRange(new Date(targetMonth), payDay, customPeriods);
      const title = periodTitle(new Date(targetMonth));

      let out = `RINGKASAN KEUANGAN KELUARGA (${title}):\n`;
      out += `- Rentang Periode: ${periodRange.from} s/d ${periodRange.to}\n`;
      out += `- Total Pemasukan: ${formatIDR(totalIncome)}\n`;
      out += `- Total Budget Dialokasikan: ${formatIDR(totalBudget)}\n`;
      out += `- Total Pengeluaran Realisasi: ${formatIDR(totalSpent)} (${usagePct}% dari budget)\n`;
      out += `- Sisa Uang Kas Saat Ini: ${formatIDR(sisaUang)}\n\n`;

      if (overbudget.length > 0) {
        out += `PERINGATAN OVERBUDGET:\n`;
        overbudget.forEach((o: { category_name: string; budget: number; spent: number; remaining: number }) => {
          out += `- ${o.category_name}: Terpakai ${formatIDR(o.spent)} dari budget ${formatIDR(o.budget)} (Defisit: ${formatIDR(Math.abs(o.remaining))})\n`;
        });
        out += `\n`;
      }

      out += `BREAKDOWN PER KATEGORI:\n`;
      summaryRows.forEach((r: { category_name: string; budget: number; spent: number; remaining: number; usage_pct: number }) => {
        out += `- ${r.category_name}: ${formatIDR(r.spent)} / ${formatIDR(r.budget)} (${Number(r.usage_pct || 0).toFixed(0)}%) - Sisa: ${formatIDR(r.remaining)}\n`;
      });

      return out;
    }

    // 4. Cari Transaksi
    case "cari_transaksi": {
      const keyword = typeof args.kata_kunci === "string" ? args.kata_kunci.trim() : "";
      const catFilter = typeof args.kategori === "string" ? args.kategori.trim() : "";
      const dariTanggal = typeof args.dari_tanggal === "string" ? args.dari_tanggal.trim() : "";
      const sampaiTanggal = typeof args.sampai_tanggal === "string" ? args.sampai_tanggal.trim() : "";
      const limit = typeof args.limit === "number" ? Math.min(args.limit, 50) : 15;

      let query = supabase
        .from("expenses")
        .select("id, description, amount, spent_at, note, categories(name)")
        .eq("household_id", householdId)
        .order("spent_at", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(limit);

      if (keyword) {
        query = query.ilike("description", `%${keyword}%`);
      }
      if (dariTanggal) {
        query = query.gte("spent_at", dariTanggal);
      }
      if (sampaiTanggal) {
        query = query.lte("spent_at", sampaiTanggal);
      }

      const { data: rows, error: qErr } = await query;
      if (qErr) throw new Error(qErr.message);

      let filtered = rows ?? [];
      if (catFilter) {
        filtered = filtered.filter((r) => {
          const cName = (r.categories as unknown as { name?: string })?.name || "";
          return cName.toLowerCase().includes(catFilter.toLowerCase());
        });
      }

      if (filtered.length === 0) {
        return "Tidak ditemukan transaksi yang sesuai dengan kriteria pencarian.";
      }

      let out = `DITEMUKAN ${filtered.length} TRANSAKSI:\n`;
      filtered.forEach((tx) => {
        const cName = (tx.categories as unknown as { name?: string })?.name || "Tanpa Kategori";
        out += `- [${tx.spent_at}] ${tx.description} : ${formatIDR(Number(tx.amount))} (${cName})\n`;
      });

      return out;
    }

    // 5. Kelola Budget
    case "kelola_budget": {
      const aksi = String(args.aksi || "lihat");
      const { data: hh } = await supabase.from("households").select("pay_day_of_month").eq("id", householdId).maybeSingle();
      const { data: cp } = await supabase.from("custom_periods").select("label_month, start_date, end_date").eq("household_id", householdId);
      const payDay = hh?.pay_day_of_month ?? 25;
      const targetMonth =
        typeof args.bulan === "string" && args.bulan
          ? args.bulan
          : labelMonthKey(currentPeriodLabelWithCustom(payDay, cp ?? []));

      if (aksi === "lihat") {
        const { data: budgets } = await supabase
          .from("budgets")
          .select("id, amount, month, categories(name)")
          .eq("household_id", householdId)
          .eq("month", targetMonth);

        const list = budgets ?? [];
        if (list.length === 0) {
          return `Belum ada anggaran yang diatur untuk periode ${targetMonth}.`;
        }

        let out = `DAFTAR BUDGET PERIODE ${targetMonth}:\n`;
        list.forEach((b) => {
          const cName = (b.categories as unknown as { name?: string })?.name || "Kategori";
          out += `- ${cName}: ${formatIDR(Number(b.amount))}\n`;
        });
        return out;
      }

      if (aksi === "ubah") {
        const catInput = String(args.kategori || "").trim();
        const nominal = Number(args.nominal);
        if (!catInput) throw new Error("Nama kategori wajib disertakan untuk mengubah budget.");
        if (isNaN(nominal) || nominal < 0) throw new Error("Nominal budget harus berupa angka non-negatif.");

        const { data: cats } = await supabase
          .from("categories")
          .select("id, name")
          .eq("household_id", householdId)
          .eq("is_archived", false);

        const matched = (cats ?? []).find(
          (c) => c.name.toLowerCase().includes(catInput.toLowerCase()),
        );

        if (!matched) {
          throw new Error(`Kategori '${catInput}' tidak ditemukan dalam daftar kategori keluarga.`);
        }

        const { data: existing } = await supabase
          .from("budgets")
          .select("id")
          .eq("household_id", householdId)
          .eq("category_id", matched.id)
          .eq("month", targetMonth)
          .maybeSingle();

        if (existing) {
          await supabase.from("budgets").update({ amount: nominal }).eq("id", existing.id);
        } else {
          await supabase.from("budgets").insert({
            household_id: householdId,
            category_id: matched.id,
            month: targetMonth,
            amount: nominal,
          });
        }

        return `Budget kategori "${matched.name}" untuk periode ${targetMonth} berhasil diubah menjadi ${formatIDR(nominal)}.`;
      }

      throw new Error("Aksi tidak valid. Gunakan 'lihat' atau 'ubah'.");
    }

    // 6. Kelola Kategori
    case "kelola_kategori": {
      const aksi = String(args.aksi || "daftar");
      if (aksi === "daftar") {
        const { data: cats } = await supabase
          .from("categories")
          .select("id, name, color, is_archived")
          .eq("household_id", householdId)
          .eq("is_archived", false)
          .order("sort_order");

        const list = cats ?? [];
        let out = `KATEGORI PENGELUARAN AKTIF (${list.length}):\n`;
        list.forEach((c, idx) => {
          out += `${idx + 1}. ${c.name}\n`;
        });
        return out;
      }

      if (aksi === "tambah") {
        const nama = String(args.nama_kategori || "").trim();
        const warna = typeof args.warna === "string" ? args.warna.trim() : "#16a34a";
        if (!nama) throw new Error("Nama kategori baru tidak boleh kosong.");

        const { error: catErr } = await supabase.from("categories").insert({
          household_id: householdId,
          name: nama,
          color: warna,
        });

        if (catErr) throw new Error(catErr.message);
        return `Kategori "${nama}" berhasil ditambahkan ke daftar kategori keluarga.`;
      }

      throw new Error("Aksi tidak valid. Gunakan 'daftar' atau 'tambah'.");
    }

    // 7. Kelola Goals Tabungan
    case "kelola_goals_tabungan": {
      const aksi = String(args.aksi || "daftar");
      if (aksi === "daftar") {
        const [goalsRes, depRes, witRes] = await Promise.all([
          supabase.from("goals").select("*").eq("household_id", householdId).eq("status", "active").order("sort_order"),
          supabase.from("expenses").select("goal_id, amount").eq("household_id", householdId).not("goal_id", "is", null),
          supabase.from("incomes").select("goal_id, amount").eq("household_id", householdId).not("goal_id", "is", null),
        ]);

        const goals = goalsRes.data ?? [];
        if (goals.length === 0) return "Belum ada target tabungan (Goals) aktif.";

        const savedMap = new Map<string, number>();
        (depRes.data ?? []).forEach((d) => savedMap.set(d.goal_id, (savedMap.get(d.goal_id) ?? 0) + Number(d.amount)));
        (witRes.data ?? []).forEach((w) => savedMap.set(w.goal_id, (savedMap.get(w.goal_id) ?? 0) - Number(w.amount)));

        let out = `TARGET TABUNGAN & GOALS KELUARGA:\n`;
        goals.forEach((g) => {
          const saved = Math.max(0, savedMap.get(g.id) ?? 0);
          const target = Number(g.target_amount);
          const pct = target > 0 ? ((saved / target) * 100).toFixed(1) : "0";
          out += `- ${g.name}: Terkumpul ${formatIDR(saved)} dari target ${formatIDR(target)} (${pct}%)\n`;
          if (g.target_date) out += `  Target tanggal: ${g.target_date}\n`;
        });
        return out;
      }

      if (aksi === "tambah_goal") {
        const nama = String(args.nama_goal || "").trim();
        const nominal = Number(args.target_nominal);
        const targetDate = typeof args.target_tanggal === "string" ? args.target_tanggal : null;

        if (!nama) throw new Error("Nama goal wajib diisi.");
        if (isNaN(nominal) || nominal <= 0) throw new Error("Target nominal harus angka positif.");

        const { error: gErr } = await supabase.from("goals").insert({
          household_id: householdId,
          name: nama,
          target_amount: nominal,
          target_date: targetDate,
          status: "active",
        });

        if (gErr) throw new Error(gErr.message);
        return `Target tabungan "${nama}" dengan nominal ${formatIDR(nominal)} berhasil dibuat.`;
      }

      throw new Error("Aksi tidak valid. Gunakan 'daftar' atau 'tambah_goal'.");
    }

    // 8. Kelola Events
    case "kelola_events": {
      const aksi = String(args.aksi || "daftar");
      if (aksi === "daftar") {
        const [evRes, expRes] = await Promise.all([
          supabase.from("events").select("*").eq("household_id", householdId).eq("status", "active"),
          supabase.from("expenses").select("event_id, amount").eq("household_id", householdId).not("event_id", "is", null),
        ]);

        const events = evRes.data ?? [];
        if (events.length === 0) return "Tidak ada event atau kegiatan aktif saat ini.";

        const costMap = new Map<string, number>();
        (expRes.data ?? []).forEach((e) => costMap.set(e.event_id, (costMap.get(e.event_id) ?? 0) + Number(e.amount)));

        let out = `EVENT / KEGIATAN KELUARGA AKTIF:\n`;
        events.forEach((ev) => {
          const cost = costMap.get(ev.id) ?? 0;
          out += `- ${ev.name} (Mulai: ${ev.start_date}): Total Biaya ${formatIDR(cost)}\n`;
        });
        return out;
      }

      if (aksi === "buat_event") {
        const nama = String(args.nama_event || "").trim();
        const start = typeof args.tanggal_mulai === "string" && args.tanggal_mulai ? args.tanggal_mulai : new Date().toISOString().slice(0, 10);
        if (!nama) throw new Error("Nama event tidak boleh kosong.");

        const { error: evErr } = await supabase.from("events").insert({
          household_id: householdId,
          name: nama,
          start_date: start,
          status: "active",
        });

        if (evErr) throw new Error(evErr.message);
        return `Event "${nama}" berhasil dibuat dengan tanggal mulai ${start}.`;
      }

      throw new Error("Aksi tidak valid. Gunakan 'daftar' atau 'buat_event'.");
    }

    // 9. Analisa CFO
    case "analisa_cfo": {
      const specificQ = typeof args.pertanyaan_spesifik === "string" ? args.pertanyaan_spesifik.trim() : "";
      const ctx = await buildFinancialContext(supabase as unknown as any, householdId, 3);

      if (!ctx) {
        return "Belum ada cukup data keuangan untuk menjalankan analisa CFO.";
      }

      // Jika ada DeepSeek API Key, lakukan inferensi langsung
      const apiKey = process.env.DEEPSEEK_API_KEY;
      if (apiKey) {
        const prompt = `Kamu adalah Chief Financial Officer (CFO) & Senior Financial Planner (CFP) Keluarga.
Lakukan diagnosa finansial kuantitatif dan solutif berdasarkan data keuangan 3 periode terakhir berikut:

METRIK & DIGEST KEUANGAN:
${ctx.digest}

DETAIL TRANSAKSI TERAKHIR:
${ctx.itemDigest}

TARGET TABUNGAN / GOALS:
${ctx.goalDigest}

MEMORI KELUARGA:
${ctx.memoryDigest}

${specificQ ? `PERTANYAAN SPESIFIK PENGGUNA: "${specificQ}"` : ""}

Format jawaban ramah mobile:
1. Status Kesehatan Finansial (Sehat / Waspada / Boncos) & Savings Rate %
2. Temuan Utama (Burn rate harian, anomali, overbudget)
3. 3-5 Langkah Aksi Taktis Prioritas
Jawaban harus padat, data-driven dengan nominal Rupiah konkret, dan tanpa emoji.`;

        const res = await fetch(process.env.DEEPSEEK_API_URL || "https://api.deepseek.com/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
            messages: [
              { role: "system", content: "Kamu adalah CFO Keluarga. Berikan analisa keuangan berbasis data real tanpa emoji." },
              { role: "user", content: prompt },
            ],
            temperature: 0.3,
          }),
        });

        if (res.ok) {
          const json = await res.json();
          const reply = json.choices?.[0]?.message?.content;
          if (reply) return reply;
        }
      }

      // Fallback jika API key belum ada: sajikan digest finansial terstruktur
      return `AUDIT FINANSIAL & RINGKASAN KELUARGA (CFP Digest):\n\n${ctx.digest}\n\nTARGET GOALS:\n${ctx.goalDigest}`;
    }

    default:
      throw new Error(`Tool '${toolName}' tidak dikenal.`);
  }
}
